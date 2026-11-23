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

function field(body: Record<string, unknown>, key: string, max: number, required = false): string {
  const raw = body[key];
  const value = typeof raw === "string"
    ? raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim()
    : "";
  if (required && value.length === 0) throw new Error("لطفاً فیلدهای ضروری رو کامل کنید.");
  if (value.length > max) throw new Error("یکی از فیلدها بیش از حد طولانیه.");
  return value;
}

function optionalUrl(value: string, label: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid protocol");
    if (!url.hostname || url.username || url.password) throw new Error("invalid host");
    return url.toString();
  } catch {
    throw new Error("آدرس «" + label + "» معتبر نیست. آدرس کامل با https:// وارد کنید.");
  }
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

function clientIp(request: Request): string {
  const direct = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip");
  if (direct?.trim()) return direct.trim().slice(0, 100);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 100) : "unknown";
}

async function fingerprint(ip: string, secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(secret + ":" + ip);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(request: Request, supabaseUrl: string, serviceKey: string): Promise<boolean> {
  const ipHash = await fingerprint(clientIp(request), serviceKey);
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
    throw new Error("سرویس دریافت پیام موقتاً در دسترس نیست.");
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
    const websiteUrl = optionalUrl(field(body, "websiteUrl", 2048), "وب‌سایت");
    const targetUrl = optionalUrl(field(body, "targetUrl", 2048), "صفحۀ مقصد");
    const anchorText = field(body, "anchorText", 160);
    const sponsorshipDuration = field(body, "sponsorshipDuration", 32);
    const message = field(body, "message", 3000, true);
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
    const resendKey = readSecret("RESEND_API_KEY");
    const fromEmail = readSecret("BLOG_CONTACT_FROM_EMAIL");
    const toEmail = readSecret("BLOG_CONTACT_TO_EMAIL");

    if (!supabaseUrl || !serviceKey) {
      console.error("blog-contact missing Supabase server credentials");
      return json({ error: "سرویس دریافت پیام هنوز کامل پیکربندی نشده." }, 503);
    }
    if (!resendKey || !fromEmail || !toEmail) {
      console.error("blog-contact mail provider secrets are not configured");
      return json({ error: "اتصال ایمیل هنوز کامل پیکربندی نشده. لطفاً کمی بعد دوباره تلاش کنید." }, 503);
    }

    const permitted = await consumeRateLimit(request, supabaseUrl, serviceKey);
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
      ["صفحۀ مقصد", targetUrl || "—"],
      ["انکرتکست", anchorText || "—"],
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
      "\n\nتوضیحات:\n" + message +
      "\n\nیادآوری: لینک‌های درج‌شده در محتوای تبلیغاتی پولی با ویژگی sponsored یا nofollow مشخص می‌شوند.";

    const mailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + resendKey,
        "Content-Type": "application/json",
        "Idempotency-Key": submissionId,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: [email],
        subject,
        html,
        text: textBody,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const mailPayload = await mailResponse.json().catch(() => ({}));
    if (!mailResponse.ok) {
      console.error("blog-contact mail provider rejected request", { status: mailResponse.status });
      return json({ error: "ارسال ایمیل با خطا روبه‌رو شد. لطفاً کمی بعد دوباره تلاش کنید." }, 502);
    }

    console.info("blog-contact email accepted", {
      emailId: typeof mailPayload.id === "string" ? mailPayload.id : "unknown",
      requestType,
    });
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "درخواست ناموفق بود.";
    console.warn("blog-contact request rejected", { message: message.slice(0, 180) });
    return json({ error: message || "درخواست ناموفق بود." }, 400);
  }
});