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
  adminApp,
  adminHtml,
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
  read("public/admin/app.js"),
  read("public/admin/index.html"),
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
assert.ok(download.includes("asset.created_at"), "download-stats must read GitHub's actual asset creation timestamp");
assert.ok(download.includes("assetCreatedDate: string"), "download history must know the date GitHub began counting downloads");
assert.ok(download.includes("(date === assetCreatedDate ? dayTotal : 0)"),
  "the first snapshot on the asset creation date must include downloads since publication");
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

assert.ok(adminApp.includes('endpoint.origin === "https://bkohdqwecnvbmeaiuyyx.supabase.co"'),
  "dashboard must validate the exact Supabase project origin before sending credentials");
assert.ok(adminApp.includes('config.supabaseAnonKey.startsWith("sb_publishable_")'),
  "dashboard must reject non-publishable API keys");
const restoreStart = adminApp.indexOf("async function restoreRememberedSession()");
const restoreEnd = adminApp.indexOf("async function requestSiteAnalytics", restoreStart);
const restoreSource = adminApp.slice(restoreStart, restoreEnd);
const savedTokenRead = restoreSource.indexOf('window.localStorage.getItem(SESSION_STORAGE_KEY)');
const noSavedTokenCheck = restoreSource.indexOf("if (!savedRefreshToken) return;");
const rememberOptInRestore = restoreSource.indexOf("rememberSession.checked = true;");
const sessionRefresh = restoreSource.indexOf("refreshSessionOnce()");
assert.ok(restoreStart >= 0 && restoreEnd > restoreStart, "remembered-session restoration must remain explicit");
assert.ok(savedTokenRead >= 0 && noSavedTokenCheck > savedTokenRead,
  "dashboard must look for a previously saved token before deciding whether to restore");
assert.ok(rememberOptInRestore > noSavedTokenCheck && sessionRefresh > rememberOptInRestore,
  "a saved token must restore the opted-in checkbox before refresh rotates and persists it");
assert.ok(!restoreSource.includes("if (!rememberSession.checked)"),
  "the unchecked first-visit control must not erase a previously opted-in session");
assert.ok(restoreSource.includes("rememberSession.checked = false;"),
  "an invalid or failed remembered session must reset the checkbox");
assert.ok(adminApp.includes("if (!rememberSession.checked)"),
  "new logins must still require an explicit checkbox opt-in before persisting a session");
assert.ok(adminApp.includes('/auth/v1/logout?scope=local'),
  "dashboard logout must request local Supabase session revocation");
assert.ok(adminHtml.includes('id="remember-session"') && !/id="remember-session"[^>]*checked/.test(adminHtml),
  "remembered sessions must be off by default");

console.log("Supabase contract passed: SDK pinning, explicit Auth verification, admin allowlist, CORS, no-store, RLS grants, private SECURITY DEFINER function and cron schedule.");
