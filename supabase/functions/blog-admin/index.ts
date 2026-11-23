import { createClient } from "@supabase/supabase-js";

const SITE_ORIGIN = "https://ariakianzad.github.io";
const SITE_URL = "https://ariakianzad.github.io";
const PROJECT_URL = "https://bkohdqwecnvbmeaiuyyx.supabase.co";
const GITHUB_REPOSITORY = "AriaKianzad/ariakianzad.github.io";
const BLOG_MEDIA_BUCKET = "blog-media";
const MAX_CONTENT_LENGTH = 450_000;

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
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("Missing Supabase environment variable: " + name);
  return value;
}

function getKeys() {
  const publishableKeys = JSON.parse(requiredEnv("SUPABASE_PUBLISHABLE_KEYS"));
  const secretKeys = JSON.parse(requiredEnv("SUPABASE_SECRET_KEYS"));
  if (!publishableKeys.default || !secretKeys.default) {
    throw new Error("Supabase managed API keys are unavailable.");
  }
  return {
    url: requiredEnv("SUPABASE_URL").replace(/\/+$/, ""),
    publishable: publishableKeys.default,
    secret: secretKeys.default,
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

async function authenticateAdmin(authorization: string, keys: ReturnType<typeof getKeys>) {
  if (!authorization.startsWith("Bearer ")) {
    return { ok: false as const, status: 401, code: "unauthorized", message: "برای ورود به پنل دوباره وارد شو." };
  }
  const token = authorization.slice(7).trim();
  if (!token) {
    return { ok: false as const, status: 401, code: "unauthorized", message: "نشست ورود معتبر نیست." };
  }

  const authClient = createClient(keys.url, keys.publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false as const, status: 401, code: "unauthorized", message: "نشست ورود منقضی شده. دوباره وارد شو." };
  }

  const email = data.user.email?.trim().toLowerCase() || "";
  const confirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
  if (!confirmed || !email) {
    return { ok: false as const, status: 403, code: "email_unconfirmed", message: "حساب ایمیل باید تأیید شده باشه." };
  }

  const adminClient = createClient(keys.url, keys.secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: allowlistError } = await adminClient
    .from("dashboard_admins")
    .select("email")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (allowlistError || !allowed) {
    return { ok: false as const, status: 403, code: "not_allowed", message: "این حساب در فهرست مدیران بلاگ مجاز نیست." };
  }

  // getUser() verifies the JWT signature with Auth. Only then are its claims
  // trusted for the second-factor assurance check.
  const claims = decodeJwtPayload(token);
  if (claims.aal !== "aal2") {
    return { ok: false as const, status: 403, code: "mfa_required", message: "برای دسترسی به پنل، ورود دومرحله‌ای با اپلیکیشن Authenticator لازمه." };
  }

  return { ok: true as const, user: data.user, email, adminClient };
}

function cleanText(value: unknown, max = 1000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeSlug(value: unknown): string {
  const slug = cleanText(value, 90).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("نشانی مقاله باید فقط از حروف انگلیسی کوچک، عدد و خط تیره ساخته بشه.");
  }
  return slug;
}

function safeAccent(value: unknown): string {
  const color = cleanText(value, 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("رنگ تأکیدی معتبر نیست.");
  return color.toLowerCase();
}

function safeImageUrl(value: unknown): string | null {
  const raw = cleanText(value, 1500);
  if (!raw) return null;
  const prefix = PROJECT_URL + "/storage/v1/object/public/" + BLOG_MEDIA_BUCKET + "/";
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error("نشانی تصویر معتبر نیست."); }
  if (parsed.origin !== PROJECT_URL || !parsed.pathname.startsWith("/storage/v1/object/public/" + BLOG_MEDIA_BUCKET + "/") ||
      parsed.username || parsed.password || parsed.hash || parsed.search || !raw.startsWith(prefix)) {
    throw new Error("تصاویر مقاله باید از کتابخانۀ رسانه‌های بلاگ انتخاب بشن.");
  }
  return raw;
}

function safeCanonical(value: unknown): string {
  const raw = cleanText(value, 1500);
  if (!raw) return "";
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error("Canonical باید یک نشانی کامل HTTPS باشه."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    throw new Error("Canonical باید یک نشانی HTTPS معتبر و بدون fragment باشه.");
  }
  return parsed.toString();
}

function normalizeFaqs(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      question: cleanText(row.question, 240),
      answer: cleanText(row.answer, 1600),
    };
  }).filter((item) => item.question && item.answer);
}

