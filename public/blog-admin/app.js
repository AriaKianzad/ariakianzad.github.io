(() => {
  "use strict";

  const config = window.ARIA_BLOG_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const state = {
    accessToken: "",
    refreshToken: "",
    factorId: "",
    challengeId: "",
    enrollmentSecret: "",
    posts: [],
    media: [],
    settings: null,
    currentPost: null,
    view: "dashboard",
    mediaTarget: "hero",
    busy: false,
    originalImageBytes: 0,
  };
  const PROJECT_ORIGIN = "https://bkohdqwecnvbmeaiuyyx.supabase.co";
  const MEDIA_PREFIX = PROJECT_ORIGIN + "/storage/v1/object/public/blog-media/";

  const authShell = $("#auth-shell");
  const appShell = $("#app-shell");
  const views = [...document.querySelectorAll(".view")];
  const loginForm = $("#login-form");
  const loginButton = $("#login-submit");
  const mfaChallengeForm = $("#mfa-challenge-form");
  const mfaEnrollForm = $("#mfa-enroll-form");
  const encoder = new TextEncoder();

  function hasConfig() {
    try {
      const endpoint = new URL(config.supabaseUrl);
      return endpoint.origin === PROJECT_ORIGIN &&
        typeof config.publishableKey === "string" &&
        config.publishableKey.startsWith("sb_publishable_") &&
        config.publishableKey.length > 20 &&
        config.siteUrl === "https://ariakianzad.github.io";
    } catch {
      return false;
    }
  }

  function message(target, text, type) {
    const node = $(target);
    if (!node) return;
    node.textContent = text || "";
    node.className = "form-message" + (type === "success" ? " success" : "");
  }

  function appMessage(text, type) {
    const node = $("#app-message");
    node.textContent = text || "";
    node.className = "app-message" + (type === "error" ? " error" : "");
    node.hidden = !text;
  }

  function buttonBusy(button, busy, busyText, idleText) {
    if (!button) return;
    button.disabled = busy;
    if (!button.dataset.idleText) button.dataset.idleText = idleText || button.textContent.trim();
    button.textContent = busy ? busyText : button.dataset.idleText;
  }

  function authUrl(path) {
    return config.supabaseUrl.replace(/\/+$/, "") + path;
  }

  async function authRequest(path, method, body, token) {
    const headers = {
      apikey: config.publishableKey,
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = "Bearer " + token;
    const response = await fetch(authUrl(path), {
      method: method || "GET",
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.msg || payload.message || payload.error_description ||
        payload.error || "درخواست احراز هویت ناموفق بود.");
    }
    return payload;
  }

  function decodeJwt(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return {};
      const raw = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const binary = atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, "="));
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return {};
    }
  }

  function showAuth(view) {
    $("#login-view").hidden = view !== "login";
    $("#mfa-challenge-view").hidden = view !== "challenge";
    $("#mfa-enroll-view").hidden = view !== "enroll";
    authShell.hidden = false;
    appShell.hidden = true;
  }

  function showApp() {
    authShell.hidden = true;
    appShell.hidden = false;
    switchView("dashboard");
  }

  function clearSession() {
    state.accessToken = "";
    state.refreshToken = "";
    state.factorId = "";
    state.challengeId = "";
    state.enrollmentSecret = "";
    state.currentPost = null;
    appShell.hidden = true;
    authShell.hidden = false;
  }

  async function signIn(email, password) {
    const result = await authRequest("/auth/v1/token?grant_type=password", "POST", { email, password });
    if (!result.access_token || !result.refresh_token) {
      throw new Error("پاسخ سرویس ورود کامل نیست.");
    }
    state.accessToken = result.access_token;
    state.refreshToken = result.refresh_token;
    const factors = await authRequest("/auth/v1/factors", "GET", undefined, state.accessToken);
    const allFactors = Array.isArray(factors.all) ? factors.all : [
      ...(Array.isArray(factors.totp) ? factors.totp : []),
      ...(Array.isArray(factors.phone) ? factors.phone : []),
    ];
    const verifiedTotp = allFactors.find((factor) =>
      factor.factor_type === "totp" && factor.status === "verified"
    );
    if (verifiedTotp) {
      state.factorId = verifiedTotp.id;
      showAuth("challenge");
      $("#mfa-code").value = "";
      $("#mfa-code").focus();
      return;
    }
    await beginTotpEnrollment();
  }

  async function beginTotpEnrollment() {
    const friendlyName = "Aria Personal Blog CMS";
    const data = await authRequest("/auth/v1/factors", "POST", {
      factor_type: "totp",
      friendly_name: friendlyName,
    }, state.accessToken);
    if (!data.id || !data.totp || !data.totp.qr_code || !data.totp.secret) {
      throw new Error("اطلاعات راه‌اندازی Authenticator از سرویس دریافت نشد.");
    }
    state.factorId = data.id;
    state.enrollmentSecret = data.totp.secret;
    $("#mfa-qr").src = data.totp.qr_code;
    $("#mfa-secret").textContent = data.totp.secret;
    $("#mfa-enroll-code").value = "";
    showAuth("enroll");
    $("#mfa-enroll-code").focus();
  }

  async function challengeAndVerify(code, isEnrollment) {
    if (!state.factorId || !/^\d{6}$/.test(code)) {
      throw new Error("کد شش‌رقمی اپلیکیشن رو درست وارد کن.");
    }
    const challenge = await authRequest(
      "/auth/v1/factors/" + encodeURIComponent(state.factorId) + "/challenge",
      "POST",
      {},
      state.accessToken,
    );
    state.challengeId = challenge.id;
    if (!state.challengeId) throw new Error("درخواست چالش دومرحله‌ای ناموفق بود.");

    const result = await authRequest(
      "/auth/v1/factors/" + encodeURIComponent(state.factorId) + "/verify",
      "POST",
      { challenge_id: state.challengeId, code },
      state.accessToken,
    );

    if (result.access_token) state.accessToken = result.access_token;
    if (result.refresh_token) state.refreshToken = result.refresh_token;

    let claims = decodeJwt(state.accessToken);
    if (claims.aal !== "aal2" && state.refreshToken) {
      const refreshed = await authRequest("/auth/v1/token?grant_type=refresh_token", "POST", {
        refresh_token: state.refreshToken,
      });
      if (refreshed.access_token) state.accessToken = refreshed.access_token;
      if (refreshed.refresh_token) state.refreshToken = refreshed.refresh_token;
      claims = decodeJwt(state.accessToken);
    }
    if (claims.aal !== "aal2") {
      throw new Error("ورود دومرحله‌ای هنوز تأیید نشده. کد تازه‌ای از اپلیکیشن وارد کن.");
    }

    state.enrollmentSecret = "";
    $("#mfa-qr").removeAttribute("src");
    $("#mfa-secret").textContent = "—";
    showApp();
    await loadDashboard();
    return isEnrollment;
  }

  async function edgeAction(action, data) {
    const response = await fetch(authUrl("/functions/v1/blog-admin"), {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        Authorization: "Bearer " + state.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...(data || {}) }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearSession();
      showAuth("login");
      throw new Error("نشست ورود منقضی شده؛ دوباره وارد شو.");
    }
    if (response.status === 403 && payload.code === "mfa_required") {
      clearSession();
      showAuth("login");
      throw new Error("برای ورود به پنل باید دوباره مرحلۀ دوم احراز هویت رو تکمیل کنی.");
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || payload.error || "درخواست به پنل مدیریت ناموفق بود.");
    }
    return payload;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("fa-IR").format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    })[character]);
  }

  function safePreviewUrl(value, image) {
    const url = String(value || "").trim();
    if (image) {
      if (url.startsWith("/") && !url.startsWith("//")) return url;
      return url.startsWith(MEDIA_PREFIX) ? url : null;
    }
    if (url.startsWith("/") || url.startsWith("#") || url.startsWith("mailto:")) return url;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" ? parsed.href : null;
    } catch {
      return null;
    }
  }

  function inlinePreview(source) {
    let value = escapeHtml(source);
    value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (all, label, rawUrl) => {
      const url = safePreviewUrl(rawUrl, false);
      return url ? "<a href=\"" + escapeHtml(url) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + label + "</a>" : label;
    });
    value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\x60([^\x60]+)\x60/g, "<code>$1</code>");
    return value;
  }

  function markdownPreview(markdown) {
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const output = [];
    let index = 0;
    let inCode = false;
    let codeLanguage = "";
    let code = [];
    let paragraph = [];
    let listType = "";
    let listItems = [];
    const tick = String.fromCharCode(96).repeat(3);

    function flushParagraph() {
      if (paragraph.length) {
        output.push("<p>" + paragraph.map(inlinePreview).join("<br>") + "</p>");
        paragraph = [];
      }
    }
    function flushList() {
      if (!listItems.length) return;
      output.push("<" + listType + ">" + listItems.map((item) => "<li>" + inlinePreview(item) + "</li>").join("") + "</" + listType + ">");
      listItems = [];
      listType = "";
    }
    function flushCode() {
      output.push("<pre><code" + (codeLanguage ? " data-language=\"" + escapeHtml(codeLanguage) + "\"" : "") + ">" +
        escapeHtml(code.join("\n")) + "</code></pre>");
      code = [];
      codeLanguage = "";
    }

    while (index < lines.length) {
      const line = lines[index++];
      if (line.startsWith(tick)) {
        if (inCode) { flushCode(); inCode = false; }
        else { flushParagraph(); flushList(); inCode = true; codeLanguage = line.slice(3).trim().replace(/[^a-z0-9_+-]/gi, ""); }
        continue;
      }
      if (inCode) { code.push(line); continue; }
      if (!line.trim()) { flushParagraph(); flushList(); continue; }
      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { flushParagraph(); flushList(); output.push("<hr>"); continue; }
      const heading = /^(#{1,4})\s+(.+)$/.exec(line);
      if (heading) {
        flushParagraph(); flushList();
        const level = Math.max(2, heading[1].length);
        output.push("<h" + level + ">" + inlinePreview(heading[2]) + "</h" + level + ">");
        continue;
      }
      const quote = /^>\s?(.*)$/.exec(line);
      if (quote) { flushParagraph(); flushList(); output.push("<blockquote><p>" + inlinePreview(quote[1]) + "</p></blockquote>"); continue; }
      const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
      const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
      if (unordered || ordered) {
        flushParagraph();
        const nextType = unordered ? "ul" : "ol";
        if (listType && listType !== nextType) flushList();
        listType = nextType;
        listItems.push((unordered || ordered)[1]);
        continue;
      }
      flushList();
      paragraph.push(line);
    }
    if (inCode) flushCode();
    flushParagraph();
    flushList();
    return output.join("");
  }

  function setStatusBadge(status) {
    const badge = $("#post-status-badge");
    const data = status === "published"
      ? { label: "منتشرشده", className: "status-published" }
      : status === "archived"
      ? { label: "بایگانی", className: "status-archived" }
      : { label: "پیش‌نویس", className: "status-draft" };
    badge.textContent = data.label;
    badge.className = "status-badge " + data.className;
  }

  function showAppMessage(text, type) {
    appMessage(text, type);
    if (text && type !== "error") {
      window.setTimeout(() => {
        if ($("#app-message").textContent === text) appMessage("");
      }, 4200);
    }
  }

  function switchView(name) {
    state.view = name;
    views.forEach((view) => view.classList.toggle("is-active", view.id === "view-" + name));
    document.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    const titles = { dashboard: "نمای کلی", posts: "مقاله‌ها", editor: "ویرایش مقاله", media: "کتابخانۀ تصاویر", settings: "تنظیمات وبلاگ" };
    $("#current-section-title").textContent = titles[name] || "مدیریت محتوا";
    $("#sidebar").classList.remove("is-open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function postStatusLabel(status) {
    return status === "published" ? "منتشرشده" : status === "archived" ? "بایگانی" : "پیش‌نویس";
  }

  function renderDashboard() {
    const total = state.posts.length;
    const published = state.posts.filter((post) => post.status === "published").length;
    const drafts = state.posts.filter((post) => post.status === "draft").length;
    $("#stat-total").textContent = formatNumber(total);
    $("#stat-published").textContent = formatNumber(published);
    $("#stat-drafts").textContent = formatNumber(drafts);
    $("#stat-media").textContent = formatNumber(state.media.length);
    $("#nav-post-count").textContent = formatNumber(total);
    const recent = [...state.posts].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)).slice(0, 6);
    $("#recent-posts").innerHTML = recent.length ? recent.map((post) =>
      "<div class=\"recent-row\"><div class=\"recent-row-main\"><strong>" + escapeHtml(post.title) +
      "</strong><small>" + escapeHtml(post.slug) + " · " + escapeHtml(formatDate(post.updated_at)) +
      "</small></div><span class=\"status-badge " + (post.status === "published" ? "status-published" : post.status === "archived" ? "status-archived" : "status-draft") +
      "\">" + postStatusLabel(post.status) + "</span></div>"
    ).join("") : "<p class=\"empty-state\">هنوز مقاله‌ای ایجاد نشده. اولین نوشته رو شروع کن.</p>";
  }

  function renderPosts() {
    const query = $("#posts-search").value.trim().toLocaleLowerCase();
    const status = $("#posts-status").value;
    const language = $("#posts-language").value;
    const posts = state.posts.filter((post) =>
      (status === "all" || post.status === status) &&
      (language === "all" || post.language === language) &&
      (!query || (post.title + " " + post.slug + " " + (post.category || "")).toLocaleLowerCase().includes(query))
    );
    const body = $("#posts-table-body");
    if (!posts.length) {
      body.innerHTML = "<tr><td class=\"empty-state\" colspan=\"5\">مقاله‌ای با این فیلترها پیدا نشد.</td></tr>";
      return;
    }
    body.innerHTML = posts.map((post) => {
      const statusClass = post.status === "published" ? "status-published" : post.status === "archived" ? "status-archived" : "status-draft";
      const publicLink = post.status === "published"
        ? "<a href=\"/blog/" + encodeURIComponent(post.slug) + "/\" target=\"_blank\" rel=\"noopener noreferrer\">مشاهده</a>"
        : "";
      return "<tr><td><a class=\"table-title\" href=\"#\" data-edit-post=\"" + escapeHtml(post.id) + "\">" +
        escapeHtml(post.title) + "<small dir=\"ltr\">/blog/" + escapeHtml(post.slug) + "/</small></a></td><td>" +
        escapeHtml(post.category || "—") + "</td><td><span class=\"status-badge " + statusClass + "\">" + postStatusLabel(post.status) +
        "</span></td><td>" + escapeHtml(formatDate(post.updated_at)) + "</td><td><div class=\"row-actions\">" +
        "<button type=\"button\" data-edit-post=\"" + escapeHtml(post.id) + "\">ویرایش</button>" + publicLink +
        (post.status === "published"
          ? "<button type=\"button\" data-unpublish-post=\"" + escapeHtml(post.id) + "\">عدم انتشار</button>"
          : "<button type=\"button\" class=\"danger\" data-archive-post=\"" + escapeHtml(post.id) + "\">بایگانی</button>") +
        "</div></td></tr>";
    }).join("");
  }

  function getFaqs() {
    return [...document.querySelectorAll(".faq-row")].map((row) => ({
      question: row.querySelector("[data-faq-question]").value.trim(),
      answer: row.querySelector("[data-faq-answer]").value.trim(),
    })).filter((faq) => faq.question && faq.answer);
  }

  function renderFaqs(faqs) {
    const list = $("#faq-list");
    list.replaceChildren();
    (faqs || []).forEach((faq) => addFaqRow(faq.question, faq.answer));
    if (!list.children.length) {
      const empty = document.createElement("p");
      empty.className = "field-help";
      empty.textContent = "در صورت نیاز، سؤال و پاسخ‌های کوتاه و واقعی اضافه کن.";
      list.appendChild(empty);
    }
  }

  function addFaqRow(question, answer) {
    const list = $("#faq-list");
    if (list.querySelector(".field-help")) list.replaceChildren();
    const row = document.createElement("div");
    row.className = "faq-row";
    const q = document.createElement("input");
    q.type = "text"; q.maxLength = 240; q.placeholder = "سؤال"; q.value = question || ""; q.dataset.faqQuestion = "true";
    const a = document.createElement("input");
    a.type = "text"; a.maxLength = 1600; a.placeholder = "پاسخ"; a.value = answer || ""; a.dataset.faqAnswer = "true";
    const remove = document.createElement("button");
    remove.type = "button"; remove.textContent = "حذف";
    remove.addEventListener("click", () => row.remove());
    row.append(q, a, remove);
    list.appendChild(row);
  }

  function collectPost() {
    return {
      ...(state.currentPost?.id ? { id: state.currentPost.id } : {}),
      title: $("#post-title").value.trim(),
      slug: $("#post-slug").value.trim().toLowerCase(),
      language: $("#post-language").value,
      excerpt: $("#post-excerpt").value.trim(),
      category: $("#post-category").value.trim(),
      tags: $("#post-tags").value.split(/[,،]/).map((tag) => tag.trim()).filter(Boolean),
      content: $("#post-content").value,
      seo_title: $("#seo-title").value.trim(),
      meta_description: $("#seo-description").value.trim(),
      focus_keyword: $("#seo-keyword").value.trim(),
      canonical_url: $("#seo-canonical").value.trim(),
      og_title: $("#og-title").value.trim(),
      og_description: $("#og-description").value.trim(),
      og_image_url: $("#og-image").value.trim(),
      robots_index: $("#robots-index").checked,
      robots_follow: $("#robots-follow").checked,
      hero_image_url: $("#hero-image-url").value.trim(),
      hero_image_alt: $("#hero-image-alt").value.trim(),
      hero_image_caption: $("#hero-image-caption").value.trim(),
      content_width: $("#post-width").value,
      featured: $("#post-featured").value === "true",
      toc_enabled: $("#post-toc").checked,
      drop_cap: $("#post-drop-cap").checked,
      accent_color: state.currentPost?.accent_color || "#405a42",
      faqs: getFaqs(),
    };
  }

  function fillEditor(post) {
    state.currentPost = post ? { ...post } : null;
    $("#editor-title").textContent = post ? "ویرایش مقاله" : "مقالۀ جدید";
    $("#editor-status-line").textContent = post
      ? "آخرین ذخیره: " + formatDate(post.updated_at)
      : "پیش‌نویس جدید، هنوز ذخیره نشده";
    const fields = {
      "post-title": post?.title || "",
      "post-slug": post?.slug || "",
      "post-language": post?.language || "fa",
      "post-excerpt": post?.excerpt || "",
      "post-category": post?.category || "",
      "post-tags": (post?.tags || []).join("، "),
      "post-content": post?.content || "",
      "seo-title": post?.seo_title || "",
      "seo-description": post?.meta_description || "",
      "seo-keyword": post?.focus_keyword || "",
      "seo-canonical": post?.canonical_url || "",
      "og-title": post?.og_title || "",
      "og-description": post?.og_description || "",
      "og-image": post?.og_image_url || "",
      "hero-image-url": post?.hero_image_url || "",
      "hero-image-alt": post?.hero_image_alt || "",
      "hero-image-caption": post?.hero_image_caption || "",
      "post-width": post?.content_width || "reading",
      "post-featured": String(post?.featured === true),
    };
    Object.entries(fields).forEach(([id, value]) => { $("#" + id).value = value; });
    $("#robots-index").checked = post?.robots_index !== false;
    $("#robots-follow").checked = post?.robots_follow !== false;
    $("#post-toc").checked = post?.toc_enabled !== false;
    $("#post-drop-cap").checked = post?.drop_cap === true;
    renderFaqs(post?.faqs || []);
    renderHeroImage(post?.hero_image_url);
    $("#public-post-link").hidden = post?.status !== "published";
    $("#public-post-link").href = post?.status === "published" ? "/blog/" + post.slug + "/" : "#";
    $("#public-post-link").textContent = post?.has_unpublished_changes
      ? "ویرایش‌های جدید هنوز منتشر نشده‌اند ↗" : "مشاهدۀ مقالۀ منتشرشده ↗";
    setStatusBadge(post?.status || "draft");
    $("#publish-state-note").textContent = post?.status === "published"
      ? (post?.has_unpublished_changes ? "تغییرات جدید ذخیره شده‌اند، اما هنوز در سایت عمومی نیستند." : "این نسخه در وبلاگ عمومی نمایش داده می‌شه.")
      : "این مقاله فقط در پنل مدیریت ذخیره می‌شه.";
    switchEditorTab("content");
    updatePreview();
    updateSeo();
    switchView("editor");
  }

  function renderHeroImage(url) {
    const box = $("#hero-image-preview");
    box.replaceChildren();
    if (url && (url.startsWith(MEDIA_PREFIX) || url.startsWith("/"))) {
      const img = document.createElement("img");
      img.src = url; img.alt = ""; img.loading = "lazy";
      box.appendChild(img);
    } else {
      const label = document.createElement("span");
      label.textContent = "بدون تصویر شاخص";
      box.appendChild(label);
    }
  }

  function switchEditorTab(tab) {
    document.querySelectorAll("[data-editor-tab]").forEach((button) => {
      const active = button.dataset.editorTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-editor-pane]").forEach((pane) =>
      pane.classList.toggle("is-active", pane.dataset.editorPane === tab)
    );
  }

  function updatePreview() {
    const html = markdownPreview($("#post-content").value);
    $("#live-preview").innerHTML = html || "<div class=\"preview-empty\">پیش‌نمایش متن اینجا نمایش داده می‌شه.</div>";
    const words = $("#post-content").value.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / ($("#post-language").value === "en" ? 220 : 180)));
    $("#word-count").textContent = formatNumber(words) + " کلمه";
    $("#side-word-count").textContent = formatNumber(words);
    $("#side-reading-time").textContent = formatNumber(minutes) + " دقیقه";
    $("#side-slug").textContent = $("#post-slug").value || "—";
    updateSeo();
  }

  function setSeoChecks(items) {
    $("#seo-checks").innerHTML = items.map((item) =>
      "<li class=\"" + (item.ok ? "is-good" : "") + "\">" + escapeHtml(item.label) + "</li>"
    ).join("");
  }

  function updateSeo() {
    const title = $("#post-title").value.trim();
    const slug = $("#post-slug").value.trim();
    const excerpt = $("#post-excerpt").value.trim();
    const seoTitle = $("#seo-title").value.trim() || title;
    const description = $("#seo-description").value.trim() || excerpt;
    const keyword = $("#seo-keyword").value.trim().toLocaleLowerCase();
    const content = $("#post-content").value.toLocaleLowerCase();
    const category = $("#post-category").value.trim();
    const tags = $("#post-tags").value.trim();
    const image = $("#hero-image-url").value.trim();
    const alt = $("#hero-image-alt").value.trim();
    const checks = [
      { label: "عنوان مقاله وارد شده", ok: title.length >= 12 },
      { label: "عنوان SEO در بازۀ پیشنهادی ۳۰ تا ۶۰ کاراکتره", ok: seoTitle.length >= 30 && seoTitle.length <= 60 },
      { label: "توضیحات متا حدود ۱۲۰ تا ۱۶۰ کاراکتره", ok: description.length >= 120 && description.length <= 160 },
      { label: "کلمۀ کلیدی در عنوان یا توضیحات دیده می‌شه", ok: Boolean(keyword && (seoTitle.toLocaleLowerCase().includes(keyword) || description.toLocaleLowerCase().includes(keyword))) },
      { label: "کلمۀ کلیدی در متن مقاله استفاده شده", ok: Boolean(keyword && content.includes(keyword)) },
      { label: "مقاله چند تیتر ساختاری داره", ok: (content.match(/^#{2,4}\s/gm) || []).length >= 2 },
      { label: "دسته‌بندی و برچسب مشخص شدن", ok: Boolean(category && tags) },
      { label: "برای تصویر شاخص متن Alt وارد شده", ok: !image || Boolean(alt) },
      { label: "نشانی مقاله کوتاه و معتبره", ok: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) },
      { label: "متن مقاله حداقل ۶۰۰ کلمه داره", ok: content.trim().split(/\s+/).filter(Boolean).length >= 600 },
    ];
    const score = Math.round(checks.filter((item) => item.ok).length / checks.length * 100);
    $("#seo-score").textContent = formatNumber(score) + " / 100";
    $("#seo-title-count").textContent = formatNumber(seoTitle.length) + " / ۹۰";
    $("#seo-description-count").textContent = formatNumber(description.length) + " / ۲۲۰";
    $("#excerpt-count").textContent = formatNumber(excerpt.length) + " / ۴۲۰";
    $("#seo-preview-title").textContent = seoTitle || "عنوان مقاله اینجا نمایش داده می‌شه";
    $("#seo-preview-slug").textContent = slug || "article-slug";
    $("#seo-preview-description").textContent = description || "توضیحات متا بعد از وارد کردن نمایش داده می‌شه.";
    setSeoChecks(checks);
  }

  async function saveDraft() {
    const post = collectPost();
    const result = await edgeAction("save_post", { post });
    state.currentPost = result.post;
    $("#editor-title").textContent = "ویرایش مقاله";
    $("#editor-status-line").textContent = "آخرین ذخیره: " + formatDate(result.post.updated_at);
    $("#side-saved").textContent = formatDate(result.post.updated_at);
    setStatusBadge(result.post.status);
    $("#public-post-link").hidden = result.post.status !== "published";
    $("#public-post-link").href = result.post.status === "published" ? "/blog/" + result.post.slug + "/" : "#";
    $("#publish-state-note").textContent = result.post.status === "published"
      ? "پیش‌نویس جدید ذخیره شده؛ برای نمایش تغییرات، دوباره منتشر کن."
      : "این مقاله فقط در پنل مدیریت ذخیره می‌شه.";
    await loadPosts(false);
    showAppMessage("پیش‌نویس با موفقیت ذخیره شد.", "success");
    return result.post;
  }

  async function publishPost() {
    if (!state.currentPost?.id) await saveDraft();
    const result = await edgeAction("publish_post", { id: state.currentPost.id });
    if (result.warning) {
      showAppMessage(result.warning, "error");
    } else {
      state.currentPost = result.post || state.currentPost;
      setStatusBadge("published");
      $("#publish-state-note").textContent = "نسخۀ مقاله به مخزن انتشار اضافه شد؛ بعد از Deploy در وبلاگ عمومی دیده می‌شه.";
      $("#public-post-link").hidden = false;
      $("#public-post-link").href = "/blog/" + state.currentPost.slug + "/";
      $("#public-post-link").textContent = "مشاهدۀ مقالۀ منتشرشده ↗";
      showAppMessage("مقاله برای انتشار ثبت شد. GitHub Pages حالا Build و Deploy رو اجرا می‌کنه.", "success");
    }
    await loadPosts(false);
  }

  async function loadPosts(render = true) {
    const result = await edgeAction("list_posts");
    state.posts = result.posts || [];
    if (render) renderPosts();
    renderDashboard();
  }

  async function loadSettings() {
    const result = await edgeAction("get_settings");
    state.settings = result.settings;
    fillSettings(result.settings);
  }

  function fillSettings(settings) {
    const fields = {
      "setting-title": settings.title,
      "setting-tagline": settings.tagline,
      "setting-description": settings.description,
      "setting-theme": settings.background_theme,
      "setting-accent": settings.accent_color,
      "setting-card-style": settings.card_style,
      "setting-per-page": String(settings.posts_per_page),
      "setting-meta-title": settings.default_meta_title,
      "setting-meta-description": settings.default_meta_description,
      "setting-og-image": settings.default_og_image,
      "setting-footer": settings.footer_note,
    };
    Object.entries(fields).forEach(([id, value]) => { $("#" + id).value = value || ""; });
    $("#setting-search").checked = settings.show_search !== false;
    $("#setting-categories").checked = settings.show_categories !== false;
    $("#setting-featured").checked = settings.show_featured !== false;
    $("#setting-reading-time").checked = settings.show_reading_time !== false;
  }

  function collectSettings() {
    return {
      title: $("#setting-title").value.trim(),
      tagline: $("#setting-tagline").value.trim(),
      description: $("#setting-description").value.trim(),
      background_theme: $("#setting-theme").value,
      accent_color: $("#setting-accent").value,
      card_style: $("#setting-card-style").value,
      posts_per_page: Number($("#setting-per-page").value),
      show_search: $("#setting-search").checked,
      show_categories: $("#setting-categories").checked,
      show_featured: $("#setting-featured").checked,
      show_reading_time: $("#setting-reading-time").checked,
      default_meta_title: $("#setting-meta-title").value.trim(),
      default_meta_description: $("#setting-meta-description").value.trim(),
      default_og_image: $("#setting-og-image").value.trim(),
      footer_note: $("#setting-footer").value.trim(),
    };
  }

  async function saveSettings() {
    const result = await edgeAction("save_settings", { settings: collectSettings() });
    state.settings = result.settings;
    showAppMessage("تنظیمات ذخیره شد؛ برای اعمال عمومی باید اون‌ها رو منتشر کنی.", "success");
  }

  async function publishSettings() {
    await saveSettings();
    const result = await edgeAction("publish_settings");
    showAppMessage("تنظیمات عمومی وبلاگ منتشر شد. Commit: " + (result.commitSha || "ثبت شد"), "success");
  }

  async function loadMedia() {
    const result = await edgeAction("list_media");
    state.media = result.media || [];
    renderMedia();
    renderDashboard();
  }

  function renderMedia() {
    const grid = $("#media-grid");
    if (!state.media.length) {
      grid.innerHTML = "<p class=\"empty-state\">هنوز تصویری بارگذاری نشده.</p>";
      return;
    }
    grid.innerHTML = state.media.map((item) =>
      "<article class=\"media-item\"><img src=\"" + escapeHtml(item.publicUrl) + "\" alt=\"\" loading=\"lazy\">" +
      "<div class=\"media-item-meta\"><span>" + escapeHtml(item.name) + "</span><span>" +
      (item.size ? formatNumber(Math.round(item.size / 1024)) + " KB" : "") + "</span></div>" +
      "<div class=\"media-item-actions\"><button type=\"button\" data-use-media=\"" + escapeHtml(item.publicUrl) + "\">استفاده به‌عنوان تصویر شاخص</button>" +
      "<button type=\"button\" class=\"danger\" data-delete-media=\"" + escapeHtml(item.path) + "\">حذف</button></div></article>"
    ).join("");
  }

  async function compressImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("فقط تصویر JPEG، PNG یا WebP مجازه.");
    if (file.size > 25 * 1024 * 1024) throw new Error("حجم فایل اصلی نباید بیشتر از ۲۵ مگابایت باشه.");
    if (typeof createImageBitmap !== "function") throw new Error("مرورگر از فشرده‌سازی تصویر پشتیبانی نمی‌کنه.");
    const bitmap = await createImageBitmap(file);
    const maxSide = 2400;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      bitmap.close();
      throw new Error("فضای فشرده‌سازی تصویر در مرورگر آماده نشد.");
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    async function toBlob(type, quality) {
      return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    }
    let blob = await toBlob("image/webp", 0.84);
    let extension = "webp";
    if (!blob) {
      blob = await toBlob("image/jpeg", 0.86);
      extension = "jpg";
    }
    if (!blob) throw new Error("فشرده‌سازی تصویر انجام نشد.");
    if (blob.size > Number(config.maxImageBytes || 8388608)) {
      blob = await toBlob("image/webp", 0.68);
      if (!blob || blob.size > Number(config.maxImageBytes || 8388608)) {
        throw new Error("تصویر بعد از فشرده‌سازی هنوز از ۸ مگابایت بزرگ‌تره.");
      }
    }
    return new File([blob], "blog-image-" + Date.now() + "." + extension, { type: blob.type });
  }

  async function uploadImage(file, statusSelector) {
    const statusNode = $(statusSelector);
    state.originalImageBytes = file.size;
    if (statusNode) statusNode.textContent = "در حال فشرده‌سازی تصویر…";
    const compressed = await compressImage(file);
    const saving = Math.max(0, Math.round((1 - compressed.size / file.size) * 100));
    if (statusNode) statusNode.textContent = "فشرده‌سازی کامل شد؛ " +
      formatNumber(Math.round(file.size / 1024)) + " به " + formatNumber(Math.round(compressed.size / 1024)) +
      " کیلوبایت (" + formatNumber(saving) + "٪ کاهش). در حال بارگذاری…";

    const upload = await edgeAction("create_upload_url", { mimeType: compressed.type });
    const path = String(upload.path || "");
    if (!path.startsWith("images/") || !upload.token) throw new Error("نشانی امن بارگذاری دریافت نشد.");
    const url = authUrl("/storage/v1/object/upload/sign/" +
      encodeURIComponent("blog-media") + "/" +
      path.split("/").map(encodeURIComponent).join("/") +
      "?token=" + encodeURIComponent(upload.token));
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": compressed.type, "x-upsert": "false" },
      body: compressed,
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.message || "بارگذاری تصویر در کتابخانه ناموفق بود.");
    }
    if (statusNode) statusNode.textContent = "تصویر بارگذاری شد؛ " +
      formatNumber(Math.round(compressed.size / 1024)) + " کیلوبایت.";
    return upload.publicUrl;
  }

  async function useImageFile(file, statusSelector) {
    if (!file) return;
    try {
      const url = await uploadImage(file, statusSelector);
      $("#hero-image-url").value = url;
      renderHeroImage(url);
      await loadMedia();
      updateSeo();
    } catch (error) {
      if ($(statusSelector)) $(statusSelector).textContent = error.message;
      showAppMessage(error.message, "error");
    }
  }

  async function loadDashboard() {
    const [posts, settings, media] = await Promise.all([
      edgeAction("list_posts"),
      edgeAction("get_settings"),
      edgeAction("list_media"),
    ]);
    state.posts = posts.posts || [];
    state.settings = settings.settings;
    state.media = media.media || [];
    fillSettings(state.settings);
    renderDashboard();
    renderPosts();
  }

  function resetEditor() {
    fillEditor(null);
    $("#side-saved").textContent = "—";
    $("#compression-result").textContent = "";
    $("#hero-image-file").value = "";
  }

  function insertMarkdown(type) {
    const textarea = $("#post-content");
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const samples = {
      h2: ["## ", selected || "عنوان بخش"],
      h3: ["### ", selected || "زیرعنوان"],
      bold: ["**", selected || "متن پررنگ", "**"],
      italic: ["*", selected || "متن مورب", "*"],
      quote: ["> ", selected || "نقل‌قول"],
      ul: ["- ", selected || "گزینۀ فهرست"],
      ol: ["1. ", selected || "گزینۀ فهرست"],
      link: ["[", selected || "متن لینک", "](https://example.com)"],
      code: ["\x60", selected || "code", "\x60"],
      hr: ["\n---\n"],
    };
    const parts = samples[type];
    if (!parts) return;
    const replacement = parts.join("");
    textarea.setRangeText(replacement, start, end, "select");
    textarea.focus();
    updatePreview();
  }

  function setEditorActionBusy(busy) {
    ["#save-draft", "#publish-post", "#side-save", "#side-publish"].forEach((selector) => {
      const button = $(selector);
      if (button) button.disabled = busy;
    });
  }

  async function withEditorBusy(task, button) {
    if (state.busy) return;
    state.busy = true;
    setEditorActionBusy(true);
    if (button) button.dataset.busy = "true";
    try {
      await task();
    } catch (error) {
      showAppMessage(error.message || "عملیات انجام نشد.", "error");
    } finally {
      state.busy = false;
      setEditorActionBusy(false);
      if (button) delete button.dataset.busy;
    }
  }

  async function loadDashboardSafe() {
    try {
      await loadDashboard();
    } catch (error) {
      showAppMessage(error.message || "دریافت اطلاعات ناموفق بود.", "error");
      if (!state.accessToken) showAuth("login");
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!hasConfig() || state.busy) return;
    state.busy = true;
    buttonBusy(loginButton, true, "در حال بررسی…", "ورود به پنل");
    message("#auth-message", "");
    try {
      await signIn($("#login-email").value.trim(), $("#login-password").value);
      $("#login-password").value = "";
      if (appShell.hidden) message("#auth-message", "برای ادامۀ ورود، کد دومرحله‌ای رو وارد کن.", "success");
    } catch (error) {
      state.accessToken = "";
      state.refreshToken = "";
      message("#auth-message", error.message || "ورود ناموفق بود.");
    } finally {
      state.busy = false;
      loginButton.disabled = false;
      loginButton.textContent = "ورود به پنل ←";
    }
  });

  mfaChallengeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.busy) return;
    state.busy = true;
    buttonBusy($("#mfa-submit"), true, "در حال تأیید…", "تأیید و ورود");
    message("#mfa-message", "");
    try {
      await challengeAndVerify($("#mfa-code").value.trim(), false);
    } catch (error) {
      message("#mfa-message", error.message || "کد تأیید نامعتبره.");
    } finally {
      state.busy = false;
      $("#mfa-submit").disabled = false;
      $("#mfa-submit").textContent = "تأیید و ورود";
    }
  });

  mfaEnrollForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.busy) return;
    state.busy = true;
    buttonBusy($("#mfa-enroll-submit"), true, "در حال فعال‌سازی…", "فعال‌سازی و ادامه");
    message("#mfa-enroll-message", "");
    try {
      await challengeAndVerify($("#mfa-enroll-code").value.trim(), true);
    } catch (error) {
      message("#mfa-enroll-message", error.message || "فعال‌سازی دومرحله‌ای ناموفق بود.");
    } finally {
      state.busy = false;
      $("#mfa-enroll-submit").disabled = false;
      $("#mfa-enroll-submit").textContent = "فعال‌سازی و ادامه";
    }
  });

  $("#forgot-password").addEventListener("click", async () => {
    const email = $("#login-email").value.trim();
    if (!email) {
      message("#auth-message", "اول ایمیل حساب رو وارد کن.");
      $("#login-email").focus();
      return;
    }
    try {
      await authRequest("/auth/v1/recover", "POST", {
        email,
        redirect_to: config.siteUrl + "/blog-admin/",
      });
      message("#auth-message", "در صورت معتبر بودن ایمیل، لینک بازیابی از طرف Supabase ارسال می‌شه.", "success");
    } catch (error) {
      message("#auth-message", error.message);
    }
  });

  $("#copy-secret").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.enrollmentSecret);
      message("#mfa-enroll-message", "کد راه‌اندازی کپی شد؛ اون رو در جای امن نگه دار.", "success");
    } catch {
      message("#mfa-enroll-message", "کپی خودکار ممکن نیست؛ کد رو دستی انتخاب کن.");
    }
  });

  $("#back-to-login").addEventListener("click", () => {
    state.accessToken = ""; state.refreshToken = ""; state.factorId = ""; state.challengeId = "";
    showAuth("login");
  });

  $("#logout-button").addEventListener("click", async () => {
    const token = state.accessToken;
    clearSession();
    if (token) {
      await fetch(authUrl("/auth/v1/logout?scope=local"), {
        method: "POST",
        headers: { apikey: config.publishableKey, Authorization: "Bearer " + token },
      }).catch(() => {});
    }
    showAuth("login");
    message("#auth-message", "از حساب خارج شدی.", "success");
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      if (view === "media") void loadMedia().catch((error) => showAppMessage(error.message, "error"));
      if (view === "settings") void loadSettings().catch((error) => showAppMessage(error.message, "error"));
      if (view === "posts") void loadPosts(true).catch((error) => showAppMessage(error.message, "error"));
      switchView(view);
    });
  });

  $("#mobile-nav-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("is-open"));
  document.querySelectorAll("[data-new-post]").forEach((button) => button.addEventListener("click", resetEditor));
  document.querySelectorAll("[data-open-posts]").forEach((button) => button.addEventListener("click", () => {
    renderPosts(); switchView("posts");
  }));
  $("#back-to-posts").addEventListener("click", () => { renderPosts(); switchView("posts"); });
  document.querySelectorAll("[data-editor-tab]").forEach((button) => button.addEventListener("click", () => switchEditorTab(button.dataset.editorTab)));
  document.querySelectorAll("[data-insert]").forEach((button) => button.addEventListener("click", () => insertMarkdown(button.dataset.insert)));

  ["#post-title", "#post-slug", "#post-excerpt", "#post-content", "#post-category", "#post-tags", "#seo-title",
    "#seo-description", "#seo-keyword", "#seo-canonical", "#og-title", "#og-description", "#og-image",
    "#hero-image-url", "#hero-image-alt", "#hero-image-caption"].forEach((selector) => {
    $(selector).addEventListener("input", () => {
      if (selector === "#post-title" && !$("#post-slug").dataset.edited && !state.currentPost) {
        $("#post-slug").value = $("#post-title").value.trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
      }
      updatePreview();
    });
  });
  $("#post-slug").addEventListener("input", () => { $("#post-slug").dataset.edited = "true"; });
  $("#post-language").addEventListener("change", updatePreview);
  $("#post-excerpt").addEventListener("input", updateSeo);
  $("#posts-search").addEventListener("input", renderPosts);
  $("#posts-status").addEventListener("change", renderPosts);
  $("#posts-language").addEventListener("change", renderPosts);

  $("#preview-toggle").addEventListener("click", () => {
    const grid = $("#writing-grid");
    const enabled = grid.classList.toggle("is-preview");
    $("#preview-toggle").textContent = enabled ? "بازگشت به ویرایش" : "پیش‌نمایش";
  });
  $("#save-draft").addEventListener("click", (event) =>
    withEditorBusy(saveDraft, event.currentTarget));
  $("#side-save").addEventListener("click", () => withEditorBusy(saveDraft, $("#side-save")));
  $("#publish-post").addEventListener("click", (event) => {
    if (!state.currentPost?.id && !$("#post-title").value.trim()) {
      showAppMessage("اول عنوان مقاله رو وارد کن.", "error");
      return;
    }
    withEditorBusy(publishPost, event.currentTarget);
  });
  $("#side-publish").addEventListener("click", () => withEditorBusy(publishPost, $("#side-publish")));
  $("#add-faq").addEventListener("click", () => addFaqRow("", ""));

  $("#hero-image-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    void useImageFile(file, "#compression-result");
    event.target.value = "";
  });
  $("#media-upload-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file, "#media-upload-status");
      showAppMessage("تصویر به کتابخانه اضافه شد.", "success");
      await loadMedia();
    } catch (error) {
      $("#media-upload-status").textContent = error.message;
      showAppMessage(error.message, "error");
    } finally {
      event.target.value = "";
    }
  });
  $("#remove-hero-image").addEventListener("click", () => {
    $("#hero-image-url").value = "";
    renderHeroImage("");
    updateSeo();
  });

  $("#media-grid").addEventListener("click", async (event) => {
    const use = event.target.closest("[data-use-media]");
    const remove = event.target.closest("[data-delete-media]");
    if (use) {
      const url = use.dataset.useMedia;
      $("#hero-image-url").value = url;
      renderHeroImage(url);
      $("#hero-image-alt").focus();
      updateSeo();
      switchView("editor");
      switchEditorTab("design");
      showAppMessage("تصویر برای مقالۀ فعلی انتخاب شد.", "success");
    } else if (remove) {
      if (!window.confirm("این تصویر از کتابخانۀ عمومی حذف بشه؟ اگر در مقاله‌ای استفاده شده باشه، اون تصویر هم از دسترس خارج می‌شه.")) return;
      try {
        await edgeAction("delete_media", { path: remove.dataset.deleteMedia });
        await loadMedia();
        showAppMessage("تصویر حذف شد.", "success");
      } catch (error) {
        showAppMessage(error.message, "error");
      }
    }
  });

  $("#posts-table-body").addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-post]");
    const unpublish = event.target.closest("[data-unpublish-post]");
    const archive = event.target.closest("[data-archive-post]");
    if (edit) {
      try {
        const result = await edgeAction("get_post", { id: edit.dataset.editPost });
        if (!result.post) throw new Error("مقاله پیدا نشد.");
        fillEditor(result.post);
      } catch (error) { showAppMessage(error.message, "error"); }
    } else if (unpublish) {
      if (!window.confirm("این مقاله از وبلاگ عمومی حذف و به پیش‌نویس تبدیل بشه؟")) return;
      try {
        const result = await edgeAction("unpublish_post", { id: unpublish.dataset.unpublishPost });
        state.posts = state.posts.map((post) => post.id === result.post.id ? result.post : post);
        renderPosts(); renderDashboard();
        showAppMessage("مقاله از انتشار خارج شد. بعد از Deploy نشانی عمومی دیگه نمایش داده نمی‌شه.", "success");
      } catch (error) { showAppMessage(error.message, "error"); }
    } else if (archive) {
      if (!window.confirm("مقاله به بایگانی منتقل بشه؟ اگر منتشر شده باشه، از وبلاگ عمومی حذف می‌شه.")) return;
      try {
        const result = await edgeAction("archive_post", { id: archive.dataset.archivePost });
        state.posts = state.posts.map((post) => post.id === result.post.id ? result.post : post);
        renderPosts(); renderDashboard();
        showAppMessage("مقاله بایگانی شد.", "success");
      } catch (error) { showAppMessage(error.message, "error"); }
    }
  });

  $("#save-settings").addEventListener("click", async () => {
    try { await saveSettings(); }
    catch (error) { showAppMessage(error.message, "error"); }
  });
  $("#publish-settings").addEventListener("click", async () => {
    if (!window.confirm("تنظیمات فعلی وبلاگ روی نسخۀ عمومی اعمال بشن؟")) return;
    try { await publishSettings(); }
    catch (error) { showAppMessage(error.message, "error"); }
  });

  $("#setting-accent").addEventListener("change", () => {
    const swatches = [...document.querySelectorAll(".swatch")];
    swatches.forEach((swatch) => swatch.classList.remove("is-active"));
    const names = ["#405a42", "#737443", "#a45c45", "#435b75", "#765b77"];
    const found = names.indexOf($("#setting-accent").value);
    if (found >= 0 && swatches[found]) swatches[found].classList.add("is-active");
  });

  if (!hasConfig()) {
    loginButton.disabled = true;
    message("#auth-message", "تنظیمات اتصال Supabase معتبر نیست.");
  } else {
    showAuth("login");
  }
})();
