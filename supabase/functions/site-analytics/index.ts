import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_ORIGIN = "https://ariakianzad.github.io";
const GA4_PROPERTY_ID = "565407137";
const GSC_SITE_URL = "https://ariakianzad.github.io/";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");

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

  return { configured: true as const, accessToken: payload.access_token as string };
}

async function googlePost(url: string, accessToken: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || payload.error_description || payload.error || response.status;
    throw new Error("Google API HTTP " + response.status + ": " + String(message).slice(0, 260));
  }
  return payload;
}

function reportRows(report: any) {
  const dimensions = (report.dimensionHeaders || []).map((item: any) => item.name);
  const metrics = (report.metricHeaders || []).map((item: any) => item.name);
  return (report.rows || []).map((row: any) => {
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
  return reportRows(await googlePost(url, accessToken, body));
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
  return googlePost(url, accessToken, body);
}

async function getAnalyticsData(accessToken: string) {
  const dateRanges = [{ startDate: "30daysAgo", endDate: "yesterday" }];

  const [summaryRows, sources, pages, referrers, downloads] = await Promise.all([
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

  const summary = summaryRows[0] || {};
  const downloadEventCount = Number(downloads[0]?.eventCount || 0);

  return {
    status: "ok",
    period: "30daysAgo–yesterday",
    summary: {
      users: Number(summary.totalUsers || 0),
      sessions: Number(summary.sessions || 0),
      pageViews: Number(summary.screenPageViews || 0),
      engagedSessions: Number(summary.engagedSessions || 0),
      fileDownloadEvents: downloadEventCount,
    },
    sources: sources.map((row: any) => ({
      sourceMedium: String(row.sessionSourceMedium || "(not set)"),
      sessions: Number(row.sessions || 0),
      users: Number(row.totalUsers || 0),
    })),
    referrers: referrers.map((row: any) => ({
      referrer: String(row.pageReferrer || "(direct / unknown)"),
      events: Number(row.eventCount || 0),
    })),
    pages: pages.map((row: any) => ({
      path: String(row.pagePath || "(not set)"),
      views: Number(row.screenPageViews || 0),
      users: Number(row.totalUsers || 0),
    })),
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

  const totals = (summary.rows || [])[0] || {};
  const mapRows = (rows: any[], key: string) => (rows || []).map((row: any) => ({
    name: String(row.keys?.[0] || "(نامشخص)"),
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    ctr: Number(row.ctr || 0),
    position: Number(row.position || 0),
    key,
  }));

  return {
    status: "ok",
    startDate,
    endDate,
    summary: {
      clicks: Number(totals.clicks || 0),
      impressions: Number(totals.impressions || 0),
      ctr: Number(totals.ctr || 0),
      position: Number(totals.position || 0),
    },
    queries: mapRows(queries.rows, "query"),
    pages: mapRows(pages.rows, "page"),
    devices: mapRows(devices.rows, "device"),
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
      return json({
        status: "not_configured",
        message: "برای فعال‌شدن گزارش‌های گوگل، کلید Service Account باید در Secrets پروژه Supabase ذخیره بشه.",
        ga4: { status: "not_configured" },
        searchConsole: { status: "not_configured" },
      }, 424);
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