function normalizePost(input: Record<string, unknown>) {
  const content = typeof input.content === "string" ? input.content : "";
  if (content.length > MAX_CONTENT_LENGTH) throw new Error("حجم متن مقاله بیش از حد مجازه.");
  const language = input.language === "en" ? "en" : "fa";
  const contentWidth = input.content_width === "wide" ? "wide" : "reading";
  return {
    slug: safeSlug(input.slug),
    title: cleanText(input.title, 180),
    excerpt: cleanText(input.excerpt, 420),
    content,
    language,
    category: cleanText(input.category, 80),
    tags: Array.isArray(input.tags)
      ? [...new Set(input.tags.map((tag) => cleanText(tag, 40)).filter(Boolean))].slice(0, 16)
      : [],
    hero_image_url: safeImageUrl(input.hero_image_url),
    hero_image_alt: cleanText(input.hero_image_alt, 240),
    hero_image_caption: cleanText(input.hero_image_caption, 300),
    og_image_url: safeImageUrl(input.og_image_url),
    seo_title: cleanText(input.seo_title, 90),
    meta_description: cleanText(input.meta_description, 220),
    focus_keyword: cleanText(input.focus_keyword, 100),
    canonical_url: safeCanonical(input.canonical_url),
    og_title: cleanText(input.og_title, 90),
    og_description: cleanText(input.og_description, 220),
    robots_index: input.robots_index !== false,
    robots_follow: input.robots_follow !== false,
    featured: input.featured === true,
    toc_enabled: input.toc_enabled !== false,
    drop_cap: input.drop_cap === true,
    content_width: contentWidth,
    accent_color: safeAccent(input.accent_color || "#405a42"),
    faqs: normalizeFaqs(input.faqs),
  };
}

function validateForPublish(post: Record<string, unknown>) {
  if (!cleanText(post.title, 180)) throw new Error("عنوان مقاله رو وارد کن.");
  if (!cleanText(post.excerpt, 420)) throw new Error("خلاصۀ مقاله برای کارت بلاگ و شبکه‌های اجتماعی لازمه.");
  if (typeof post.content !== "string" || post.content.trim().length < 120) {
    throw new Error("متن مقاله برای انتشار خیلی کوتاهه.");
  }
  if (cleanText(post.seo_title, 90).length < 15) throw new Error("عنوان SEO رو کامل کن.");
  if (cleanText(post.meta_description, 220).length < 50) throw new Error("توضیحات متا باید حداقل ۵۰ کاراکتر داشته باشه.");
  if (!cleanText(post.focus_keyword, 100)) throw new Error("کلمۀ کلیدی اصلی رو مشخص کن.");
  if (post.hero_image_url && !cleanText(post.hero_image_alt, 240)) {
    throw new Error("برای تصویر شاخص متن جایگزین (Alt) وارد کن.");
  }
  if (!cleanText(post.category, 80)) throw new Error("یک دسته‌بندی برای مقاله انتخاب کن.");
}

