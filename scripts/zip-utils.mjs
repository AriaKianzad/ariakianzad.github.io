import { deflateRawSync, inflateRawSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_END = 0x06054b50;
const UTF8_FLAG = 0x0800;
const MAX_U16 = 0xffff;
const MAX_U32 = 0xffffffff;

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  crcTable[n] = value >>> 0;
}

export function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function assertSafeArchivePath(name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    /^[A-Za-z]:/.test(name) ||
    isAbsolute(name)
  ) {
    throw new Error("unsafe ZIP entry path: " + String(name));
  }

  const segments = name.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("unsafe ZIP entry path: " + name);
  }
  return segments;
}

function dosTimestamp(date = new Date()) {
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  const time = (
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2)
  );
  const day = (
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate()
  );
  return { time, day };
}

/**
 * Create a standards-compliant, UTF-8 ZIP archive using Node built-ins only.
 * The Map keys are archive-root-relative POSIX paths and values are Buffers.
 */
export function createZipBuffer(files) {
  if (!(files instanceof Map) || files.size === 0) {
    throw new Error("ZIP input must be a non-empty Map of relative paths to Buffers.");
  }
  if (files.size > MAX_U16) {
    throw new Error("ZIP64 is not supported: too many files.");
  }

  const seen = new Set();
  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;
  const stamp = dosTimestamp();

  for (const [name, value] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    assertSafeArchivePath(name);
    const caseFolded = name.toLocaleLowerCase("en-US");
    if (seen.has(caseFolded)) throw new Error("duplicate ZIP path (case-insensitive): " + name);
    seen.add(caseFolded);

    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.isBuffer(value) ? value : Buffer.from(value);
    if (nameBytes.length > MAX_U16 || data.length > MAX_U32) {
      throw new Error("ZIP64 is not supported for entry: " + name);
    }

    const compressed = deflateRawSync(data, { level: 9 });
    if (compressed.length > MAX_U32) {
      throw new Error("ZIP64 is not supported for compressed entry: " + name);
    }
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(ZIP_LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(8, 8); // DEFLATE
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.day, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localRecords.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(ZIP_CENTRAL, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // Unix creator, ZIP 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.day, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // regular file, 0644
    central.writeUInt32LE(localOffset, 42);
    centralRecords.push(central, nameBytes);

    localOffset += local.length + nameBytes.length + compressed.length;
    if (localOffset > MAX_U32) throw new Error("ZIP64 is not supported: archive is too large.");
  }

  const centralBuffer = Buffer.concat(centralRecords);
  const centralOffset = localOffset;
  const centralSize = centralBuffer.length;
  if (centralSize > MAX_U32 || centralOffset + centralSize > MAX_U32) {
    throw new Error("ZIP64 is not supported: central directory is too large.");
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_END, 0);
  end.writeUInt16LE(0, 4); // disk
  end.writeUInt16LE(0, 6); // central directory disk
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20); // comment

  return Buffer.concat([...localRecords, centralBuffer, end]);
}

/**
 * Read ZIP metadata and validate central-directory structure.
 * ZIP64, encrypted archives, multi-disk archives and data descriptors are rejected.
 */
export function readZipEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new Error("ZIP archive is empty or truncated.");
  }

  let endOffset = -1;
  const earliest = Math.max(0, buffer.length - 22 - MAX_U16);
  for (let i = buffer.length - 22; i >= earliest; i--) {
    if (buffer.readUInt32LE(i) === ZIP_END) {
      const commentLength = buffer.readUInt16LE(i + 20);
      if (i + 22 + commentLength === buffer.length) {
        endOffset = i;
        break;
      }
    }
  }
  if (endOffset < 0) throw new Error("ZIP end-of-central-directory record not found.");

  if (
    buffer.readUInt16LE(endOffset + 4) !== 0 ||
    buffer.readUInt16LE(endOffset + 6) !== 0
  ) {
    throw new Error("Multi-disk ZIP archives are not supported.");
  }

  const diskCount = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (
    diskCount === MAX_U16 ||
    entryCount === MAX_U16 ||
    centralSize === MAX_U32 ||
    centralOffset === MAX_U32
  ) {
    throw new Error("ZIP64 archives are not supported.");
  }
  if (diskCount !== entryCount) throw new Error("Inconsistent ZIP entry counts.");
  if (centralOffset + centralSize > endOffset) throw new Error("Invalid ZIP central-directory bounds.");

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries = [];
  const names = new Set();
  let position = centralOffset;

  for (let n = 0; n < entryCount; n++) {
    if (position + 46 > centralOffset + centralSize || buffer.readUInt32LE(position) !== ZIP_CENTRAL) {
      throw new Error("Invalid ZIP central-directory entry " + n + ".");
    }

    const madeBy = buffer.readUInt16LE(position + 4) >>> 8;
    const flags = buffer.readUInt16LE(position + 8);
    const method = buffer.readUInt16LE(position + 10);
    const crc = buffer.readUInt32LE(position + 16);
    const compressed = buffer.readUInt32LE(position + 20);
    const uncompressed = buffer.readUInt32LE(position + 24);
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    const externalAttributes = buffer.readUInt32LE(position + 38);
    const localOffset = buffer.readUInt32LE(position + 42);
    const recordEnd = position + 46 + nameLength + extraLength + commentLength;

    if (recordEnd > centralOffset + centralSize) {
      throw new Error("ZIP central-directory entry exceeds its declared bounds.");
    }
    if ((flags & 0x1) !== 0) throw new Error("Encrypted ZIP entries are not supported.");
    if ((flags & 0x8) !== 0) throw new Error("ZIP data descriptors are not supported.");
    if ((flags & UTF8_FLAG) === 0) throw new Error("ZIP entries must declare UTF-8 filenames.");
    if (method !== 0 && method !== 8) throw new Error("Unsupported ZIP compression method: " + method);
    if (
      compressed === MAX_U32 ||
      uncompressed === MAX_U32 ||
      localOffset === MAX_U32
    ) {
      throw new Error("ZIP64 entries are not supported.");
    }

    const nameBytes = buffer.subarray(position + 46, position + 46 + nameLength);
    const name = decoder.decode(nameBytes);
    assertSafeArchivePath(name);
    const caseFolded = name.toLocaleLowerCase("en-US");
    if (names.has(caseFolded)) throw new Error("Duplicate ZIP path (case-insensitive): " + name);
    names.add(caseFolded);

    entries.push({
      name,
      madeBy,
      flags,
      method,
      crc,
      compressed,
      uncompressed,
      externalAttributes,
      localOffset,
    });
    position = recordEnd;
  }

  if (position !== centralOffset + centralSize) {
    throw new Error("ZIP central-directory size does not match the parsed records.");
  }
  return entries;
}

