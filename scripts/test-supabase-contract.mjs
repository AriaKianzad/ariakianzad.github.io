import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  config,
  download,
  analytics,
  downloadDeno,
  analyticsDeno,
  clientConfig,
  allowlistMigration,
  snapshotsMigration,
  privateFunctionMigration,
  scheduleMigration,
] = await Promise.all([
  read("supabase/config.toml"),
  read("supabase/functions/download-stats/index.ts"),
  read("supabase/functions/site-analytics/index.ts"),
  read("supabase/functions/download-stats/deno.json"),
  read("supabase/functions/site-analytics/deno.json"),
  read("public/admin/config.js"),
  read("supabase/migrations/20261121001000_create_dashboard_admin_allowlist.sql"),
  read("supabase/migrations/20261121000000_create_download_snapshots.sql"),
  read("supabase/migrations/20261121171913_create_private_github_download_snapshot_job.sql"),
  read("supabase/migrations/20261121171937_schedule_daily_download_snapshots.sql"),
]);

const sdkVersion = "npm:@supabase/supabase-js@2.119.2";
for (const [name, source, deno] of [
  ["download-stats", download, downloadDeno],
  ["site-analytics", analytics, analyticsDeno],
]) {
  const imports = JSON.parse(deno).imports;
  assert.equal(imports["@supabase/supabase-js"], sdkVersion, name + " must use the pinned Supabase SDK");
  assert.ok(source.includes('from "@supabase/supabase-js"'), name + " must use the Deno import map");
  assert.ok(!source.includes("npm:@supabase/supabase-js@2\""), name + " must not use a floating SDK version");
  assert.ok(source.includes("auth.getUser(token)"), name + " must verify the access token with Supabase Auth");
  assert.ok(source.includes('from("dashboard_admins")'), name + " must use the server-side admin allowlist");
  assert.ok(source.includes('.eq("active", true)'), name + " must require an active administrator");
  assert.ok(source.includes('"Access-Control-Allow-Origin": SITE_ORIGIN'), name + " must use the explicit site origin for CORS");
  assert.ok(!/Access-Control-Allow-Origin["']?\s*:\s*["']\*["']/.test(source), name + " must not allow wildcard CORS");
  assert.ok(source.includes('"Cache-Control": "no-store"'), name + " responses must not be cached");
  assert.ok(!source.includes("x-cron-secret"), name + " must not advertise an unused cron header");
}

for (const functionName of ["download-stats", "site-analytics"]) {
  assert.match(config, new RegExp("\\[functions\\." + functionName + "\\][\\s\\S]*?verify_jwt\\s*=\\s*false"));
}
assert.ok(download.includes("confirmed_at") || download.includes("email_confirmed_at"),
  "download-stats must require a confirmed email");
assert.ok(analytics.includes("confirmed_at") || analytics.includes("email_confirmed_at"),
  "site-analytics must require a confirmed email");

for (const [name, migration] of [
  ["dashboard_admins", allowlistMigration],
  ["download_snapshots", snapshotsMigration],
]) {
  assert.ok(migration.includes("enable row level security"), name + " must enable RLS");
  assert.ok(migration.includes("revoke all on table"), name + " must revoke browser role table privileges");
  assert.ok(migration.includes("from anon, authenticated"), name + " must explicitly revoke anon and authenticated");
}

assert.match(privateFunctionMigration, /security definer/i, "scheduled snapshot function must be SECURITY DEFINER");
assert.match(privateFunctionMigration, /set search_path = pg_catalog, extensions, public, private/i,
  "SECURITY DEFINER function must have a fixed search_path");
assert.match(privateFunctionMigration, /revoke all on schema private from public/i,
  "private schema must not be public");
assert.match(privateFunctionMigration, /revoke all on function private\.capture_github_download_snapshot\(\) from public/i,
  "snapshot function execution must be revoked from PUBLIC");
assert.match(privateFunctionMigration, /grant execute on function private\.capture_github_download_snapshot\(\) to postgres/i,
  "only the database postgres role should execute the snapshot function");
assert.match(scheduleMigration, /15 0 \* \* \*/,
  "daily snapshot schedule must remain at 00:15 UTC");

assert.ok(clientConfig.includes("https://bkohdqwecnvbmeaiuyyx.supabase.co"),
  "browser config must point at the expected Supabase project");
assert.ok(clientConfig.includes("sb_publishable_"),
  "browser config may contain only a publishable API key");
assert.ok(!/sb_secret_|service_role|service-account|private_key/i.test(clientConfig),
  "browser config must never contain privileged credentials");

console.log("Supabase contract passed: SDK pinning, explicit Auth verification, admin allowlist, CORS, no-store, RLS grants, private SECURITY DEFINER function and cron schedule.");
