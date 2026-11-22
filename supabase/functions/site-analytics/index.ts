import { createClient } from "@supabase/supabase-js";

const SITE_ORIGIN = "https://ariakianzad.github.io";
const GA4_PROPERTY_ID = "565407137";
const GSC_SITE_URL = "https://ariakianzad.github.io/";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");

let cachedGoogleAccessToken: { accessToken: string; expiresAt: number } | null = null;

interface GoogleAnalyticsValue {
  value?: string;
}

interface GoogleAnalyticsRow {
  dimensionValues?: GoogleAnalyticsValue[];
  metricValues?: GoogleAnalyticsValue[];
}

interface GoogleAnalyticsReport {
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rows?: GoogleAnalyticsRow[];
  rowCount?: number;
  metadata?: {
    timeZone?: string;
    emptyReason?: string;
    subjectToThresholding?: boolean;
    dataLossFromOtherRow?: boolean;
  };
}

interface SearchConsoleRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface SearchConsoleReport {
  rows?: SearchConsoleRow[];
}

interface GoogleApiErrorPayload {
  error?: string | { message?: string };
  error_description?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing Supabase environment variable: " + name);
  return value;
}

function getSupabaseKeys() {
  const publishableKeys = JSON.parse(requiredEnv("SUPABASE_PUBLISHABLE_KEYS"));
  const secretKeys = JSON.parse(requiredEnv("SUPABASE_SECRET_KEYS"));
  const publishableKey = publishableKeys.default;
  const secretKey = secretKeys.default;
  if (!publishableKey || !secretKey) {
    throw new Error("Supabase managed API keys are unavailable.");
  }
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL").replace(/\/+$/, ""),
    publishableKey,
    secretKey,
  };
}

