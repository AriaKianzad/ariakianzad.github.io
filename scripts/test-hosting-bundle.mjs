import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createZipBuffer,
  extractZipBuffer,
  readZipEntries,
} from "./zip-utils.mjs";

const source = new Map([
  ["index.html", Buffer.from("<!doctype html><title>Portfolio</title>", "utf8")],
  ["assets/فارسی-تصویر.webp", Buffer.from([0, 1, 2, 3, 250, 251, 252, 253])],
  ["empty.txt", Buffer.alloc(0)],
]);

const archive = createZipBuffer(source);
assert.ok(archive.length > 100, "the ZIP archive must contain local and central records");

const entries = readZipEntries(archive);
assert.equal(entries.length, source.size, "every staged file must have one archive entry");
assert.ok(entries.some((entry) => entry.name === "assets/فارسی-تصویر.webp"), "UTF-8 paths must survive central-directory parsing");
assert.ok(entries.every((entry) => entry.method === 8), "files must use standard DEFLATE compression");

const temporary = mkdtempSync(join(tmpdir(), "aria-zip-test-"));
try {
  const extracted = join(temporary, "site");
  const result = extractZipBuffer(archive, extracted);
  assert.equal(result.size, source.size, "the extractor must report every file");

  for (const [name, expected] of source) {
    assert.deepEqual(
      readFileSync(join(extracted, ...name.split("/"))),
      expected,
      "extracted bytes must exactly match " + name,
    );
  }

  const damaged = Buffer.from(archive);
  const centralSignature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const centralOffset = damaged.indexOf(centralSignature);
  assert.notEqual(centralOffset, -1, "a central-directory record must exist");
  const localSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const localOffset = damaged.indexOf(localSignature);
  assert.notEqual(localOffset, -1, "a local file header must exist");
  damaged[centralOffset + 16] ^= 0xff;
  damaged[localOffset + 14] ^= 0xff;
  assert.throws(
    () => extractZipBuffer(damaged, join(temporary, "damaged")),
    /CRC-32 mismatch/,
    "corrupted file contents must fail CRC verification",
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

assert.throws(
  () => createZipBuffer(new Map([["../outside.txt", Buffer.from("no")]])),
  /unsafe ZIP entry path/,
  "the writer must reject traversal paths",
);
assert.throws(
  () => createZipBuffer(new Map([["same.txt", Buffer.from("a")], ["SAME.TXT", Buffer.from("b")]])),
  /duplicate ZIP path/,
  "the writer must reject case-insensitive duplicate paths for Windows extraction",
);

console.log("Portable hosting ZIP contract passed: UTF-8 paths, binary/empty files, CRC checks, traversal rejection and case-insensitive duplicate rejection.");
