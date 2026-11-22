import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scannerPath = fileURLToPath(new URL("./verify-secrets.mjs", import.meta.url));
const sandbox = mkdtempSync(join(tmpdir(), "aria-secret-scan-test-"));

function runScanner() {
  return spawnSync(process.execPath, [scannerPath], {
    cwd: sandbox,
    encoding: "utf8",
    timeout: 10_000,
  });
}

try {
  // Publishable Supabase keys are intentionally safe in browser configuration.
  writeFileSync(
    join(sandbox, "safe-config.txt"),
    "supabase key: sb_publishable_01234567890123456789012345678901\n",
    "utf8",
  );
  const clean = runScanner();
  assert.equal(clean.status, 0, clean.stderr || clean.stdout);
  assert.match(clean.stdout, /Credential scan passed/);

  // This is a synthetic token used only to exercise the scanner. It grants no access.
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  const signature = "synthetic_signature_not_a_credential_000000";
  const syntheticJwt = header + "." + payload + "." + signature;
  writeFileSync(join(sandbox, "legacy-token.txt"), syntheticJwt, "utf8");

  const dirty = runScanner();
  const output = dirty.stdout + dirty.stderr;
  assert.equal(dirty.status, 1, "a legacy service_role JWT must fail the scan");
  assert.match(output, /legacy Supabase service_role JWT/);
  assert.match(output, /legacy-token\.txt/);
  assert.ok(!output.includes(syntheticJwt), "scanner output must never print the token value");

  console.log("Security scanner regression passed: publishable keys are allowed and legacy service_role JWTs are detected without disclosure.");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