async function isAllowedAdmin(authorization: string, keys: ReturnType<typeof getSupabaseKeys>) {
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return false;

  const authClient = createClient(keys.supabaseUrl, keys.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return false;

  const email = data.user.email?.toLowerCase() || "";
  const confirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
  if (!confirmed || !email) return false;

  const adminClient = createClient(keys.supabaseUrl, keys.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowedAdmin, error: allowlistError } = await adminClient
    .from("dashboard_admins")
    .select("email")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  return !allowlistError && Boolean(allowedAdmin);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getGoogleAccessToken() {
  const currentTime = Math.floor(Date.now() / 1000);
  if (cachedGoogleAccessToken && cachedGoogleAccessToken.expiresAt > currentTime + 60) {
    return { configured: true as const, accessToken: cachedGoogleAccessToken.accessToken };
  }

  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")?.trim();
  if (!raw) {
    return {
      configured: false as const,
      message: "Google service-account credentials have not been configured in Supabase yet.",
    };
  }

  let serviceAccount: {
    type?: string;
    client_email?: string;
    private_key?: string;
    token_uri?: string;
  };
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  if (
    serviceAccount.type !== "service_account" ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {
    throw new Error("The Google credential must be a service-account JSON key.");
  }

  const tokenUri = serviceAccount.token_uri || GOOGLE_TOKEN_URL;
  if (tokenUri !== GOOGLE_TOKEN_URL) {
    throw new Error("The Google service-account token URI is not the expected Google endpoint.");
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    encodeJson({ alg: "RS256", typ: "JWT" }),
    encodeJson({
      iss: serviceAccount.client_email,
      scope: GOOGLE_SCOPES,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  ].join(".");

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(unsigned),
    ),
  );
  const assertion = unsigned + "." + base64Url(signature);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(
      "Google OAuth token exchange failed: " +
      String(payload.error_description || payload.error || response.status).slice(0, 220),
    );
  }

  const accessToken = payload.access_token as string;
  const expiresIn = Number(payload.expires_in);
  cachedGoogleAccessToken = {
    accessToken,
    expiresAt: Math.floor(Date.now() / 1000) +
      (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600),
  };
  return { configured: true as const, accessToken };
}

async function googlePost<T extends object>(
  url: string,
  accessToken: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = payload && typeof payload === "object"
      ? payload as GoogleApiErrorPayload
      : {};
    const errorField = details.error;
    const apiMessage = errorField && typeof errorField === "object"
      ? errorField.message
      : errorField;
    const message = apiMessage || details.error_description || response.status;
    throw new Error("Google API HTTP " + response.status + ": " + String(message).slice(0, 260));
  }
  return payload as T;
}

function reportRows(report: GoogleAnalyticsReport): Array<Record<string, string | number>> {
  const dimensions = (report.dimensionHeaders || []).map((item) => item.name);
  const metrics = (report.metricHeaders || []).map((item) => item.name);
  return (report.rows || []).map((row) => {
    const result: Record<string, string | number> = {};
    dimensions.forEach((name: string, index: number) => {
      result[name] = row.dimensionValues?.[index]?.value ?? "";
    });
    metrics.forEach((name: string, index: number) => {
      const raw = row.metricValues?.[index]?.value ?? "0";
      result[name] = Number(raw);
    });
    return result;
  });
}

async function ga4Report(accessToken: string, body: unknown) {
  const url = "https://analyticsdata.googleapis.com/v1beta/properties/" +
    GA4_PROPERTY_ID + ":runReport";
  const report = await googlePost<GoogleAnalyticsReport>(url, accessToken, body);
  return {
    rows: reportRows(report),
    rowCount: report.rowCount,
    metadata: report.metadata,
  };
}

async function getRealtimeAnalyticsData(accessToken: string) {
  const url = "https://analyticsdata.googleapis.com/v1beta/properties/" +
    GA4_PROPERTY_ID + ":runRealtimeReport";
  const report = await googlePost<GoogleAnalyticsReport>(url, accessToken, {
    metrics: [
      { name: "activeUsers" },
      { name: "screenPageViews" },
      { name: "eventCount" },
    ],
  });
  const rows = reportRows(report);
  const summary = rows[0] || {};

  return {
    status: "ok",
    period: "۳۰ دقیقۀ اخیر",
    summary: {
      activeUsers: Number(summary.activeUsers || 0),
      pageViews: Number(summary.screenPageViews || 0),
      events: Number(summary.eventCount || 0),
    },
    diagnostics: { rows: rows.length, rowCount: report.rowCount ?? rows.length },
  };
}

function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function searchConsoleReport(
  accessToken: string,
  body: Record<string, unknown>,
) {
  const url = "https://www.googleapis.com/webmasters/v3/sites/" +
    encodeURIComponent(GSC_SITE_URL) + "/searchAnalytics/query";
  return googlePost<SearchConsoleReport>(url, accessToken, body);
}

async function getAnalyticsData(accessToken: string) {
  // Include the current GA4 property-local day. The dashboard chart showed traffic
  // on that day, while ending at yesterday excluded all of it. Today may be partial.
  const dateRanges = [{ startDate: "29daysAgo", endDate: "today" }];

  const [summaryReport, sourcesReport, pagesReport, referrersReport, downloadsReport] = await Promise.all([
    ga4Report(accessToken, {
      dateRanges,
      metrics: [
        { name: "totalUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagedSessions" },
      ],
      returnPropertyQuota: true,
    }),
    ga4Report(accessToken, {
      dateRanges,
      dimensions: [{ name: "sessionSourceMedium" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: "12",
    }),
    ga4Report(accessToken, {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: "10",
    }),
    ga4Report(accessToken, {
      dateRanges,
      dimensions: [{ name: "pageReferrer" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: "eventName",
                stringFilter: { matchType: "EXACT", value: "page_view" },
              },
            },
            {
              filter: {
                fieldName: "pagePath",
                stringFilter: { matchType: "CONTAINS", value: "/Mian-e-Ma/" },
              },
            },
          ],
        },
      },
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit: "12",
    }),
    ga4Report(accessToken, {
      dateRanges,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT", value: "file_download" },
        },
      },
    }),
  ]);

  const summaryRows = summaryReport.rows;
  const sources = sourcesReport.rows;
  const pages = pagesReport.rows;
  const referrers = referrersReport.rows;
  const downloads = downloadsReport.rows;
  const summaryAvailable = summaryRows.length > 0;
  const hasBreakdownRows = sources.length + pages.length + referrers.length + downloads.length > 0;
  const status = summaryAvailable ? "ok" : hasBreakdownRows ? "partial" : "no_data";
  const summary = summaryRows[0] || {};
  const downloadEventCount = Number(downloads[0]?.eventCount || 0);

  return {
    status,
    summaryAvailable,
    message: status === "no_data"
      ? "در بازۀ ۳۰ روز اخیر تا امروز (با احتساب روز جاری که ممکن است ناقص باشد) برای GA4 Property " + GA4_PROPERTY_ID + " هیچ ردیفی برنگشت. Property انتخاب‌شده و فعال‌بودن اندازه‌گیری در همین بازه را بررسی کن."
      : status === "partial"
      ? "گزارش خلاصۀ GA4 خالی برگشته، اما بعضی گزارش‌های جزئی داده دارند. اعداد خلاصه نمایش داده نمی‌شوند تا به‌اشتباه صفر تلقی نشوند."
      : "",
    period: "۳۰ روز اخیر تا امروز (امروز ممکن است ناقص باشد)",
    summary: {
      users: Number(summary.totalUsers || 0),
      sessions: Number(summary.sessions || 0),
      pageViews: Number(summary.screenPageViews || 0),
      engagedSessions: Number(summary.engagedSessions || 0),
      fileDownloadEvents: downloadEventCount,
    },
    sources: sources.map((row) => ({
      sourceMedium: String(row.sessionSourceMedium || "(not set)"),
      sessions: Number(row.sessions || 0),
      users: Number(row.totalUsers || 0),
    })),
    referrers: referrers.map((row) => ({
      referrer: String(row.pageReferrer || "(direct / unknown)"),
      events: Number(row.eventCount || 0),
    })),
    pages: pages.map((row) => ({
      path: String(row.pagePath || "(not set)"),
      views: Number(row.screenPageViews || 0),
      users: Number(row.totalUsers || 0),
    })),
    diagnostics: {
      summaryRows: summaryRows.length,
      summaryRowCount: summaryReport.rowCount ?? summaryRows.length,
      propertyTimeZone: summaryReport.metadata?.timeZone ?? null,
      emptyReason: summaryReport.metadata?.emptyReason ?? null,
      subjectToThresholding: summaryReport.metadata?.subjectToThresholding ?? false,
      dataLossFromOtherRow: summaryReport.metadata?.dataLossFromOtherRow ?? false,
      sourceRows: sources.length,
      pageRows: pages.length,
      referrerRows: referrers.length,
      downloadRows: downloads.length,
    },
    quota: null,
  };
}

