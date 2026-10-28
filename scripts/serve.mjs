/**
 * Local preview for the static export: serves out/ and applies the security
 * headers declared in out/_headers — parsed with real path-group semantics
 * (a path pattern line followed by indented "Key: value" lines; later
 * matching groups override earlier ones), so the preview reflects what a
 * Netlify/Cloudflare Pages deployment would send. Every request is logged
 * (status + path), so any missing asset shows up as a 404 in the output.
 *
 * Usage: node scripts/serve.mjs [port] [--allow-framing] [--csp-noscript]
 *        [--root=<dir>] [--headers-file=<path>]
 *
 *   --allow-framing  TEST ONLY: drops X-Frame-Options and the CSP
 *                    frame-ancestors directive so the page can be loaded in
 *                    an iframe for viewport-width tests. Never deploy this.
 *   --csp-noscript   TEST ONLY: hardens script-src to 'none' to emulate a
 *                    visitor with JavaScript disabled.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";

const args = process.argv.slice(2);
const port = Number(args.find((arg) => /^\d+$/.test(arg)) || 4173);
const allowFraming = args.includes("--allow-framing");
const cspNoscript = args.includes("--csp-noscript");

/* Optional overrides, e.g. to serve an extracted hosting bundle:
 *   node scripts/serve.mjs 4176 --root=<dir> --headers-file=<path>  */
const rootFlag = args.find((arg) => arg.startsWith("--root="));
const root = rootFlag ? resolve(process.cwd(), rootFlag.slice(7)) : join(process.cwd(), "out");
const headersFlag = args.find((arg) => arg.startsWith("--headers-file="));
const headersPath = headersFlag ? resolve(process.cwd(), headersFlag.slice(15)) : join(root, "_headers");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

/* Parse _headers into [{ pattern, headers }] groups. */
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

const patternMatches = (pattern, path) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(path);

const headersFor = (path) => {
  const out = {};
  for (const group of groups) {
    if (patternMatches(group.pattern, path)) Object.assign(out, group.headers);
  }
  return out;
};

const applyTestFlags = (headers) => {
  if (allowFraming) {
    delete headers["X-Frame-Options"];
    headers["Content-Security-Policy"] = (headers["Content-Security-Policy"] || "").replace(
      /\s*frame-ancestors 'none';?/,
      "",
    );
  }
  if (cspNoscript) {
    headers["Content-Security-Policy"] = (headers["Content-Security-Policy"] || "").replace(
      "script-src 'self'",
      "script-src 'none'",
    );
  }
  return headers;
};

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (path.endsWith("/")) path += "index.html";
  let file = join(root, path);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (existsSync(`${file}.html`)) {
      file += ".html";
    } else {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8", ...applyTestFlags(headersFor(path)) });
      res.end("Not found");
      console.log(`404 ${req.method} ${req.url}`);
      return;
    }
  }
  const type = MIME[extname(file)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, ...applyTestFlags(headersFor(path)) });
  res.end(readFileSync(file));
  console.log(`200 ${req.method} ${req.url}`);
}).listen(port, "127.0.0.1", () => {
  console.log(
    `serving out/ on http://127.0.0.1:${port} (_headers parsed with path groups` +
      `${allowFraming ? ", framing allowed TEST ONLY" : ""}${cspNoscript ? ", script-src none TEST ONLY" : ""})`,
  );
});
