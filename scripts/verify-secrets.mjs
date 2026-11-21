/**
 * Conservative repository credential scan.
 * This is an accidental-commit guard, not a Git-history audit.
 * The browser-safe sb_publishable key is intentionally permitted.
 */
import { readdirSync, readFileSync, lstatSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  ".git", "node_modules", ".next", "out", "dist", "coverage",
  "playwright-report", "test-results", ".cache", ".turbo",
  ".supabase", ".temp", ".branches",
]);
const MAX_TEXT_BYTES = 5 * 1024 * 1024;

const patterns = [
  {
    label: "private key PEM",
    regex: new RegExp("-{5}BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-{5}"),
  },
  {
    label: "Supabase secret API key",
    regex: new RegExp(["sb", "_secret_"].join("") + "[A-Za-z0-9_-]{20,}"),
  },
  {
    label: "GitHub personal/access token",
    regex: new RegExp("(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}"),
  },
  { label: "AWS access key ID", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: "Stripe secret key", regex: /\bsk_(?:live|test)_[0-9A-Za-z]{20,}\b/ },
  { label: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
];

const secretFilePatterns = [
  /(^|\/)\.env(?:\..+)?$/i,
  /(^|\/)\.npmrc$/i,
  /\.(?:pem|key|p12|pfx|p8)$/i,
  /(^|\/)(?:credentials|secrets)[^/]*\.json$/i,
  /(?:service|service_account)[-_]?account.*\.json$/i,
];

const findings = [];

function shouldSkipPath(path) {
  return path.split(/[\\/]/).some((part) => SKIP_DIRS.has(part));
}

function inspectFile(path) {
  const normalized = path.replace(/\\/g, "/");
  if (normalized === ".env.example" || normalized.endsWith("/.env.example")) return;

  if (secretFilePatterns.some((pattern) => pattern.test(normalized))) {
    findings.push({ path: normalized, reason: "sensitive credential/config filename" });
    return;
  }

  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    findings.push({ path: normalized, reason: "file could not be inspected" });
    return;
  }
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_TEXT_BYTES) return;

  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    findings.push({ path: normalized, reason: "file could not be read" });
    return;
  }
  if (bytes.includes(0)) return;

  const content = bytes.toString("utf8");
  for (const item of patterns) {
    if (item.regex.test(content)) {
      findings.push({ path: normalized, reason: item.label });
    }
  }
}

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const rel = relative(ROOT, path);
    if (entry.isSymbolicLink() || shouldSkipPath(rel)) continue;
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile()) inspectFile(path);
  }
}

walk(ROOT);

if (findings.length) {
  console.error("Credential scan failed. No credential values are printed:");
  for (const finding of findings) {
    console.error(" - " + finding.path + ": " + finding.reason);
  }
  process.exitCode = 1;
} else {
  console.log("Credential scan passed: no known high-confidence credential patterns or secret filenames found.");
}