/**
 * Extract only validated regular-file entries written by createZipBuffer().
 * The destination must be a new or empty directory.
 */
export function extractZipBuffer(buffer, destination) {
  const entries = readZipEntries(buffer);
  const root = resolve(destination);
  const written = new Map();

  mkdirSync(root, { recursive: true });

  for (const entry of entries) {
    const segments = assertSafeArchivePath(entry.name);
    const target = resolve(root, ...segments);
    const relativeTarget = relative(root, target);
    if (
      relativeTarget === ".." ||
      relativeTarget.startsWith(".." + sep) ||
      isAbsolute(relativeTarget)
    ) {
      throw new Error("ZIP entry escapes the extraction directory: " + entry.name);
    }

    const madeFileType = (entry.externalAttributes >>> 16) & 0xf000;
    if (entry.madeBy === 3 && madeFileType !== 0x8000) {
      throw new Error("ZIP entry is not a regular file: " + entry.name);
    }

    const local = entry.localOffset;
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== ZIP_LOCAL) {
      throw new Error("Invalid local ZIP header for: " + entry.name);
    }

    const localFlags = buffer.readUInt16LE(local + 6);
    const localMethod = buffer.readUInt16LE(local + 8);
    const localNameLength = buffer.readUInt16LE(local + 26);
    const localExtraLength = buffer.readUInt16LE(local + 28);
    if (localFlags !== entry.flags || localMethod !== entry.method) {
      throw new Error("Local and central ZIP headers disagree for: " + entry.name);
    }

    const decoder = new TextDecoder("utf-8", { fatal: true });
    const localName = decoder.decode(buffer.subarray(local + 30, local + 30 + localNameLength));
    if (localName !== entry.name) throw new Error("ZIP local filename mismatch for: " + entry.name);

    const dataStart = local + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + entry.compressed;
    if (dataEnd > buffer.length) throw new Error("Truncated ZIP entry data for: " + entry.name);

    const compressedData = buffer.subarray(dataStart, dataEnd);
    const data = entry.method === 0
      ? Buffer.from(compressedData)
      : inflateRawSync(compressedData, { maxOutputLength: Math.max(1, entry.uncompressed) });

    if (data.length !== entry.uncompressed) {
      throw new Error("ZIP uncompressed size mismatch for: " + entry.name);
    }
    if (crc32(data) !== entry.crc) throw new Error("ZIP CRC-32 mismatch for: " + entry.name);

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data, { flag: "wx" });
    written.set(entry.name, {
      size: data.length,
      sha256: undefined,
    });
  }

  return written;
}
