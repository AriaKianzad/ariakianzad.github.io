import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_ORIGIN = "https://ariakianzad.github.io";
const GITHUB_RELEASE_API =
  "https://api.github.com/repos/AriaKianzad/ariakianzad.github.io/releases/tags/mian-e-ma-v1";
const ASSET_NAME = "Mian-e-Ma.pdf";
const RELEASE_URL =
  "https://github.com/AriaKianzad/ariakianzad.github.io/releases/tag/mian-e-ma-v1";
const TIME_ZONE = "Asia/Tehran";

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-secret",
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
  if (!value) throw new Error("Missing Edge Function secret: " + name);
  return value;
}

function getSecrets() {
  const publishableKeys = JSON.parse(requiredEnv("SUPABASE_PUBLISHABLE_KEYS"));
  const secretKeys = JSON.parse(requiredEnv("SUPABASE_SECRET_KEYS"));
  const publishableKey = publishableKeys.default;
  const secretKey = secretKeys.default;
  if (!publishableKey || !secretKey) {
    throw new Error("Supabase default publishable/secret keys are unavailable.");
  }
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL").replace(/\/+$/, ""),
    publishableKey,
    secretKey,
  };
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] || 0) ^ (b[index] || 0);
  }
  return mismatch === 0;
}

function dateInTehran(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return values.year + "-" + values.month + "-" + values.day;
}

function shiftDate(dateString: string, amount: number): string {
  const date = new Date(dateString + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function getGitHubDownloadCount(): Promise<number> {
  const response = await fetch(GITHUB_RELEASE_API, {
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Mian-e-Ma-Download-Dashboard",
    },
  });

  if (!response.ok) {
    throw new Error("GitHub API returned HTTP " + response.status + ".");
  }

  const release = await response.json();
  const asset = Array.isArray(release.assets)
    ? release.assets.find((item: { name?: string }) => item.name === ASSET_NAME)
    : null;

  if (!asset || !Number.isSafeInteger(Number(asset.download_count))) {
    throw new Error("The expected PDF asset was not found in the GitHub Release.");
  }

  return Number(asset.download_count);
}

async function isAllowedAdmin(
  authorization: string,
  secrets: ReturnType<typeof getSecrets>,
): Promise<boolean> {
  if (!authorization.startsWith("Bearer ")) return false;

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return false;

  const authClient = createClient(secrets.supabaseUrl, secrets.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return false;

  const email = data.user.email?.toLowerCase() || "";
  const confirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
  if (!confirmed || !email) return false;

  const adminClient = createClient(secrets.supabaseUrl, secrets.secretKey, {
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

async function saveSnapshot(
  admin: ReturnType<typeof createClient>,
  snapshotDate: string,
  totalDownloads: number,
): Promise<void> {
  const { error } = await admin
    .from("download_snapshots")
    .upsert({
      snapshot_date: snapshotDate,
      total_downloads: totalDownloads,
      recorded_at: new Date().toISOString(),
    }, { onConflict: "snapshot_date" });

  if (error) throw new Error("Could not save the daily snapshot: " + error.message);
}

async function readDailyHistory(
  admin: ReturnType<typeof createClient>,
  today: string,
  currentTotal: number,
) {
  const firstDate = shiftDate(today, -89);
  const baselineDate = shiftDate(firstDate, -1);

  const { data, error } = await admin
    .from("download_snapshots")
    .select("snapshot_date,total_downloads")
    .gte("snapshot_date", baselineDate)
    .lte("snapshot_date", today)
    .order("snapshot_date", { ascending: true });

  if (error) throw new Error("Could not read download history: " + error.message);

  const totals = new Map<string, number>();
  for (const row of data || []) {
    totals.set(row.snapshot_date, Number(row.total_downloads));
  }
  totals.set(today, currentTotal);

  let previousTotal = totals.has(baselineDate)
    ? Number(totals.get(baselineDate))
    : null;

  const history = [];
  for (let offset = 0; offset < 90; offset += 1) {
    const date = shiftDate(firstDate, offset);
    if (!totals.has(date)) {
      history.push({
        date,
        downloads: 0,
        totalDownloads: previousTotal ?? 0,
      });
      continue;
    }

    const dayTotal = Number(totals.get(date));
    const dailyDownloads = previousTotal === null
      ? 0
      : Math.max(0, dayTotal - previousTotal);

    history.push({
      date,
      downloads: dailyDownloads,
      totalDownloads: dayTotal,
    });
    previousTotal = dayTotal;
  }

  return history;
}

function sumFrom(history: Array<{ date: string; downloads: number }>, start: string) {
  return history
    .filter((row) => row.date >= start)
    .reduce((sum, row) => sum + Number(row.downloads || 0), 0);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const secrets = getSecrets();
    const admin = createClient(secrets.supabaseUrl, secrets.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const origin = request.headers.get("origin");
    if (origin && origin !== SITE_ORIGIN) {
      return json({ error: "Origin not allowed." }, 403);
    }

    const allowed = await isAllowedAdmin(
      request.headers.get("authorization") || "",
      secrets,
    );
    if (!allowed) {
      return json({ error: "You are not authorized to view this dashboard." }, 401);
    }

    const totalDownloads = await getGitHubDownloadCount();
    const today = dateInTehran(new Date());

    await saveSnapshot(admin, today, totalDownloads);
    const history = await readDailyHistory(admin, today, totalDownloads);

    return json({
      totalDownloads,
      todayDownloads: history[history.length - 1]?.downloads || 0,
      last7DaysDownloads: sumFrom(history, shiftDate(today, -6)),
      last30DaysDownloads: sumFrom(history, shiftDate(today, -29)),
      updatedAt: new Date().toISOString(),
      timeZone: TIME_ZONE,
      release: {
        tag: "mian-e-ma-v1",
        asset: ASSET_NAME,
        url: RELEASE_URL,
      },
      history,
    });
  } catch (error) {
    console.error("download-stats error:", error);
    return json({
      error: error instanceof Error ? error.message : "Unexpected dashboard error.",
    }, 500);
  }
});
