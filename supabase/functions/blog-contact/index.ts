const SITE_ORIGIN = "https://ariakianzad.github.io";
const MAX_BODY_BYTES = 12 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

const requestLabels: Record<string, string> = {
  advertorial: "رپورتاژ یا محتوای تبلیغاتی",
  editorial_link: "بررسی ارجاع تحریریه‌ای Follow بدون پرداخت بابت لینک",
  sponsorship: "اسپانسری دوره‌ای",
  collaboration: "همکاری محتوایی یا حرفه‌ای",
  general: "پیام عمومی یا موضوع دیگر",
};

const durationLabels: Record<string, string> = {
  one_month: "یک ماه",
  three_months: "سه ماه",
  six_months: "شش ماه",
  annual: "یک سال",
  open: "قابل گفت‌وگو",
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

function readSecret(name: string): string {
  return (Deno.env.get(name) || "").trim();
}

function supabaseSecretKey(): string {
  const raw = readSecret("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.default === "string" && parsed.default.trim()) return parsed.default.trim();
    } catch {
      // Fall back to the legacy server-only key below.
    }
  }
  return readSecret("SUPABASE_SERVICE_ROLE_KEY");
}

function field(
  body: Record<string, unknown>,
  key: string,
  max: number,
  required = false,
  singleLine = true,
): string {
  const raw = body[key];
  const value = typeof raw === "string"
    ? (singleLine
      ? raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      : raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " "))
      .trim()
    : "";
  if (required && value.length === 0) throw new Error("لطفاً فیلدهای ضروری رو کامل کنید.");
  if (value.length > max) throw new Error("یکی از فیلدها بیش از حد طولانیه.");
  return value;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[character];
  });
}

function clientIp(request: Request): string | null {
  // Only trust the address supplied by Cloudflare's managed ingress.
  // Never collapse missing addresses into one shared "unknown" rate-limit bucket.
  const direct = request.headers.get("cf-connecting-ip")?.trim();
  if (!direct || direct.length > 64 || /[,;\s]/.test(direct)) return null;
  return direct.toLowerCase();
}

class ServiceUnavailableError extends Error {}

async function fingerprint(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstileToken(token: string, clientAddress: string): Promise<boolean> {
  const secret = readSecret("CLOUDFLARE_TURNSTILE_SECRET_KEY");
  // Until both the public site key and this server-only secret are configured,
  // the existing honeypot and IP rate limit remain active.
  if (!secret) return token.length === 0;
  if (!token || token.length > 2048) return false;

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  form.set("remoteip", clientAddress);

  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ServiceUnavailableError("بررسی امنیتی موقتاً در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید.");
  }
  if (!response.ok) {
    throw new ServiceUnavailableError("بررسی امنیتی موقتاً در دسترس نیست. لطفاً کمی بعد دوباره تلاش کنید.");
  }

  const result = await response.json().catch(() => null) as {
    success?: boolean;
    hostname?: string;
    action?: string;
  } | null;

  return result?.success === true
    && result.hostname === new URL(SITE_ORIGIN).hostname
    && result.action === "blog_contact";
}