function publishedPayload(post: Record<string, unknown>) {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    language: post.language,
    category: post.category,
    tags: post.tags,
    heroImageUrl: post.hero_image_url,
    heroImageAlt: post.hero_image_alt,
    heroImageCaption: post.hero_image_caption,
    ogImageUrl: post.og_image_url || post.hero_image_url,
    seoTitle: post.seo_title,
    metaDescription: post.meta_description,
    focusKeyword: post.focus_keyword,
    canonicalUrl: post.canonical_url,
    ogTitle: post.og_title || post.seo_title,
    ogDescription: post.og_description || post.meta_description,
    robotsIndex: post.robots_index,
    robotsFollow: post.robots_follow,
    featured: post.featured,
    tocEnabled: post.toc_enabled,
    dropCap: post.drop_cap,
    contentWidth: post.content_width,
    accentColor: post.accent_color,
    faqs: post.faqs || [],
    publishedAt: post.published_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function githubRequest(path: string, method: string, body?: unknown) {
  const token = Deno.env.get("BLOG_GITHUB_TOKEN")?.trim();
  if (!token) {
    const missing = new Error("BLOG_GITHUB_TOKEN is missing");
    (missing as Error & { code?: string }).code = "github_token_missing";
    throw missing;
  }

  const response = await fetch("https://api.github.com/repos/" + GITHUB_REPOSITORY + path, {
    method,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "Aria-Kianzad-Personal-Blog-CMS",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      response.status === 403
        ? "GitHub اجازهٔ انتشار نداد. سطح دسترسی توکن و محافظت Branch اصلی رو بررسی کن."
        : response.status === 404
        ? "فایل یا مسیر انتشار در GitHub پیدا نشد."
        : "ارتباط با GitHub برای انتشار مقاله ناموفق بود."
    );
    (error as Error & { upstreamStatus?: number }).upstreamStatus = response.status;
    throw error;
  }
  return payload;
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function upsertPublishedFile(path: string, contents: unknown, message: string) {
  let sha: string | undefined;
  try {
    const current = await githubRequest("/contents/" + encodePath(path) + "?ref=main", "GET");
    sha = typeof current.sha === "string" ? current.sha : undefined;
  } catch (error) {
    const upstreamStatus = (error as Error & { upstreamStatus?: number }).upstreamStatus;
    if (upstreamStatus !== 404) throw error;
  }

  const body: Record<string, unknown> = {
    message,
    content: base64Utf8(JSON.stringify(contents, null, 2) + "\n"),
    branch: "main",
  };
  if (sha) body.sha = sha;
  return await githubRequest("/contents/" + encodePath(path), "PUT", body);
}

async function deletePublishedFile(path: string, message: string) {
  const current = await githubRequest("/contents/" + encodePath(path) + "?ref=main", "GET");
  if (typeof current.sha !== "string") throw new Error("SHA فایل منتشرشده دریافت نشد.");
  return await githubRequest("/contents/" + encodePath(path), "DELETE", {
    message,
    sha: current.sha,
    branch: "main",
  });
}

function defaultSettings() {
  return {
    id: 1,
    title: "نوشته‌ها",
    tagline: "یادداشت‌هایی درباره برند، معنا و ارتباط",
    description: "مقاله‌ها و یادداشت‌هایی درباره استراتژی برند، پرسونال برندینگ و ارتباطات.",
    background_theme: "paper",
    accent_color: "#405a42",
    card_style: "editorial",
    posts_per_page: 9,
    show_search: true,
    show_categories: true,
    show_featured: true,
    show_reading_time: true,
    default_meta_title: "وبلاگ آریا کیانزاد",
    default_meta_description: "یادداشت‌هایی درباره استراتژی برند، پرسونال برندینگ و ارتباطات.",
    default_og_image: "",
    footer_note: "فکرها، مشاهده‌ها و یادداشت‌هایی درباره برند و ارتباط.",
  };
}

function normalizeSettings(input: Record<string, unknown>) {
  const backgroundTheme = ["paper", "white", "warm"].includes(String(input.background_theme))
    ? String(input.background_theme) : "paper";
  const cardStyle = ["editorial", "minimal", "image-led"].includes(String(input.card_style))
    ? String(input.card_style) : "editorial";
  return {
    id: 1,
    title: cleanText(input.title, 80) || "نوشته‌ها",
    tagline: cleanText(input.tagline, 180),
    description: cleanText(input.description, 420),
    background_theme: backgroundTheme,
    accent_color: safeAccent(input.accent_color || "#405a42"),
    card_style: cardStyle,
    posts_per_page: Math.max(3, Math.min(24, Number(input.posts_per_page) || 9)),
    show_search: input.show_search !== false,
    show_categories: input.show_categories !== false,
    show_featured: input.show_featured !== false,
    show_reading_time: input.show_reading_time !== false,
    default_meta_title: cleanText(input.default_meta_title, 90),
    default_meta_description: cleanText(input.default_meta_description, 220),
    default_og_image: safeImageUrl(input.default_og_image) || "",
    footer_note: cleanText(input.footer_note, 300),
    updated_at: new Date().toISOString(),
  };
}

async function handleAction(adminClient: ReturnType<typeof createClient>, action: string, input: Record<string, unknown>) {
  if (action === "list_posts") {
    const { data, error } = await adminClient
      .from("blog_posts")
      .select("id,slug,title,excerpt,language,category,status,featured,published_at,has_unpublished_changes,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { posts: data || [] };
  }

  if (action === "get_post") {
    const id = cleanText(input.id, 64);
    if (!id) throw new Error("شناسهٔ مقاله معتبر نیست.");
    const { data, error } = await adminClient.from("blog_posts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return { post: null };
    return { post: data };
  }

  if (action === "save_post") {
    const post = normalizePost((input.post || {}) as Record<string, unknown>);
    if (!post.title) throw new Error("عنوان مقاله رو وارد کن.");
    if (!post.content.trim()) throw new Error("متن مقاله خالیه.");

    const id = cleanText((input.post as Record<string, unknown>)?.id, 64);
    let existing: Record<string, unknown> | null = null;
    if (id) {
      const { data, error } = await adminClient.from("blog_posts").select("id,slug,status").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("مقاله پیدا نشد؛ فهرست رو تازه‌سازی کن.");
      existing = data as Record<string, unknown>;
      if (existing.status === "published" && existing.slug !== post.slug) {
        throw new Error("برای تغییر نشانی مقالۀ منتشرشده، اول اون رو از انتشار خارج کن.");
      }
    }

    const row = {
      ...post,
      updated_at: new Date().toISOString(),
      has_unpublished_changes: existing?.status === "published",
      ...(existing ? { id } : {}),
    };
    const query = existing
      ? adminClient.from("blog_posts").update(row).eq("id", id)
      : adminClient.from("blog_posts").insert(row);
    const { data, error } = await query.select("*").single();
    if (error) {
      if (error.code === "23505") throw new Error("این نشانی قبلاً برای مقالۀ دیگری استفاده شده.");
      throw error;
    }
    return { post: data, message: "پیش‌نویس ذخیره شد." };
  }

  if (action === "publish_post") {
    const id = cleanText(input.id, 64);
    if (!id) throw new Error("شناسهٔ مقاله معتبر نیست.");
    const { data: post, error } = await adminClient.from("blog_posts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!post) throw new Error("مقاله پیدا نشد.");
    validateForPublish(post);

    const publishedAt = post.published_at || new Date().toISOString();
    const payload = publishedPayload({ ...post, published_at: publishedAt });
    const path = "src/content/blog/" + post.slug + ".json";
    const result = await upsertPublishedFile(path, payload, "Publish blog article: " + post.slug);
    const { data: updated, error: updateError } = await adminClient
      .from("blog_posts")
      .update({
        status: "published",
        published_at: publishedAt,
        has_unpublished_changes: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) {
      console.error("blog-admin database sync failed after GitHub publish", updateError.code);
      return {
        published: true,
        commitSha: result.commit?.sha || null,
        path,
        warning: "فایل مقاله در GitHub ثبت شد، اما به‌روزرسانی وضعیت دیتابیس کامل نشد.",
      };
    }
    return { published: true, post: updated, commitSha: result.commit?.sha || null, path };
  }

  if (action === "unpublish_post") {
    const id = cleanText(input.id, 64);
    const { data: post, error } = await adminClient.from("blog_posts").select("id,slug").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!post) throw new Error("مقاله پیدا نشد.");
    await deletePublishedFile("src/content/blog/" + post.slug + ".json", "Unpublish blog article: " + post.slug);
    const { data, error: updateError } = await adminClient
      .from("blog_posts")
      .update({ status: "draft", published_at: null, has_unpublished_changes: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return { post: data, unpublished: true };
  }

  if (action === "archive_post") {
    const id = cleanText(input.id, 64);
    const { data: post, error } = await adminClient.from("blog_posts").select("id,slug,status").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!post) throw new Error("مقاله پیدا نشد.");
    if (post.status === "published") {
      await deletePublishedFile("src/content/blog/" + post.slug + ".json", "Archive blog article: " + post.slug);
    }
    const { data, error: updateError } = await adminClient
      .from("blog_posts")
      .update({ status: "archived", published_at: null, has_unpublished_changes: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return { post: data, archived: true };
  }

  if (action === "get_settings") {
    const { data, error } = await adminClient.from("blog_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return { settings: data || defaultSettings() };
  }

  if (action === "save_settings") {
    const settings = normalizeSettings((input.settings || {}) as Record<string, unknown>);
    const { data, error } = await adminClient.from("blog_settings")
      .upsert(settings, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    return { settings: data, message: "تنظیمات ذخیره شد." };
  }

  if (action === "publish_settings") {
    const { data, error } = await adminClient.from("blog_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    const settings = data || defaultSettings();
    const payload = {
      title: settings.title,
      tagline: settings.tagline,
      description: settings.description,
      backgroundTheme: settings.background_theme,
      accentColor: settings.accent_color,
      cardStyle: settings.card_style,
      postsPerPage: settings.posts_per_page,
      showSearch: settings.show_search,
      showCategories: settings.show_categories,
      showFeatured: settings.show_featured,
      showReadingTime: settings.show_reading_time,
      defaultMetaTitle: settings.default_meta_title,
      defaultMetaDescription: settings.default_meta_description,
      defaultOgImage: settings.default_og_image,
      footerNote: settings.footer_note,
    };
    const result = await upsertPublishedFile("src/content/blog/settings.json", payload, "Update personal blog settings");
    return { published: true, commitSha: result.commit?.sha || null };
  }

  if (action === "create_upload_url") {
    const mime = cleanText(input.mimeType, 40).toLowerCase();
    const extension = mime === "image/webp" ? "webp" : mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "";
    if (!extension) throw new Error("فرمت مجاز تصویر WebP، JPEG یا PNG است.");
    const path = "images/" + crypto.randomUUID() + "." + extension;
    const { data, error } = await adminClient.storage.from(BLOG_MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (error) throw error;
    const publicUrl = adminClient.storage.from(BLOG_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
    return { path, token: data.token, signedUrl: data.signedUrl, publicUrl };
  }

  if (action === "list_media") {
    const { data, error } = await adminClient.storage.from(BLOG_MEDIA_BUCKET).list("images", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) throw error;
    return {
      media: (data || []).filter((item) => item.name && !item.id?.endsWith("/")).map((item) => {
        const path = "images/" + item.name;
        return {
          name: item.name,
          path,
          createdAt: item.created_at || null,
          size: item.metadata?.size || null,
          publicUrl: adminClient.storage.from(BLOG_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl,
        };
      }),
    };
  }

  if (action === "delete_media") {
    const path = cleanText(input.path, 240);
    if (!/^images\/[a-f0-9-]{36}\.(webp|jpg|png)$/.test(path)) throw new Error("مسیر فایل معتبر نیست.");
    const publicUrl = adminClient.storage.from(BLOG_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
    const { data: references, error: referenceError } = await adminClient
      .from("blog_posts")
      .select("id,slug,hero_image_url,og_image_url,content")
      .limit(500);
    if (referenceError) throw referenceError;
    const inUse = (references || []).some((post) =>
      post.hero_image_url === publicUrl || post.og_image_url === publicUrl ||
      (typeof post.content === "string" && (post.content.includes(publicUrl) || post.content.includes(path)))
    );
    if (inUse) throw new Error("این تصویر در یک یا چند مقاله استفاده شده؛ اول از مقاله‌ها حذفش کن.");
    const { error } = await adminClient.storage.from(BLOG_MEDIA_BUCKET).remove([path]);
    if (error) throw error;
    return { deleted: true };
  }

  throw new Error("درخواست شناخته نشد.");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== SITE_ORIGIN) return json({ error: "Origin not allowed." }, 403);
    const raw = await request.text();
    if (raw.length > MAX_CONTENT_LENGTH + 32_000) return json({ error: "درخواست بیش از حد بزرگه." }, 413);
    const body = JSON.parse(raw || "{}");
    const keys = getKeys();
    const auth = await authenticateAdmin(request.headers.get("authorization") || "", keys);
    if (!auth.ok) return json({ code: auth.code, message: auth.message }, auth.status);

    const action = cleanText(body.action, 40);
    const result = await handleAction(auth.adminClient, action, body);
    return json({ ok: true, generatedAt: new Date().toISOString(), ...result });
  } catch (error) {
    const code = (error as Error & { code?: string }).code;
    if (code === "github_token_missing") {
      return json({
        code,
        message: "برای انتشار عمومی، توکن محدودشدۀ GitHub هنوز در Secretهای Supabase ثبت نشده. پیش‌نویس‌ها همچنان ذخیره می‌شن.",
      }, 424);
    }
    console.error("blog-admin request failed:", error instanceof Error ? error.message.slice(0, 240) : "unknown");
    return json({
      code: "request_failed",
      message: error instanceof Error ? error.message : "درخواست ناموفق بود.",
    }, 400);
  }
});
