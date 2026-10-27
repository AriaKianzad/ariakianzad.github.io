/**
 * Local preview for the static export: serves out/ and applies the same
 * security headers declared in out/_headers, so the page can be verified
 * under the production CSP. Run: node scripts/serve.mjs [port]
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const root = join(process.cwd(), "out");
const port = Number(process.argv[2] || 4173);

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

const security = {};
const headersSrc = existsSync(join(root, "_headers")) ? readFileSync(join(root, "_headers"), "utf8") : "";
for (const line of headersSrc.split("\n")) {
  const match = line.match(/^\s{2}([A-Za-z-]+):\s*(.+)$/);
  if (match) security[match[1]] = match[2].trim();
}

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (path.endsWith("/")) path += "index.html";
  let file = join(root, path);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (existsSync(`${file}.html`)) file += ".html";
    else {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8", ...security });
      res.end("Not found");
      return;
    }
  }
  const type = MIME[extname(file)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, ...security });
  res.end(readFileSync(file));
}).listen(port, "127.0.0.1", () => {
  console.log(`serving out/ on http://127.0.0.1:${port} (security headers applied)`);
});