async function consumeRateLimit(clientAddress: string, supabaseUrl: string, serviceKey: string): Promise<boolean> {
  const ipHash = await fingerprint(clientAddress, serviceKey);
  const response = await fetch(supabaseUrl + "/rest/v1/rpc/consume_blog_contact_rate_limit", {
    method: "POST",
    headers: {
      apikey: serviceKey,
      "Content-Type": "application/json",
      "Content-Profile": "public",
      "Accept-Profile": "public",
    },
    body: JSON.stringify({ p_fingerprint: ipHash }),
  });
  if (!response.ok) {
    console.error("blog-contact rate limiter failed", { status: response.status });
    throw new ServiceUnavailableError("سرویس دریافت پیام موقتاً در دسترس نیست.");
  }
  return await response.json().catch(() => false) === true;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (origin !== SITE_ORIGIN) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (origin !== SITE_ORIGIN) return json({ error: "Origin not allowed." }, 403);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return json({ error: "فرمت درخواست معتبر نیست." }, 415);
  }

  try {
    const declaredSize = Number(request.headers.get("content-length") || 0);
    if (declaredSize > MAX_BODY_BYTES) return json({ error: "حجم درخواست بیش از حد مجازه." }, 413);

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "حجم درخواست بیش از حد مجازه." }, 413);
    }

    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "محتوای درخواست معتبر نیست." }, 400);
    }
    const body = parsed as Record<string, unknown>;

    // A filled honeypot receives a generic success response without generating an email.
    if (field(body, "companyFax", 120)) return json({ ok: true });

    const name = field(body, "name", 100, true);
    const email = field(body, "email", 254, true).toLowerCase();
    const organization = field(body, "organization", 140);
    const requestType = field(body, "requestType", 24, true);
    const websiteUrl = field(body, "websiteUrl", 2048);
    const sponsorshipDuration = field(body, "sponsorshipDuration", 32);
    const message = field(body, "message", 3000, true, false);
    const submissionId = field(body, "submissionId", 80, true);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return json({ error: "آدرس ایمیل معتبر نیست." }, 400);
    }
    if (name.length < 2 || message.length < 20) {
      return json({ error: "نام و توضیحات درخواست رو کامل‌تر وارد کنید." }, 400);
    }
    if (!Object.prototype.hasOwnProperty.call(requestLabels, requestType)) {
      return json({ error: "نوع درخواست معتبر نیست." }, 400);
    }
    if (requestType === "sponsorship" && !Object.prototype.hasOwnProperty.call(durationLabels, sponsorshipDuration)) {
      return json({ error: "مدت اسپانسری معتبر نیست." }, 400);
    }
    if (!/^[0-9a-f-]{20,80}$/i.test(submissionId)) {
      return json({ error: "شناسهٔ ارسال معتبر نیست." }, 400);
    }

    const supabaseUrl = readSecret("SUPABASE_URL").replace(/\/+$/, "");
    const serviceKey = supabaseSecretKey();
    const appsScriptUrl = readSecret("GOOGLE_APPS_SCRIPT_URL");
    const appsScriptToken = readSecret("GOOGLE_APPS_SCRIPT_TOKEN");

    if (!supabaseUrl || !serviceKey) {
      console.error("blog-contact missing Supabase server credentials");
      return json({ error: "سرویس دریافت پیام هنوز کامل پیکربندی نشده." }, 503);
    }
    if (!appsScriptUrl || !appsScriptToken) {
      console.error("blog-contact Google Apps Script secrets are not configured");
      return json({ error: "اتصال ایمیل Gmail هنوز کامل پیکربندی نشده. لطفاً کمی بعد دوباره تلاش کنید." }, 503);
    }
    let scriptUrl: URL;
    try {
      scriptUrl = new URL(appsScriptUrl);
    } catch {
      return json({ error: "نشانی سرویس ایمیل معتبر نیست." }, 503);
    }
    if (scriptUrl.protocol !== "https:" || scriptUrl.hostname !== "script.google.com" || !scriptUrl.pathname.includes("/macros/s/")) {
      return json({ error: "نشانی Google Apps Script معتبر نیست." }, 503);
    }

    const address = clientIp(request);
    if (!address) {
      return json({ error: "امکان بررسی امن درخواست در حال حاضر وجود نداره. لطفاً کمی بعد دوباره تلاش کنید." }, 503);
    }

    const turnstileToken = field(body, "cf-turnstile-response", 2048);
    if (!await verifyTurnstileToken(turnstileToken, address)) {
      return json({ error: "لطفاً بررسی امنیتی رو کامل کنید و دوباره درخواست رو بفرستید." }, 403);
    }

    const permitted = await consumeRateLimit(address, supabaseUrl, serviceKey);
    if (!permitted) return json({ error: "تعداد درخواست‌ها از این شبکه بیش از حد مجازه. لطفاً یک ساعت دیگه دوباره تلاش کنید." }, 429);

    const requestLabel = requestLabels[requestType];
    const durationLabel = requestType === "sponsorship" ? (durationLabels[sponsorshipDuration] || "—") : "—";
    const subject = "[درخواست وبلاگ] " + requestLabel + " | " + name;
    const rows = [
      ["نام", name],
      ["ایمیل", email],
      ["برند یا مجموعه", organization || "—"],
      ["نوع درخواست", requestLabel],
      ["وب‌سایت", websiteUrl || "—"],
      ["مدت اسپانسری", durationLabel],
    ];
    const htmlRows = rows.map(([label, value]) =>
      "<tr><th style=\"padding:9px 12px;text-align:right;background:#f4f1e9;color:#405653;white-space:nowrap\">" +
      escapeHtml(label) + "</th><td style=\"padding:9px 12px;border-bottom:1px solid #e4dfd3\">" +
      escapeHtml(value) + "</td></tr>"
    ).join("");
    const html = "<div dir=\"rtl\" style=\"font-family:Tahoma,Arial,sans-serif;color:#1d3432;line-height:2\">" +
      "<h2>درخواست جدید از وبلاگ آریا کیانزاد</h2>" +
      "<table style=\"border-collapse:collapse;width:100%;max-width:680px\">" + htmlRows + "</table>" +
      "<h3>توضیحات</h3><p style=\"white-space:pre-wrap\">" + escapeHtml(message) + "</p>" +
      "<hr><p style=\"font-size:12px;color:#777f77\">برای پاسخ مستقیم، به همین ایمیل Reply کنید.</p></div>";
    const textBody = rows.map(([label, value]) => label + ": " + value).join("\n") +
      "\n\nتوضیحات:\n" + message;

    const mailResponse = await fetch(scriptUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: appsScriptToken,
        submissionId,
        subject,
        html,
        text: textBody,
        replyTo: email,
      }),
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    const scriptPayload = await mailResponse.json().catch(() => ({}));
    if (!mailResponse.ok || scriptPayload.ok !== true) {
      console.error("blog-contact Gmail delivery rejected", {
        status: mailResponse.status,
        reason: typeof scriptPayload.error === "string" ? scriptPayload.error.slice(0, 120) : "unknown",
      });
      return json({
        error: typeof scriptPayload.error === "string"
          ? scriptPayload.error
          : "ارسال ایمیل از طریق Gmail با خطا روبه‌رو شد. لطفاً دوباره تلاش کنید.",
      }, 502);
    }

    console.info("blog-contact email accepted through Gmail", { requestType });
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "درخواست ناموفق بود.";
    console.warn("blog-contact request rejected", { message: message.slice(0, 180) });
    const status = error instanceof ServiceUnavailableError ? 503 : 400;
    return json({ error: message || "درخواست ناموفق بود." }, status);
  }
});