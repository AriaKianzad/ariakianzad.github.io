import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SITE_ORIGIN = "https://ariakianzad.github.io";
const BLOG_REPO = "AriaKianzad/ariakianzad.github.io";
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

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
}

function keys() {
  const publishable = JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS")).default;
  const secret = JSON.parse(env("SUPABASE_SECRET_KEYS")).default;
  if (!publishable || !secret) throw new Error("Supabase managed API keys are unavailable.");
  return {
    url: env("SUPABASE_URL").replace(/\/+$/, ""),
    publishable,
    secret,
  };
}

async function authorizeAdmin(authorization: string, config: ReturnType<typeof keys>) {
  if (!authorization.startsWith("Bearer ")) return null;
  const accessToken = authorization.slice(7).trim();
  if (!accessToken) return null;

  const authClient = createClient(config.url, config.publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) return null;

  const email = (data.user.email || "").toLowerCase();
  const confirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
  if (!email || !confirmed) return null;

  const adminClient = createClient(config.url, config.secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: admin, error: adminError } = await adminClient
    .from("dashboard_admins")
    .select("email")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (adminError || !admin) return null;
  return { user: data.user, client: adminClient };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown, max: number, label: string, required = false): string {
  const valueText = typeof value === "string" ? value.trim() : "";
  if (required && !valueText) throw new Error(label + " الزامی است.");
  if (valueText.length > max) throw new Error(label + " بیش از حد مجاز طولانی است.");
  return valueText;
}

function hexColor(value: unknown, fallback: string) {
  const color = typeof value === "string" ? value : fallback;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("کد رنگ معتبر نیست.");
  return color;
}

function mediaUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !value.startsWith(MEDIA_PREFIX) || value.includes("..")) {
    throw new Error("آدرس تصویر باید از کتابخانۀ رسانه بلاگ باشد.");
  }
  return value;
}

function categorySeoValue(value: unknown): Record<string, Record<string, unknown>> {
  const source = asRecord(value);
  const entries = Object.entries(source).slice(0, 100);
  const output: Record<string, Record<string, unknown>> = {};
  for (const [rawSlug, rawItem] of entries) {
    const slug = rawSlug.trim().toLowerCase();
    if (!slug || slug.length > 120 || /[\/\\?#%]/.test(slug) || slug === "." || slug === ".." || /[\u0000-\u001f]/.test(slug)) {
      throw new Error("شناسه یکی از دسته‌بندی‌ها معتبر نیست.");
    }
    const item = asRecord(rawItem);
    const canonical = textValue(item.canonical_url, 500, "نشانی معیار دسته‌بندی");
    if (canonical) {
      let url: URL;
      try { url = new URL(canonical); } catch { throw new Error("نشانی معیار دسته‌بندی معتبر نیست."); }
      if (url.origin !== SITE_ORIGIN || !url.pathname.startsWith("/blog/category/")) {
        throw new Error("نشانی معیار دسته‌بندی باید در مسیر دسته‌بندی‌های همین وبلاگ باشه.");
      }
    }
    output[slug] = {
      description: textValue(item.description, 500, "توضیحات دسته‌بندی"),
      seo_title: textValue(item.seo_title, 75, "عنوان SEO دسته‌بندی"),
      meta_description: textValue(item.meta_description, 320, "توضیحات متای دسته‌بندی"),
      og_title: textValue(item.og_title, 100, "عنوان اشتراک‌گذاری دسته‌بندی"),
      og_description: textValue(item.og_description, 300, "توضیحات اشتراک‌گذاری دسته‌بندی"),
      canonical_url: canonical,
      robots_index: item.robots_index !== false,
      robots_follow: item.robots_follow !== false,
    };
  }
  return output;
}

function categoriesValue(value: unknown): { slug: string; name: string }[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 100) throw new Error("حداکثر ۱۰۰ دسته‌بندی مجاز است.");
  const slugs = new Set<string>();
  const names = new Set<string>();
  return value.map((entry: unknown) => {
    const item = asRecord(entry);
    const slug = textValue(item.slug, 120, "نامک دسته‌بندی", true).toLowerCase();
    const name = textValue(item.name, 80, "نام نمایشی دسته‌بندی", true);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("نامک دسته‌بندی باید فقط با حروف انگلیسی کوچک، عدد و خط تیره نوشته بشه.");
    }
    const normalizedName = name.toLocaleLowerCase();
    if (slugs.has(slug)) throw new Error("نامک تکراری برای دسته‌بندی ثبت شده.");
    if (names.has(normalizedName)) throw new Error("نام نمایشی تکراری برای دسته‌بندی ثبت شده.");
    slugs.add(slug);
    names.add(normalizedName);
    return { slug, name };
  });
}

function tagsValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 25)
    .map((entry) => typeof entry === "string" ? entry.trim().slice(0, 40) : "")
    .filter(Boolean))];
}

function faqsValue(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.length > 30) throw new Error("حداکثر ۳۰ پرسش متداول مجاز است.");
  return value.map((entry: unknown) => {
    const item = asRecord(entry);
    return {
      question: textValue(item.question, 240, "پرسش", true),
      answer: textValue(item.answer, 2400, "پاسخ", true),
    };
  });
}

function normalizePost(input: Record<string, unknown>) {
  const slug = textValue(input?.slug, 120, "نامک", true).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("نامک باید با حروف کوچک انگلیسی، عدد و خط تیره نوشته بشه.");
  }
  const language = input?.language === "en" ? "en" : "fa";
  const canonical = textValue(input?.canonical_url, 500, "Canonical URL");
  if (canonical) {
    let url: URL;
    try { url = new URL(canonical); } catch { throw new Error("Canonical URL معتبر نیست."); }
    if (url.origin !== SITE_ORIGIN || !url.pathname.startsWith("/blog/")) {
      throw new Error("Canonical URL باید از همین دامنه و مسیر بلاگ باشه.");
    }
  }
  const legacyCategory = textValue(input?.category, 120, "دسته‌بندی");
  const rawCategories = Array.isArray(input?.categories) ? input.categories : [];
  const categories = [...new Set(
    (rawCategories.length ? rawCategories : (legacyCategory ? [legacyCategory] : []))
      .map((value) => textValue(value, 120, "دسته‌بندی", true).toLowerCase())
  )];
  if (categories.length > 3) throw new Error("هر مقاله حداکثر می‌تونه سه دسته‌بندی داشته باشه.");
  if (categories.some((value) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))) {
    throw new Error("نامک یکی از دسته‌بندی‌های مقاله معتبر نیست.");
  }
  const primaryCategory = textValue(input?.primary_category ?? legacyCategory ?? categories[0] ?? "", 120, "دسته‌بندی اصلی").toLowerCase();
  if (categories.length && !categories.includes(primaryCategory)) {
    throw new Error("دسته‌بندی اصلی باید یکی از دسته‌بندی‌های انتخاب‌شده باشه.");
  }
  if (!categories.length && primaryCategory) {
    throw new Error("برای تعیین دسته‌بندی اصلی، ابتدا یک دسته‌بندی انتخاب کن.");
  }
  return {
    slug,
    title: textValue(input?.title, 180, "عنوان مقاله", true),
    excerpt: textValue(input?.excerpt, 700, "خلاصه"),
    content: textValue(input?.content, 180000, "محتوای مقاله"),
    language,
    category: primaryCategory,
    categories,
    primary_category: primaryCategory,
    tags: tagsValue(input?.tags),
    hero_image_url: mediaUrl(input?.hero_image_url),
    hero_image_alt: textValue(input?.hero_image_alt, 240, "متن جایگزین تصویر"),
    hero_image_caption: textValue(input?.hero_image_caption, 400, "زیرنویس تصویر"),
    og_image_url: mediaUrl(input?.og_image_url),
    seo_title: textValue(input?.seo_title, 75, "عنوان SEO"),
    meta_description: textValue(input?.meta_description, 320, "توضیحات متا"),
    focus_keyword: textValue(input?.focus_keyword, 120, "کلمۀ کلیدی"),
    canonical_url: canonical,
    og_title: textValue(input?.og_title, 100, "عنوان شبکه‌های اجتماعی"),
    og_description: textValue(input?.og_description, 300, "توضیحات شبکه‌های اجتماعی"),
    robots_index: input?.robots_index !== false,
    robots_follow: input?.robots_follow !== false,
    featured: Boolean(input?.featured),
    toc_enabled: input?.toc_enabled !== false,
    drop_cap: Boolean(input?.drop_cap),
    content_width: input?.content_width === "wide" ? "wide" : "reading",
    accent_color: hexColor(input?.accent_color, "#a86f54"),
    faqs: faqsValue(input?.faqs),
  };
}

