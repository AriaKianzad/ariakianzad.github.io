import { createClient } from "@supabase/supabase-js";

const SITE_ORIGIN = "https://ariakianzad.github.io";
const MAX_BODY_BYTES = 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Headers": "apikey, content-type",
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

function secret(name: string): string {
  return (Deno.env.get(name) || "").trim();
}

function serviceKey(): string {
  const managed = secret("SUPABASE_SECRET_KEYS");
  if (managed) {
    try {
      const parsed = JSON.parse(managed) as Record<string, unknown>;
      if (typeof parsed.default === "string" && parsed.default.trim()) {
        return parsed.default.trim();
      }
    } catch {
      // Fall back to the legacy server-only key.
    }
  }
  return secret("SUPABASE_SERVICE_ROLE_KEY");
}

function trustedClientIp(request: Request): string {
  // Only trust the managed ingress header. Never trust X-Forwarded-For or
  // other forwarding headers supplied directly by a browser.
  const value = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  if (value.length > 64 || /[,;\s]/.test(value)) return "unknown";
  return value.toLowerCase();
}

async function fingerprint(ip: string, keyMaterial: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    if (origin !== SITE_ORIGIN) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (origin !== SITE_ORIGIN) return json({ error: "Origin not allowed." }, 403);
  const requestContentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!requestContentType.includes("application/json") && !requestContentType.includes("text/plain")) {
    return json({ error: "Unsupported content type." }, 415);
  }

  try {
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (declaredSize > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413);

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "Request too large." }, 413);
    }

    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "Invalid request body." }, 400);
    }

    const bannerId = (parsed as Record<string, unknown>).banner_id;
    if (typeof bannerId !== "string" || !/^banner-[1-9][0-9]*$/.test(bannerId)) {
      return json({ error: "Invalid banner ID." }, 400);
    }

    const supabaseUrl = secret("SUPABASE_URL").replace(/\/+$/, "");
    const key = serviceKey();
    if (!supabaseUrl || !key) {
      console.error("blog-ad-click is missing Supabase server credentials");
      return json({ error: "Click tracking is temporarily unavailable." }, 503);
    }

    const ipHash = await fingerprint(trustedClientIp(request), key);
    const client = createClient(supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc("record_blog_ad_click", {
      p_banner_id: bannerId,
      p_fingerprint: ipHash,
    });

    if (error) {
      console.error("blog-ad-click database request failed", { code: error.code || "unknown" });
      return json({ error: "Click could not be recorded." }, 503);
    }

    // Do not expose the absolute click total publicly; only the admin panel can read it.
    return json({ ok: true, counted: data !== null && data !== undefined }, 202);
  } catch {
    return json({ error: "Invalid click request." }, 400);
  }
});