async function getSearchConsoleData(accessToken: string) {
  // Search Console data is delayed; ending three days ago avoids relying on
  // potentially incomplete recent dates.
  const endDate = isoDateDaysAgo(3);
  const startDate = isoDateDaysAgo(32);
  const date = { startDate, endDate };

  const [summary, queries, pages, devices] = await Promise.all([
    searchConsoleReport(accessToken, date),
    searchConsoleReport(accessToken, { ...date, dimensions: ["query"], rowLimit: 10 }),
    searchConsoleReport(accessToken, { ...date, dimensions: ["page"], rowLimit: 10 }),
    searchConsoleReport(accessToken, { ...date, dimensions: ["device"], rowLimit: 5 }),
  ]);

  const summaryRows = summary.rows || [];
  const queryRows = queries.rows || [];
  const pageRows = pages.rows || [];
  const deviceRows = devices.rows || [];
  const summaryAvailable = summaryRows.length > 0;
  const hasBreakdownRows = queryRows.length + pageRows.length + deviceRows.length > 0;
  const status = summaryAvailable ? "ok" : hasBreakdownRows ? "partial" : "no_data";
  const totals = summaryRows[0] || {};
  const mapRows = (rows: SearchConsoleRow[] | undefined, key: string) => (rows || []).map((row) => ({
    name: String(row.keys?.[0] || "(نامشخص)"),
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0),
    key,
  }));

  return {
    status,
    summaryAvailable,
    message: status === "no_data"
      ? "در بازۀ " + startDate + " تا " + endDate + " هیچ ردیفی از Search Console برای " + GSC_SITE_URL + " برنگشت. Property و بازۀ زمانی را در Search Console بررسی کن."
      : status === "partial"
      ? "گزارش خلاصۀ Search Console خالی برگشته، اما بعضی گزارش‌های جزئی داده دارند. اعداد خلاصه نمایش داده نمی‌شوند تا به‌اشتباه صفر تلقی نشوند."
      : "",
    startDate,
    endDate,
    summary: {
      clicks: Number(totals.clicks || 0),
      impressions: Number(totals.impressions || 0),
      ctr: Number(totals.ctr || 0),
      position: Number(totals.position || 0),
    },
    queries: mapRows(queryRows, "query"),
    pages: mapRows(pageRows, "page"),
    devices: mapRows(deviceRows, "device"),
    diagnostics: {
      summaryRows: summaryRows.length,
      queryRows: queryRows.length,
      pageRows: pageRows.length,
      deviceRows: deviceRows.length,
    },
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== SITE_ORIGIN) return json({ error: "Origin not allowed." }, 403);

    const requestBody = await request.json().catch(() => ({}));
    const requestMode = requestBody?.mode === "realtime" || requestBody?.mode === "ga4"
      ? requestBody.mode
      : "dashboard";

    const supabaseKeys = getSupabaseKeys();
    const allowed = await isAllowedAdmin(
      request.headers.get("authorization") || "",
      supabaseKeys,
    );
    if (!allowed) {
      return json({ error: "You are not authorized to view this dashboard." }, 401);
    }

    const google = await getGoogleAccessToken();
    if (!google.configured) {
      const message = "برای فعال‌شدن گزارش‌های گوگل، کلید Service Account باید در Secrets پروژه Supabase ذخیره بشه.";
      if (requestMode === "realtime") {
        return json({
          status: "not_configured",
          message,
          ga4Realtime: { status: "not_configured", message },
        }, 424);
      }
      if (requestMode === "ga4") {
        return json({
          status: "not_configured",
          message,
          ga4: { status: "not_configured", message },
        }, 424);
      }
      return json({
        status: "not_configured",
        message,
        ga4: { status: "not_configured", message },
        searchConsole: { status: "not_configured", message },
      }, 424);
    }

    if (requestMode === "realtime") {
      const ga4Realtime = await getRealtimeAnalyticsData(google.accessToken);
      console.info("site-analytics realtime diagnostics", ga4Realtime.diagnostics);
      return json({
        generatedAt: new Date().toISOString(),
        propertyId: GA4_PROPERTY_ID,
        ga4Realtime,
      });
    }

    if (requestMode === "ga4") {
      const ga4 = await getAnalyticsData(google.accessToken);
      console.info("site-analytics GA4 refresh diagnostics", {
        status: ga4.status,
        ...ga4.diagnostics,
      });
      return json({
        generatedAt: new Date().toISOString(),
        propertyId: GA4_PROPERTY_ID,
        ga4,
      });
    }

    const [ga4Result, gscResult] = await Promise.allSettled([
      getAnalyticsData(google.accessToken),
      getSearchConsoleData(google.accessToken),
    ]);

    const ga4 = ga4Result.status === "fulfilled"
      ? ga4Result.value
      : { status: "error", message: String(ga4Result.reason?.message || ga4Result.reason) };
    const searchConsole = gscResult.status === "fulfilled"
      ? gscResult.value
      : { status: "error", message: String(gscResult.reason?.message || gscResult.reason) };

    // Log only report status and row counts. Never log visitor metrics, OAuth
    // tokens, service-account fields or raw Google API response bodies.
    console.info("site-analytics report diagnostics", {
      ga4: ga4Result.status === "fulfilled"
        ? { status: ga4.status, ...ga4.diagnostics }
        : { status: "error" },
      searchConsole: gscResult.status === "fulfilled"
        ? { status: searchConsole.status, ...searchConsole.diagnostics }
        : { status: "error" },
    });
    if (ga4Result.status === "rejected") {
      console.warn("site-analytics GA4 report failed:", String(ga4Result.reason?.message || ga4Result.reason).slice(0, 240));
    }
    if (gscResult.status === "rejected") {
      console.warn("site-analytics Search Console report failed:", String(gscResult.reason?.message || gscResult.reason).slice(0, 240));
    }

    return json({
      generatedAt: new Date().toISOString(),
      propertyId: GA4_PROPERTY_ID,
      searchConsoleSite: GSC_SITE_URL,
      ga4,
      searchConsole,
    });
  } catch (error) {
    console.error("site-analytics error:", error);
    return json({
      error: error instanceof Error ? error.message : "Unexpected analytics error.",
    }, 500);
  }
});
