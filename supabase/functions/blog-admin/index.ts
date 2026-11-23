import { createClient } from "@supabase/supabase-js";

const SITE_ORIGIN = "https://ariakianzad.github.io";
const BLOG_REPO = "AriaKianzad/ariakianzad.github.io";
const BLOG_WORKFLOW = "deploy.yml";
const BLOG_BUCKET = "blog-media";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MEDIA_PREFIX = "https://bkohdqwecnvbmeaiuyyx.supabase.co/storage/v1/object/public/blog-media/";

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
  if (!publishableKeys.default || !secretKeys.default) {
    throw new Error("Supabase managed API keys are unavailable.");
  }
  return {
    url: requiredEnv("SUPABASE_URL").replace(/\/+$/, ""),
    publishableKey: publishableKeys.default,
    secretKey: secretKeys.default,
  };
}

async function authorizeAdmin(authorization: string, keys: ReturnType<typeof getSupabaseKeys>) {
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  const authClient = createClient(keys.url, keys.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;

  const email = (data.user.email || "").toLowerCase();
  const confirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
  if (!email || !confirmed) return null;

  const adminClient = createClient(keys.url, keys.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: allowlistError } = await adminClient
    .from("dashboard_admins")
    .select("email")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (allowlistError || !allowed) return null;
  return { user: data.user, admin: adminClient };
}

function cleanText(value: unknown, max: number, label: string, required = false): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw new Error(label + " الزامی است.");
  if (text.length > max) throw new Error(label + " بیش از حد مجاز طولانی است.");
  return text;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isAllowedMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  return value.startsWith(MEDIA_PREFIX) && !value.includes("..");
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = value.slice(0, 25)
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter((item) => item.length > 0)
    .map((item) => item.slice(0, 40));
  return [...new Set(tags)];
}

function normalizeFaqs(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.length > 30) throw new Error("حداکثر ۳۰ پرسش متداول مجاز است.");
  return value.map((item: any) => ({
    question: cleanText(item?.question, 240, "پرسش", true),
    answer: cleanText(item?.answer, 2400, "پاسخ", true),
  }));
}

function normalizePost(input: any) {
  const slug = cleanText(input?.slug, 120, "نامک", true).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("نامک باید انگلیسی و شامل حروف کوچک، عدد و خط تیره باشد.");
  }
  const language = input?.language === "en" ? "en" : "fa";
  const accentColor = input?.accent_color || "#a86f54";
  if (!isHexColor(accentColor)) throw new Error("رنگ تأکیدی معتبر نیست.");
  const heroImage = input?.hero_image_url || "";
  const ogImage = input?.og_image_url || "";
  if (heroImage && !isAllowedMediaUrl(heroImage)) throw new Error("آدرس تصویر اصلی معتبر نیست.");
  if (ogImage && !isAllowedMediaUrl(ogImage)) throw new Error("آدرس تصویر اجتماعی معتبر نیست.");

  const canonical = cleanText(input?.canonical_url, 500, "Canonical URL");
  if (canonical) {
    let parsed: URL;
    try { parsed = new URL(canonical); } catch { throw new Error("Canonical URL معتبر نیست."); }
    if (parsed.origin !== SITE_ORIGIN || !canonical.startsWith(SITE_ORIGIN + "/blog/")) {
      throw new Error("Canonical URL باید متعلق به همین وب‌سایت و مسیر بلاگ باشد.");
    }
  }

  return {
    slug,
    title: cleanText(input?.title, 180, "عنوان مقاله", true),
    excerpt: cleanText(input?.excerpt, 700, "خلاصه"),
    content: cleanText(input?.content, 180000, "محتوای مقاله"),
    language,
    category: cleanText(input?.category, 80, "دسته‌بندی"),
    tags: normalizeTags(input?.tags),
    hero_image_url: heroImage || null,
    hero_image_alt: cleanText(input?.hero_image_alt, 240, "متن جایگزین تصویر"),
    hero_image_caption: cleanText(input?.hero_image_caption, 400, "زیرنویس تصویر"),
    og_image_url: ogImage || null,
    seo_title: cleanText(input?.seo_title, 75, "عنوان SEO"),
    meta_description: cleanText(input?.meta_description, 320, "توضیحات متا"),
    focus_keyword: cleanText(input?.focus_keyword, 120, "کلمه کلیدی"),
    canonical_url: canonical,
    og_title: cleanText(input?.og_title, 100, "عنوان شبکه‌های اجتماعی"),
    og_description: cleanText(input?.og_description, 300, "توضیحات شبکه‌های اجتماعی"),
    robots_index: input?.robots_index !== false,
    robots_follow: input?.robots_follow !== false,
    featured: Boolean(input?.featured),
    toc_enabled: input?.toc_enabled !== false,
    drop_cap: Boolean(input?.drop_cap),
    content_width: input?.content_width === "wide" ? "wide" : "reading",
    accent_color: accentColor,
    faqs: normalizeFaqs(input?.faqs),
  };
}

