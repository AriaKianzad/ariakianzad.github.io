import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  config,
  download,
  analytics,
  downloadDeno,
  analyticsDeno,
  blogAdmin,
  blogAdminDeno,
  clientConfig,
  adminApp,
  adminHtml,
  blogAdminApp,
  blogAdminHtml,
  blogPublicMigration,
  blogBrowserDenyMigration,
  blogSnapshotMigration,
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
  read("supabase/functions/blog-admin/index.ts"),
  read("supabase/functions/blog-admin/deno.json"),
  read("public/admin/config.js"),
  read("public/admin/app.js"),
  read("public/admin/index.html"),
  read("public/admin/blog/app.js"),
  read("public/admin/blog/index.html"),
  read("supabase/migrations/20261123110500_harden_public_blog_rpc.sql"),
  read("supabase/migrations/20261123095924_deny_browser_access_to_blog_cms.sql"),
  read("supabase/migrations/20261123112000_separate_blog_published_snapshots.sql"),
  read("supabase/migrations/20261121001000_create_dashboard_admin_allowlist.sql"),
  read("supabase/migrations/20261121000000_create_download_snapshots.sql"),
  read("supabase/migrations/20261121171913_create_private_github_download_snapshot_job.sql"),
  read("supabase/migrations/20261121171937_schedule_daily_download_snapshots.sql"),
]);

const sdkVersion = "npm:@supabase/supabase-js@2.119.2";
for (const [name, source, deno] of [
  ["download-stats", download, downloadDeno],
  ["site-analytics", analytics, analyticsDeno],
  ["blog-admin", blogAdmin, blogAdminDeno],
]) {
  const imports = JSON.parse(deno).imports;
  assert.equal(imports["@supabase/supabase-js"], sdkVersion, name + " must use the pinned Supabase SDK");
  assert.ok(source.includes('from "@supabase/supabase-js"'), name + " must use the Deno import map");
  assert.ok(!source.includes("npm:@supabase/supabase-js@2\""), name + " must not use a floating SDK version");
  assert.ok(source.includes("auth.getUser("), name + " must verify the access token with Supabase Auth");
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
assert.ok(download.includes("date >= assetCreatedDate"),
  "the first known snapshot on or after asset publication must seed the cumulative total");
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


assert.ok(blogAdmin.includes("auth.getUser(accessToken)"), "blog-admin must verify the signed-in user with Supabase Auth");
assert.ok(blogAdmin.includes('from("dashboard_admins")') && blogAdmin.includes('.eq("active", true)'),
  "blog-admin must require an active address in the server-side allowlist");
assert.ok(blogAdmin.includes("email_confirmed_at") || blogAdmin.includes("confirmed_at"),
  "blog-admin must require a confirmed email");
assert.ok(blogAdmin.includes("GITHUB_WORKFLOW_TOKEN") && !blogAdminApp.includes("GITHUB_WORKFLOW_TOKEN"),
  "the GitHub workflow token must remain server-side");
assert.ok(blogAdmin.includes("published_snapshot") && blogAdmin.includes("has_unpublished_changes"),
  "blog-admin must isolate unpublished edits from the public snapshot");
assert.ok(blogAdmin.includes("hasMagicBytes") && blogAdmin.includes("MAX_IMAGE_BYTES"),
  "blog-admin must validate image signatures and upload size");
assert.ok(blogAdmin.includes("getPublicUrl(path)") && blogAdmin.includes('from(BLOG_BUCKET)'),
  "blog-admin must save optimized article images to the dedicated media bucket");
assert.ok(config.includes("[functions.blog-admin]") && config.includes("verify_jwt = false"),
  "blog-admin must keep the existing manual Auth and allowlist check");
assert.ok(blogAdminHtml.includes('name="robots" content="noindex, nofollow, noarchive"'),
  "blog admin must not be indexed");
assert.ok(blogPublicMigration.includes("security invoker"),
  "the public blog RPC must be a SECURITY INVOKER wrapper");
assert.ok(blogBrowserDenyMigration.includes("revoke all on table public.blog_posts from anon, authenticated"),
  "the browser must not query CMS tables directly");
assert.ok(blogSnapshotMigration.includes("p.published_snapshot"),
  "public posts must come from immutable publish snapshots");
assert.ok(blogSnapshotMigration.includes("p.status = 'published'"),
  "the public RPC must exclude drafts and archived posts");
assert.ok(blogAdminApp.includes("/auth/v1/token?grant_type=password"),
  "blog admin must use Supabase email and password auth");
assert.ok(!/localStorage|sessionStorage/.test(blogAdminApp),
  "blog admin must not persist session tokens in Web Storage");

console.log("Supabase contract passed: SDK pinning, Auth verification, admin allowlists, CORS, RLS grants and private CMS boundaries.");
