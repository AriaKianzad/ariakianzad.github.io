/**
 * Local preview for the static export. Serves only files inside the selected
 * export root, applies _headers, rejects traversal/symlink escapes and accepts
 * only GET/HEAD. It binds to loopback only.
 *
 * Usage: node scripts/serve.mjs [port] [--allow-framing] [--csp-noscript]
 *        [--root=<dir>] [--headers-file=<path>]
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const portArg = args.find((arg) => /^\d+$/.test(arg));
const port = portArg ? Number(portArg) : 4173;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid preview port.");

const allowFraming = args.includes("--allow-framing");
const cspNoscript = args.includes("--csp-noscript");
const rootFlag = args.find((arg) => arg.startsWith("--root="));
const requestedRoot = rootFlag ? resolve(process.cwd(), rootFlag.slice("--root=".length)) : join(process.cwd(), "out");
if (!existsSync(requestedRoot) || !statSync(requestedRoot).isDirectory()) throw new Error("Preview root is not a directory.");
const root = realpathSync(requestedRoot);

const headersFlag = args.find((arg) => arg.startsWith("--headers-file="));
const headersPath = headersFlag ? resolve(process.cwd(), headersFlag.slice("--headers-file=".length)) : join(root, "_headers");

const MIME = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon", ".jpeg": "image/jpeg", ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf", ".png": "image/png", ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

/* Parse _headers path groups. Later matching groups override earlier ones. */
const groups = [];
const headersSrc = existsSync(headersPath) ? readFileSync(headersPath, "utf8") : "";
let current = null;
for (const rawLine of headersSrc.split("\n")) {
  const line = rawLine.replace(/\r$/, "");
  if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
  if (!/^\s/.test(line)) {
    current = { pattern: line.trim(), headers: {} };
    groups.push(current);
    continue;
  }
  const match = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
  if (match && current) current.headers[match[1]] = match[2].trim();
}

const patternMatches = (pattern, path) => {
  if (pattern === "/*") return path.startsWith("/");
  if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
};
const headersFor = (path) => {
  const headers = {};
  for (const group of groups) if (patternMatches(group.pattern, path)) Object.assign(headers, group.headers);
  return headers;
};
const applyTestFlags = (headers) => {
  if (allowFraming) {
    delete headers["X-Frame-Options"];
    headers["Content-Security-Policy"] = (headers["Content-Security-Policy"] || "").replace(/\s*frame-ancestors 'none';?/, "");
  }
  if (cspNoscript) {
    headers["Content-Security-Policy"] = (headers["Content-Security-Policy"] || "").replace("script-src 'self'", "script-src 'none'");
  }
  headers["X-Content-Type-Options"] ??= "nosniff";
  return headers;
};

const isInsideRoot = (candidate) => {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel));
};

const resolveRequestFile = (pathname) => {
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { return { status: 400, message: "Malformed URL path" }; }
  if (decoded.includes("\0") || decoded.includes("\\")) return { status: 400, message: "Invalid URL path" };

  const candidate = resolve(root, "." + (decoded.startsWith("/") ? decoded : "/" + decoded));
  if (!isInsideRoot(candidate)) return { status: 403, message: "Forbidden" };

  let file = candidate;
  try {
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    else if (!existsSync(file) && existsSync(file + ".html")) file += ".html";
    if (!existsSync(file) || !statSync(file).isFile()) return null;

    const realFile = realpathSync(file);
    if (!isInsideRoot(realFile)) return { status: 403, message: "Forbidden" };
    return statSync(realFile).isFile() ? { file: realFile } : null;
  } catch { return null; }
};

const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8", ...applyTestFlags(headersFor("/")) });
    res.end(req.method === "HEAD" ? undefined : "Method not allowed");
    return;
  }

  let pathname;
  try { pathname = new URL(req.url || "/", "http://localhost").pathname; }
  catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(req.method === "HEAD" ? undefined : "Bad request");
    return;
  }

  const result = resolveRequestFile(pathname);
  if (!result || result.status) {
    const status = result?.status || 404;
    const notFound = join(root, "404.html");
    const body = status === 404 && existsSync(notFound) ? readFileSync(notFound) : Buffer.from(result?.message || "Not found");
    res.writeHead(status, {
      "Content-Type": status === 404 && existsSync(notFound) ? "text/html; charset=utf-8" : "text/plain; charset=utf-8",
      ...applyTestFlags(headersFor(pathname)),
    });
    res.end(req.method === "HEAD" ? undefined : body);
    console.log(status + " " + req.method + " " + pathname);
    return;
  }

  res.writeHead(200, {
    "Content-Type": MIME[extname(result.file).toLowerCase()] || "application/octet-stream",
    ...applyTestFlags(headersFor(pathname)),
  });
  res.end(req.method === "HEAD" ? undefined : readFileSync(result.file));
  console.log("200 " + req.method + " " + pathname);
});

server.listen(port, "127.0.0.1", () => {
  console.log("serving " + root + " on http://127.0.0.1:" + port +
    (allowFraming ? " (framing allowed TEST ONLY)" : "") +
    (cspNoscript ? " (script-src none TEST ONLY)" : ""));
});