async function requireWorkflowToken() {
  const token = Deno.env.get("GITHUB_WORKFLOW_TOKEN")?.trim();
  if (!token) {
    throw new Error("برای انتشار خودکار، GitHub token هنوز در Secrets تابع blog-admin تنظیم نشده است.");
  }
  return token;
}

async function dispatchBuild() {
  const token = await requireWorkflowToken();
  const response = await fetch(
    "https://api.github.com/repos/" + BLOG_REPO + "/actions/workflows/" + BLOG_WORKFLOW + "/dispatches",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );
  if (!response.ok) {
    throw new Error("GitHub نتوانست انتشار را آغاز کند (HTTP " + response.status + ").");
  }
}

function hasMagicBytes(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  if (mime === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/png") {
    return bytes.length >= 8 &&
      [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value);
  }
  return false;
}

async function uploadImage(request: Request, admin: any) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("فایلی برای بارگذاری انتخاب نشده است.");
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("حجم تصویر باید کمتر از ۳ مگابایت باشد.");
  }
  const mime = file.type.toLowerCase();
  if (!["image/webp", "image/jpeg", "image/png"].includes(mime)) {
    throw new Error("فرمت تصویر پشتیبانی نمی‌شود. WebP پیشنهاد می‌شود.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasMagicBytes(bytes, mime)) throw new Error("محتوای فایل با نوع تصویر اعلام‌شده مطابقت ندارد.");

  const extension = mime === "image/webp" ? "webp" : mime === "image/png" ? "png" : "jpg";
  const path = "uploads/" + crypto.randomUUID() + "." + extension;
  const { error } = await admin.storage.from(BLOG_BUCKET).upload(path, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error("بارگذاری تصویر ناموفق بود.");
  const { data } = admin.storage.from(BLOG_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, mimeType: mime, bytes: file.size };
}

async function runAction(action: string, body: any, admin: any) {
  if (action === "list_posts") {
    const { data, error } = await admin.from("blog_posts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("دریافت مقاله‌ها ناموفق بود.");
    return { posts: data || [] };
  }

  if (action === "get_settings") {
    const { data, error } = await admin.from("blog_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error("دریافت تنظیمات بلاگ ناموفق بود.");
    return { settings: data };
  }

  if (action === "save_post") {
    const post = normalizePost(body?.post);
    const id = typeof body?.post?.id === "string" ? body.post.id : "";
    let previous: any = null;
    if (id) {
      const result = await admin.from("blog_posts").select("id,status,published_at").eq("id", id).maybeSingle();
      if (result.error) throw new Error("دریافت نسخۀ قبلی مقاله ناموفق بود.");
      previous = result.data;
      if (!previous) throw new Error("مقاله موردنظر پیدا نشد.");
    }
    const row: any = {
      ...post,
      status: previous?.status === "published" ? "published" : "draft",
      published_at: previous?.published_at || null,
      has_unpublished_changes: previous?.status === "published",
      updated_at: new Date().toISOString(),
    };
    if (id) row.id = id;
    const { data, error } = await admin.from("blog_posts").upsert(row, { onConflict: "id" }).select("*").single();
    if (error) {
      if (error.code === "23505") throw new Error("این نامک قبلاً برای مقالۀ دیگری استفاده شده است.");
      throw new Error("ذخیرۀ مقاله ناموفق بود.");
    }
    return { post: data };
  }

  if (action === "publish_post") {
    await requireWorkflowToken();
    const id = cleanText(body?.id, 64, "شناسه مقاله", true);
    const existing = await admin.from("blog_posts").select("*").eq("id", id).maybeSingle();
    if (existing.error || !existing.data) throw new Error("مقاله موردنظر پیدا نشد.");
    const current = existing.data;
    if (!current.title || !current.slug || !current.content.trim()) {
      throw new Error("برای انتشار، عنوان، نامک و محتوای مقاله باید تکمیل باشند.");
    }
    const { data, error } = await admin.from("blog_posts").update({
      status: "published",
      published_at: current.published_at || new Date().toISOString(),
      has_unpublished_changes: false,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").single();
    if (error) throw new Error("ثبت وضعیت انتشار ناموفق بود.");
    await dispatchBuild();
    return { post: data, buildDispatched: true };
  }

  if (action === "unpublish_post" || action === "archive_post") {
    await requireWorkflowToken();
    const id = cleanText(body?.id, 64, "شناسه مقاله", true);
    const status = action === "archive_post" ? "archived" : "draft";
    const { data, error } = await admin.from("blog_posts").update({
      status,
      has_unpublished_changes: false,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").single();
    if (error || !data) throw new Error("تغییر وضعیت مقاله ناموفق بود.");
    await dispatchBuild();
    return { post: data, buildDispatched: true };
  }

  if (action === "delete_post") {
    const id = cleanText(body?.id, 64, "شناسه مقاله", true);
    const existing = await admin.from("blog_posts").select("id,status").eq("id", id).maybeSingle();
    if (existing.error || !existing.data) throw new Error("مقاله موردنظر پیدا نشد.");
    if (existing.data.status === "published") throw new Error("ابتدا مقالۀ منتشرشده را از انتشار خارج کن.");
    const { error } = await admin.from("blog_posts").delete().eq("id", id);
    if (error) throw new Error("حذف مقاله ناموفق بود.");
    return { deleted: true };
  }

  if (action === "save_settings") {
    await requireWorkflowToken();
    const input = body?.settings || {};
    if (!isHexColor(input.accent_color || "#a86f54")) throw new Error("رنگ تأکیدی معتبر نیست.");
    const themes = ["paper", "white", "warm"];
    const cards = ["editorial", "minimal", "image-led"];
    const layouts = ["editorial", "minimal", "magazine"];
    const contentWidths = ["reading", "wide"];
    const languages = ["fa", "en"];
    const settings: any = {
      id: 1,
      title: cleanText(input.title, 100, "عنوان بلاگ", true),
      tagline: cleanText(input.tagline, 180, "زیرعنوان بلاگ"),
      description: cleanText(input.description, 500, "توضیحات بلاگ"),
      background_theme: themes.includes(input.background_theme) ? input.background_theme : "paper",
      accent_color: input.accent_color || "#a86f54",
      card_style: cards.includes(input.card_style) ? input.card_style : "editorial",
      layout_style: layouts.includes(input.layout_style) ? input.layout_style : "editorial",
      content_width: contentWidths.includes(input.content_width) ? input.content_width : "reading",
      posts_per_page: Math.min(24, Math.max(3, Number(input.posts_per_page) || 9)),
      show_search: input.show_search !== false,
      show_categories: input.show_categories !== false,
      show_featured: input.show_featured !== false,
      show_reading_time: input.show_reading_time !== false,
      show_toc: input.show_toc !== false,
      show_related_posts: input.show_related_posts !== false,
      show_share: input.show_share !== false,
      enable_rss: input.enable_rss !== false,
      default_language: languages.includes(input.default_language) ? input.default_language : "fa",
      heading_scale: Math.min(1.2, Math.max(0.85, Number(input.heading_scale) || 1)),
      body_line_height: Math.min(2.4, Math.max(1.6, Number(input.body_line_height) || 1.95)),
      intro_title: cleanText(input.intro_title, 180, "عنوان معرفی"),
      intro_body: cleanText(input.intro_body, 600, "متن معرفی"),
      default_meta_title: cleanText(input.default_meta_title, 75, "عنوان متای پیش‌فرض"),
      default_meta_description: cleanText(input.default_meta_description, 320, "توضیحات متای پیش‌فرض"),
      default_og_image: input.default_og_image || "",
      footer_note: cleanText(input.footer_note, 200, "متن پابرگ"),
      updated_at: new Date().toISOString(),
    };
    if (settings.default_og_image && !isAllowedMediaUrl(settings.default_og_image)) {
      throw new Error("تصویر پیش‌فرض شبکه‌های اجتماعی باید از کتابخانۀ رسانه بلاگ باشد.");
    }
    const { data, error } = await admin.from("blog_settings")
      .upsert(settings, { onConflict: "id" }).select("*").single();
    if (error) throw new Error("ذخیرۀ تنظیمات بلاگ ناموفق بود.");
    await dispatchBuild();
    return { settings: data, buildDispatched: true };
  }

  throw new Error("درخواست ناشناخته است.");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== SITE_ORIGIN) return json({ error: "Origin not allowed." }, 403);

    const keys = getSupabaseKeys();
    const session = await authorizeAdmin(request.headers.get("authorization") || "", keys);
    if (!session) return json({ error: "این حساب مجاز به مدیریت بلاگ نیست یا نشست آن معتبر نیست." }, 401);

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = String(form.get("action") || "");
      if (action !== "upload_image") return json({ error: "درخواست بارگذاری معتبر نیست." }, 400);
      const result = await uploadImage(request, session.admin);
      return json(result);
    }

    const body = await request.json().catch(() => ({}));
    const action = cleanText(body?.action, 40, "نوع درخواست", true);
    const result = await runAction(action, body, session.admin);
    console.info("blog-admin action completed", { action });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "درخواست ناموفق بود.";
    const status = message.includes("GitHub token") ? 424 : 400;
    console.warn("blog-admin action failed", { message: message.slice(0, 180) });
    return json({ error: message }, status);
  }
});
