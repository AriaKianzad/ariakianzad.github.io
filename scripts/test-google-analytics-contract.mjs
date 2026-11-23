import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [functionSource, dashboard, html, css, blogAdmin, blogAdminHtml] = await Promise.all([
  read("supabase/functions/site-analytics/index.ts"),
  read("public/admin/app.js"),
  read("public/admin/index.html"),
  read("public/admin/admin.css"),
  read("public/admin/blog/app.js"),
  read("public/admin/blog/index.html"),
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
assert.ok(functionSource.includes("propertyTimeZone: summaryReport.metadata?.timeZone ?? null"),
  "GA4 diagnostics must record the property's reporting timezone");
assert.ok(functionSource.includes("emptyReason: summaryReport.metadata?.emptyReason ?? null"),
  "GA4 diagnostics must record Google's reason when a report is empty");
assert.ok(functionSource.includes("rowCount: report.rowCount"),
  "GA4 report parsing must preserve the API row count and metadata");
assert.ok(functionSource.includes('const dateRanges = [{ startDate: "29daysAgo", endDate: "today" }]'),
  "GA4 must include the current property-local day in the 30-day reporting window");
assert.ok(functionSource.includes("امروز ممکن است ناقص باشد"),
  "GA4 reporting period must disclose that the current day may be incomplete");

assert.ok(functionSource.includes("const summaryRows = summary.rows || []"),
  "Search Console summary rows must be inspected explicitly");
assert.ok(functionSource.includes("https://www.googleapis.com/webmasters/v3/sites"),
  "Search Console must enumerate properties visible to the service account before querying data");
assert.ok(functionSource.includes("interface SearchConsoleSitesResponse"),
  "Search Console property-list response must be typed");
assert.ok(functionSource.includes("const exactProperty = availableSites.find"),
  "Search Console must identify the configured URL-prefix property");
assert.ok(functionSource.includes("const domainProperty = availableSites.find"),
  "Search Console may fall back only to the same-host domain property when the URL-prefix property is absent");
assert.ok(functionSource.includes("propertyAccess: false"),
  "a missing Search Console property permission must be reported separately from an empty report");
assert.ok(functionSource.includes("propertyAccess: true"),
  "Search Console data responses must expose verified property access");
assert.ok(functionSource.includes('timeZone: "America/Los_Angeles"'),
  "Search Console date windows must use Pacific Time calendar days");
assert.ok(functionSource.includes('dimensions: ["date"]'),
  "Search Console must query date-dimension rows to diagnose when performance data exists");
assert.ok(functionSource.includes("firstDataDate") && functionSource.includes("lastDataDate"),
  "Search Console diagnostics must expose the first and last dates with returned data");
assert.ok(functionSource.includes("selectedSiteUrl"),
  "Search Console reports must query the exact property confirmed by the sites list");

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
assert.ok(functionSource.includes('dimensions: [{ name: "linkText" }, { name: "linkId" }]'),
  "GA4 download attribution must group by link text and retain Link ID when available");
assert.ok(functionSource.includes("downloadAttribution: downloadAttribution.map"),
  "GA4 response must expose download attribution rows");
assert.ok(functionSource.includes("bookPageSessions: Number(bookPage.sessions || 0)"),
  "GA4 response must expose book-page sessions for the funnel");
assert.ok(functionSource.includes("downloadSessions: Number(downloadFunnel.sessions || 0)"),
  "GA4 response must expose sessions that included a PDF download");
assert.ok(functionSource.includes("site-analytics Search Console report failed:"),
  "Search Console failures must be logged separately");
const diagnosticsStart = functionSource.indexOf('console.info("site-analytics report diagnostics"');
const diagnosticsEnd = functionSource.indexOf("return json({", diagnosticsStart);
const diagnosticBlock = functionSource.slice(diagnosticsStart, diagnosticsEnd);
assert.ok(diagnosticsStart >= 0 && diagnosticsEnd > diagnosticsStart,
  "diagnostic log block must be present");
assert.ok(!diagnosticBlock.includes("summary.users") && !diagnosticBlock.includes("totalUsers"),
  "server logs must not include visitor metric values");
assert.ok(!diagnosticBlock.includes("accessToken") && !diagnosticBlock.includes("private_key"),
  "server diagnostics must not log OAuth tokens or service-account key material");

assert.ok(dashboard.includes('no_data: "اتصال برقرار، بدون داده"'),
  "dashboard must distinguish a connected property with no performance rows from a failed connection");
assert.ok(dashboard.includes('gsc.propertyUrl ? " · Property: " + gsc.propertyUrl'),
  "dashboard must show which Search Console property returned the report");
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
assert.ok(html.includes('id="ga-download-attribution"') && html.includes('id="ga-book-funnel-title"'),
  "private dashboard must include download attribution and book funnel panels");
assert.ok(dashboard.includes("function renderDownloadAttribution(ga)") && dashboard.includes("function renderBookFunnel(ga)"),
  "dashboard must render the GA4 download attribution and funnel");
assert.ok(css.includes("overflow-x:clip") && css.includes(".table-scroll{display:block;width:100%;max-width:100%;min-width:0;"),
  "responsive dashboard must contain page overflow and keep wide tables in their own scroll container");
assert.ok(css.includes(".book-analytics-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))"),
  "download analytics panels must use minmax(0,1fr) responsive columns");
assert.ok(html.includes('id="gsc-period"'), "Search Console period label must exist in the page");
assert.ok(functionSource.includes(":runRealtimeReport"), "GA4 must use the dedicated Realtime Data API method");
assert.ok(functionSource.includes('{ name: "activeUsers" }'), "Realtime reports must expose active users");
assert.ok(functionSource.includes('{ name: "screenPageViews" }'), "Realtime reports must expose page views");
assert.ok(functionSource.includes('{ name: "eventCount" }'), "Realtime reports must expose event count");
assert.ok(functionSource.includes('requestMode === "realtime"'), "Realtime requests must avoid the full report path");
assert.ok(functionSource.includes('requestMode === "ga4"'), "standard GA4 refreshes must avoid Search Console calls");
assert.ok(functionSource.includes('requestMode === "articles"') && functionSource.includes("getArticleAnalyticsData") && functionSource.includes("blogSlugFromPath"), "private analytics function must return metrics mapped to each published article");
assert.ok(functionSource.includes('{ name: "landingPage" }') && functionSource.includes('{ name: "sessionSourceMedium" }') && functionSource.includes('{ name: "pagePath" }'), "per-article acquisition must use GA4 landing page and source/medium dimensions");
assert.ok(functionSource.includes("rowLimit: 25000") && functionSource.includes('dimensions: ["page"]'), "per-article Search Console metrics must query pages rather than only top-level totals");
assert.ok(blogAdminHtml.includes('id="view-analytics"') && blogAdminHtml.includes('id="refresh-article-analytics"'), "CMS must expose a refreshable article analytics view");
assert.ok(blogAdmin.includes('siteAnalytics("articles")') && blogAdmin.includes("function renderArticleAnalytics"), "CMS must call the authorized per-article analytics endpoint and render its result");
assert.ok(dashboard.includes("REALTIME_REFRESH_MS = 60_000"), "Realtime metrics must refresh every 60 seconds");
assert.ok(dashboard.includes("GA4_REPORT_REFRESH_MS = 15 * 60_000"), "standard GA4 reports must refresh every 15 minutes");
assert.ok(dashboard.includes('requestSiteAnalytics(false, "realtime")'), "dashboard must request live GA4 data");
assert.ok(dashboard.includes('document.addEventListener("visibilitychange"'), "dashboard must refresh when the page becomes visible");
assert.ok(dashboard.includes("stopAutoRefresh();"), "dashboard timers must stop on logout");
assert.ok(dashboard.includes("if (payload.searchConsole) {"), "GA4-only refreshes must not clear Search Console data");
assert.ok(dashboard.includes("formatNumber(summary.activeUsers)"), "Realtime values must use the localized number formatter");
assert.ok(css.includes('font:500 clamp(27px,3vw,36px)/1.35 Estedad,"Segoe UI",Tahoma,sans-serif'),
  "dashboard metric values must render in Estedad");
assert.ok(css.includes('td.number{direction:ltr;text-align:right;font:11px/1.7 Estedad'),
  "table numbers must render in Estedad");
assert.ok(css.includes('Estedad,"Segoe UI",Tahoma,sans-serif'),
  "dynamic numeric styles must use the local Estedad font");
assert.ok(html.includes('id="ga4-realtime-users"') && html.includes('id="ga4-realtime-views"') && html.includes('id="ga4-realtime-events"'),
  "Realtime metric elements must exist");
assert.ok(html.includes('id="ga4-updated"') && html.includes('id="ga4-realtime-updated"'),
  "GA4 update timestamps must be visible");
assert.ok(html.includes("admin.css?v=20261122-5"), "dashboard stylesheet cache key must be refreshed");
assert.ok(html.includes("app.js?v=20261122-6"), "dashboard script cache key must be refreshed");

console.log("Google reporting contract passed: true zero values remain zero, empty/partial reports are explicit, errors are surfaced, and date windows are visible.");