function snapshot(post: Record<string, unknown>, publishedAt: string) {
  return {
    ...post,
    published_at: publishedAt,
    updated_at: new Date().toISOString(),
  };
}

async function workflowToken() {
  const value = Deno.env.get("GITHUB_WORKFLOW_TOKEN")?.trim();
  if (!value) {
    throw new Error("GITHUB_WORKFLOW_TOKEN در Secrets تابع blog-admin تنظیم نشده است.");
  }
  return value;
}

async function dispatchBuild() {
  const token = await workflowToken();
  const response = await fetch(
    "https://api.github.com/repos/" + BLOG_REPO + "/actions/workflows/deploy.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );
  if (!response.ok) {
    console.error("blog-admin workflow dispatch failed", { status: response.status });
    throw new Error("GitHub انتشار را شروع نکرد. وضعیت دسترسی Token را بررسی کن.");
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
      [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  }
  return false;
}

async function uploadImage(request: Request, client: SupabaseClient) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("فایلی برای بارگذاری انتخاب نشده.");
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error("حجم تصویر باید کمتر از ۳ مگابایت باشه.");
  const mime = file.type.toLowerCase();
  if (!["image/webp", "image/jpeg", "image/png"].includes(mime)) {
    throw new Error("فرمت تصویر پشتیبانی نمی‌شه. WebP پیشنهاد می‌شه.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasMagicBytes(bytes, mime)) throw new Error("محتوای فایل با فرمت اعلام‌شده مطابقت نداره.");
  const extension = mime === "image/webp" ? "webp" : mime === "image/png" ? "png" : "jpg";
  const path = "uploads/" + crypto.randomUUID() + "." + extension;
  const { error } = await client.storage.from(BLOG_BUCKET).upload(path, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error("بارگذاری تصویر ناموفق بود.");
  const { data } = client.storage.from(BLOG_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, mimeType: mime, size: file.size };
}

async function dispatchAfterWrite(message: string) {
  try {
    await dispatchBuild();
  } catch (error) {
    console.error("blog-admin publish committed but build dispatch failed", { message });
    throw error;
  }
}

async function perform(action: string, body: Record<string, unknown>, client: SupabaseClient) {
  if (action === "list_posts") {
    const { data, error } = await client.from("blog_posts")
      .select("id,slug,title,excerpt,language,category,categories,primary_category,status,featured,published_at,updated_at,has_unpublished_changes,hero_image_url")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("دریافت مقاله‌ها ناموفق بود.");
    return { posts: data || [] };
  }

  if (action === "get_post") {
    const id = textValue(body?.id, 64, "شناسه مقاله", true);
    const { data, error } = await client.from("blog_posts").select("*").eq("id", id).maybeSingle();
    if (error || !data) throw new Error("مقاله پیدا نشد.");
    return { post: data };
  }

  if (action === "get_settings") {
    const { data, error } = await client.from("blog_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error("دریافت تنظیمات بلاگ ناموفق بود.");
    return { settings: data };
  }

  if (action === "save_post") {
    const postInput = asRecord(body.post);
    const post = normalizePost(postInput);
    if (post.categories.length) {
      const { data: blogSettings, error: settingsError } = await client.from("blog_settings")
        .select("categories").eq("id", 1).maybeSingle();
      if (settingsError) throw new Error("بررسی دسته‌بندی‌های مقاله ناموفق بود.");
      const available = Array.isArray(blogSettings?.categories) ? blogSettings.categories : [];
      const unknown = post.categories.filter((slug) => !available.some((item: Record<string, unknown>) => item.slug === slug));
      if (unknown.length) throw new Error("یکی از دسته‌بندی‌های انتخاب‌شده در فهرست دسته‌بندی‌های بلاگ وجود نداره.");
      if (!post.categories.includes(post.primary_category)) throw new Error("دسته‌بندی اصلی باید یکی از دسته‌بندی‌های انتخاب‌شده باشه.");
    }
    const id = typeof postInput.id === "string" ? postInput.id : "";
    const now = new Date().toISOString();
    if (id) {
      const previous = await client.from("blog_posts")
        .select("id,status,published_at,published_snapshot")
        .eq("id", id).maybeSingle();
      if (previous.error || !previous.data) throw new Error("مقاله پیدا نشد.");
      const isPublished = previous.data.status === "published";
      const { data, error } = await client.from("blog_posts")
        .update({
          ...post,
          status: previous.data.status,
          published_at: previous.data.published_at,
          published_snapshot: previous.data.published_snapshot,
          has_unpublished_changes: isPublished,
          updated_at: now,
        })
        .eq("id", id).select("*").single();
      if (error) {
        if (error.code === "23505") throw new Error("این نامک قبلاً استفاده شده.");
        throw new Error("ذخیرۀ مقاله ناموفق بود.");
      }
      return { post: data };
    }
    const { data, error } = await client.from("blog_posts")
      .insert({ ...post, status: "draft", has_unpublished_changes: false })
      .select("*").single();
    if (error) {
      if (error.code === "23505") throw new Error("این نامک قبلاً استفاده شده.");
      throw new Error("ایجاد مقاله ناموفق بود.");
    }
    return { post: data };
  }

  if (action === "publish_post") {
    await workflowToken();
    const id = textValue(body?.id, 64, "شناسه مقاله", true);
    const existing = await client.from("blog_posts").select("*").eq("id", id).maybeSingle();
    if (existing.error || !existing.data) throw new Error("مقاله پیدا نشد.");
    const current = existing.data;
    if (!current.title || !current.slug || !current.content.trim()) {
      throw new Error("برای انتشار، عنوان، نامک و متن مقاله باید تکمیل باشن.");
    }
    const publishedAt = current.published_at || new Date().toISOString();
    const publicSnapshot = snapshot({
      slug: current.slug, title: current.title, excerpt: current.excerpt, content: current.content,
      language: current.language, category: current.primary_category || current.category, categories: current.categories || (current.category ? [current.category] : []), primary_category: current.primary_category || current.category, tags: current.tags,
      hero_image_url: current.hero_image_url, hero_image_alt: current.hero_image_alt,
      hero_image_caption: current.hero_image_caption, og_image_url: current.og_image_url,
      seo_title: current.seo_title, meta_description: current.meta_description,
      focus_keyword: current.focus_keyword, canonical_url: current.canonical_url,
      og_title: current.og_title, og_description: current.og_description,
      robots_index: current.robots_index, robots_follow: current.robots_follow,
      featured: current.featured, toc_enabled: current.toc_enabled, drop_cap: current.drop_cap,
      content_width: current.content_width, accent_color: current.accent_color, faqs: current.faqs,
    }, publishedAt);
    const { data, error } = await client.from("blog_posts").update({
      status: "published",
      published_at: publishedAt,
      published_snapshot: publicSnapshot,
      has_unpublished_changes: false,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").single();
    if (error) throw new Error("ثبت انتشار مقاله ناموفق بود.");
    await dispatchAfterWrite("publish_post");
    return { post: data, buildDispatched: true };
  }

  if (action === "unpublish_post" || action === "archive_post") {
    await workflowToken();
    const id = textValue(body?.id, 64, "شناسه مقاله", true);
    const status = action === "archive_post" ? "archived" : "draft";
    const { data, error } = await client.from("blog_posts").update({
      status, has_unpublished_changes: false, updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").single();
    if (error || !data) throw new Error("تغییر وضعیت مقاله ناموفق بود.");
    await dispatchAfterWrite(action);
    return { post: data, buildDispatched: true };
  }

  if (action === "delete_post") {
    const id = textValue(body?.id, 64, "شناسه مقاله", true);
    const existing = await client.from("blog_posts").select("id,status").eq("id", id).maybeSingle();
    if (existing.error || !existing.data) throw new Error("مقاله پیدا نشد.");
    if (existing.data.status === "published") throw new Error("ابتدا مقاله را از انتشار خارج کن.");
    const { error } = await client.from("blog_posts").delete().eq("id", id);
    if (error) throw new Error("حذف مقاله ناموفق بود.");
    return { deleted: true };
  }

  if (action === "save_settings") {
    const input = asRecord(body.settings);
    const themes = ["paper", "white", "warm"];
    const cards = ["editorial", "minimal", "image-led"];
    const layouts = ["editorial", "minimal", "magazine"];
    const widths = ["reading", "wide"];
    const languages = ["fa", "en"];
    const defaultOg = mediaUrl(input.default_og_image);
    const { data: currentSettings, error: currentSettingsError } = await client.from("blog_settings")
      .select("categories,category_seo,default_og_title,default_og_description,default_robots_index,default_robots_follow,noindex_empty_categories,sitemap_include_categories,sitemap_include_articles,schema_type,breadcrumbs_enabled,breadcrumb_home_label,open_graph_enabled,twitter_card_type")
      .eq("id", 1).maybeSingle();
    if (currentSettingsError) throw new Error("دریافت تنظیمات فعلی ناموفق بود.");
    const categories = input.categories === undefined
      ? (Array.isArray(currentSettings?.categories) ? currentSettings.categories : [])
      : categoriesValue(input.categories);
    const nextSlugs = new Set(categories.map((item) => item.slug));
    const previousCategories = Array.isArray(currentSettings?.categories) ? currentSettings.categories : [];
    const removedSlugs = previousCategories
      .map((item: Record<string, unknown>) => typeof item.slug === "string" ? item.slug : "")
      .filter((slug: string) => slug && !nextSlugs.has(slug));
    if (removedSlugs.length) {
      const { data: usedPosts, error: usedPostsError } = await client.from("blog_posts")
        .select("category").in("category", removedSlugs).limit(1);
      if (usedPostsError) throw new Error("بررسی وابستگی مقاله‌ها به دسته‌بندی‌ها ناموفق بود.");
      if (usedPosts?.length) throw new Error("این دسته‌بندی هنوز به یک یا چند مقاله وصله. ابتدا مقاله‌ها رو به دسته‌بندی دیگه منتقل کن.");
    }
    const settings = {
      id: 1,
      title: textValue(input.title, 100, "عنوان بلاگ", true),
      tagline: textValue(input.tagline, 180, "زیرعنوان"),
      description: textValue(input.description, 500, "توضیحات"),
      background_theme: typeof input.background_theme === "string" && themes.includes(input.background_theme) ? input.background_theme : "paper",
      accent_color: hexColor(input.accent_color, "#a86f54"),
      card_style: typeof input.card_style === "string" && cards.includes(input.card_style) ? input.card_style : "editorial",
      layout_style: typeof input.layout_style === "string" && layouts.includes(input.layout_style) ? input.layout_style : "editorial",
      content_width: typeof input.content_width === "string" && widths.includes(input.content_width) ? input.content_width : "reading",
      posts_per_page: Math.min(24, Math.max(3, Number(input.posts_per_page) || 9)),
      show_search: input.show_search !== false,
      show_categories: input.show_categories !== false,
      show_featured: input.show_featured !== false,
      show_reading_time: input.show_reading_time !== false,
      show_toc: input.show_toc !== false,
      show_related_posts: input.show_related_posts !== false,
      show_share: input.show_share !== false,
      enable_rss: input.enable_rss !== false,
      default_language: typeof input.default_language === "string" && languages.includes(input.default_language) ? input.default_language : "fa",
      heading_scale: Math.min(1.2, Math.max(0.85, Number(input.heading_scale) || 1)),
      body_line_height: Math.min(2.4, Math.max(1.6, Number(input.body_line_height) || 1.95)),
      intro_title: textValue(input.intro_title, 180, "عنوان معرفی"),
      intro_body: textValue(input.intro_body, 600, "متن معرفی"),
      default_meta_title: textValue(input.default_meta_title, 75, "عنوان متای پیش‌فرض"),
      default_meta_description: textValue(input.default_meta_description, 320, "توضیحات متای پیش‌فرض"),
      default_og_image: defaultOg || "",
      footer_note: textValue(input.footer_note, 200, "متن پابرگ"),
      categories,
      category_seo: input.category_seo === undefined ? (currentSettings?.category_seo || {}) : categorySeoValue(input.category_seo),
      default_og_title: input.default_og_title === undefined ? (currentSettings?.default_og_title || "") : textValue(input.default_og_title, 100, "عنوان پیش‌فرض شبکه‌های اجتماعی"),
      default_og_description: input.default_og_description === undefined ? (currentSettings?.default_og_description || "") : textValue(input.default_og_description, 300, "توضیحات پیش‌فرض شبکه‌های اجتماعی"),
      default_robots_index: input.default_robots_index === undefined ? currentSettings?.default_robots_index !== false : input.default_robots_index !== false,
      default_robots_follow: input.default_robots_follow === undefined ? currentSettings?.default_robots_follow !== false : input.default_robots_follow !== false,
      noindex_empty_categories: input.noindex_empty_categories === undefined ? currentSettings?.noindex_empty_categories !== false : input.noindex_empty_categories !== false,
      sitemap_include_categories: input.sitemap_include_categories === undefined ? currentSettings?.sitemap_include_categories !== false : input.sitemap_include_categories !== false,
      sitemap_include_articles: input.sitemap_include_articles === undefined ? currentSettings?.sitemap_include_articles !== false : input.sitemap_include_articles !== false,
      schema_type: input.schema_type === undefined ? (currentSettings?.schema_type === "BlogPosting" ? "BlogPosting" : "Article") : (input.schema_type === "BlogPosting" ? "BlogPosting" : "Article"),
      breadcrumbs_enabled: input.breadcrumbs_enabled === undefined ? currentSettings?.breadcrumbs_enabled !== false : input.breadcrumbs_enabled !== false,
      breadcrumb_home_label: input.breadcrumb_home_label === undefined ? (currentSettings?.breadcrumb_home_label || "خانه") : (textValue(input.breadcrumb_home_label, 40, "عنوان خانه در مسیر راهنما") || "خانه"),
      open_graph_enabled: input.open_graph_enabled === undefined ? currentSettings?.open_graph_enabled !== false : input.open_graph_enabled !== false,
      twitter_card_type: input.twitter_card_type === undefined ? (currentSettings?.twitter_card_type === "summary" ? "summary" : "summary_large_image") : (input.twitter_card_type === "summary" ? "summary" : "summary_large_image"),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await client.from("blog_settings")
      .upsert(settings, { onConflict: "id" }).select("*").single();
    if (error) throw new Error("ذخیرۀ تنظیمات بلاگ ناموفق بود.");
    const tokenConfigured = Boolean(Deno.env.get("GITHUB_WORKFLOW_TOKEN")?.trim());
    if (tokenConfigured) await dispatchAfterWrite("save_settings");
    return {
      settings: data,
      buildDispatched: tokenConfigured,
      publicationPending: !tokenConfigured,
    };
  }

  throw new Error("درخواست ناشناخته است.");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== SITE_ORIGIN) return json({ error: "Origin not allowed." }, 403);
    const config = keys();
    const session = await authorizeAdmin(request.headers.get("authorization") || "", config);
    if (!session) return json({ error: "این حساب مجاز به مدیریت بلاگ نیست یا نشست معتبر نیست." }, 401);
    const type = request.headers.get("content-type") || "";
    if (type.includes("multipart/form-data")) {
      const result = await uploadImage(request, session.client);
      return json(result);
    }
    const body = asRecord(await request.json().catch(() => ({})));
    const action = textValue(body.action, 40, "نوع درخواست", true);
    const result = await perform(action, body, session.client);
    console.info("blog-admin completed", { action });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "درخواست ناموفق بود.";
    console.warn("blog-admin rejected", { message: message.slice(0, 140) });
    const status = message.includes("GITHUB_WORKFLOW_TOKEN") ? 424 : 400;
    return json({ error: message }, status);
  }
});
