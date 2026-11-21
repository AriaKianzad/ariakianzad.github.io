import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [functionSource, dashboard, html] = await Promise.all([
  read("supabase/functions/site-analytics/index.ts"),
  read("public/admin/app.js"),
  read("public/admin/index.html"),
]);

// A successful Google API call with a real summary row may legitimately return
// zero. An empty result must not silently become a valid zero-valued summary.
assert.ok(functionSource.includes("const summaryAvailable = summaryRows.length > 0"),
  "GA4 must track whether the summary endpoint returned an actual row");
assert.ok(functionSource.includes('const status = summaryAvailable ? "ok" : hasBreakdownRows ? "partial" : "no_data"'),
  "GA4 must distinguish valid data, partial data and no rows");
assert.ok(functionSource.includes("summaryAvailable,"),
  "GA4 response must expose summary-row availability");
assert.ok(functionSource.includes("summaryRows: summaryRows.length"),
  "GA4 diagnostics must record the summary row count");

assert.ok(functionSource.includes("const summaryRows = summary.rows || []"),
  "Search Console summary rows must be inspected explicitly");
assert.ok(functionSource.includes('const status = summaryAvailable ? "ok" : hasBreakdownRows ? "partial" : "no_data"'),
  "Search Console must distinguish valid data, partial data and no rows");
assert.ok(functionSource.includes("summaryAvailable,"),
  "Search Console response must expose summary-row availability");
assert.ok(functionSource.includes("queryRows: queryRows.length"),
  "Search Console diagnostics must record detail-row counts");

assert.ok(functionSource.includes("site-analytics report diagnostics"),
  "Edge Function must emit safe report diagnostics");
assert.ok(functionSource.includes("site-analytics GA4 report failed:"),
  "GA4 failures must be logged separately");
assert.ok(functionSource.includes("site-analytics Search Console report failed:"),
  "Search Console failures must be logged separately");
assert.ok(!functionSource.includes("summary.users"),
  "server logs must not include visitor metric values");
assert.ok(!functionSource.includes("accessToken"),
  "server diagnostics must not log OAuth access tokens");

assert.ok(dashboard.includes('no_data: "بدون داده در این بازه"'),
  "dashboard must show a distinct no-data state");
assert.ok(dashboard.includes('partial: "گزارش ناقص"'),
  "dashboard must show partial reports distinctly");
assert.ok(dashboard.includes('summaryAvailable ? formatNumber(summary.users) : "—"'),
  "an absent GA4 summary must display a dash rather than a false zero");
assert.ok(dashboard.includes('summaryAvailable ? formatNumber(summary.clicks) : "—"'),
  "an absent Search Console summary must display a dash rather than a false zero");
assert.ok(dashboard.includes('payload.status === "error" && !payload.ga4 && !payload.searchConsole'),
  "top-level Edge Function failures must be shown instead of disappearing into empty status badges");
assert.ok(dashboard.includes('"بازهٔ گزارش GA4: " + ga.period'),
  "dashboard must show the GA4 report period");
assert.ok(dashboard.includes('"بازهٔ گزارش Search Console: " + gsc.startDate'),
  "dashboard must show the exact Search Console report period");

assert.ok(html.includes('id="ga4-period"'), "GA4 period label must exist in the page");
assert.ok(html.includes('id="gsc-period"'), "Search Console period label must exist in the page");
assert.ok(html.includes("app.js?v=20261122-2"), "dashboard script cache key must be refreshed");

console.log("Google reporting contract passed: true zero values remain zero, empty/partial reports are explicit, errors are surfaced, and date windows are visible.");
