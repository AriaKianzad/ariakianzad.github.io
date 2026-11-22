(() => {
  "use strict";

  const config = window.MIAN_E_MA_DASHBOARD_CONFIG || {};
  const SESSION_STORAGE_KEY = "mian-e-ma-dashboard-refresh-v1";
  const $ = (selector) => document.querySelector(selector);
  const state = { accessToken: "", refreshToken: "", stats: null, range: 30, busy: false };
  const REALTIME_REFRESH_MS = 60_000;
  const GA4_REPORT_REFRESH_MS = 15 * 60_000;
  let refreshInFlight = null;
  let realtimeTimer = null;
  let ga4ReportTimer = null;
  let realtimeInFlight = null;
  let ga4ReportInFlight = null;

  const loginView = $("#login-view");
  const dashboardView = $("#dashboard-view");
  const loginForm = $("#login-form");
  const loginButton = $("#login-button");
  const rememberSession = $("#remember-session");
  const loginMessage = $("#login-message");
  const setupMessage = $("#setup-message");
  const dashboardMessage = $("#dashboard-message");

  const hasConfig = (() => {
    if (typeof config.supabaseUrl !== "string" || typeof config.supabaseAnonKey !== "string") return false;
    try {
      const endpoint = new URL(config.supabaseUrl);
      return endpoint.origin === "https://bkohdqwecnvbmeaiuyyx.supabase.co" &&
        endpoint.pathname === "/" && !endpoint.username && !endpoint.password &&
        !endpoint.search && !endpoint.hash &&
        config.supabaseAnonKey.startsWith("sb_publishable_") &&
        config.supabaseAnonKey.length > 20;
    } catch {
      return false;
    }
  })();

  if (!hasConfig) {
    setupMessage.hidden = false;
    loginButton.disabled = true;
    loginForm.querySelectorAll("input").forEach((input) => { input.disabled = true; });
  }

  function setBusy(busy, button, idleText, busyText) {
    state.busy = busy;
    button.disabled = busy;
    const label = button.querySelector("span");
    if (label) label.textContent = busy ? busyText : idleText;
  }

  function setLoginMessage(message) {
    loginMessage.textContent = message || "";
  }

  function setDashboardMessage(message, kind) {
    dashboardMessage.textContent = message || "";
    dashboardMessage.className = "dashboard-message" + (kind === "error" ? " error" : "");
    dashboardMessage.hidden = !message;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("fa-IR").format(Number(value || 0));
  }

  function formatDate(dateString, options) {
    const date = new Date(dateString + "T12:00:00Z");
    return new Intl.DateTimeFormat("fa-IR", options || { day: "numeric", month: "short" }).format(date);
  }

  function apiUrl(path) {
    return config.supabaseUrl.replace(/\/+$/, "") + path;
  }

  async function parseResponse(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.msg || payload.message || payload.error_description || payload.error || "درخواست ناموفق بود.");
    }
    return payload;
  }

  async function signIn(email, password) {
    const response = await fetch(apiUrl("/auth/v1/token?grant_type=password"), {
      method: "POST",
      headers: { apikey: config.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const payload = await parseResponse(response);
    if (!payload.access_token || !payload.refresh_token) {
      throw new Error("پاسخ سرویس ورود کامل نیست.");
    }
    state.accessToken = payload.access_token;
    state.refreshToken = payload.refresh_token;
    if (!persistRememberedSession()) {
      setLoginMessage("ورود انجام شد، اما مرورگر اجازهٔ ذخیرهٔ نشست رو نداد؛ ممکنه دفعهٔ بعد نیاز به ورود مجدد داشته باشی.");
    }
  }

  async function refreshSession() {
    if (!state.refreshToken) return false;
    const response = await fetch(apiUrl("/auth/v1/token?grant_type=refresh_token"), {
      method: "POST",
      headers: { apikey: config.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: state.refreshToken })
    });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => ({}));
    if (!payload.access_token) return false;
    state.accessToken = payload.access_token;
    state.refreshToken = payload.refresh_token || state.refreshToken;
    persistRememberedSession();
    return true;
  }

  function refreshSessionOnce() {
    if (!refreshInFlight) {
      refreshInFlight = refreshSession().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  function clearRememberedSession() {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Storage may be disabled by the browser; the in-memory session still works.
    }
  }

  function persistRememberedSession() {
    if (!rememberSession.checked || !state.refreshToken) {
      clearRememberedSession();
      return true;
    }
    try {
      // Store only the rotating refresh token, never the password or access token.
      window.localStorage.setItem(SESSION_STORAGE_KEY, state.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  async function restoreRememberedSession() {
    // A saved refresh token is itself evidence of a previous explicit opt-in.
    // Read it before consulting the checkbox, which is intentionally unchecked
    // in the static HTML so first-time visitors are never opted in by default.
    let savedRefreshToken = "";
    try {
      savedRefreshToken = window.localStorage.getItem(SESSION_STORAGE_KEY) || "";
    } catch {
      return;
    }
    if (!savedRefreshToken) return;

    // Keep the remembered-session preference enabled while rotating the token.
    // refreshSession() calls persistRememberedSession(), which depends on this.
    rememberSession.checked = true;
    state.refreshToken = savedRefreshToken;
    loginButton.disabled = true;
    setLoginMessage("در حال بازیابی نشست قبلی…");

    try {
      const restored = await refreshSessionOnce();
      if (!restored) {
        clearRememberedSession();
        state.refreshToken = "";
        rememberSession.checked = false;
        setLoginMessage("نشست قبلی معتبر نیست؛ دوباره وارد شو.");
        return;
      }
      showDashboard();
      await loadDashboard();
    } catch {
      clearRememberedSession();
      state.accessToken = "";
      state.refreshToken = "";
      rememberSession.checked = false;
      showLogin();
      setLoginMessage("بازیابی نشست قبلی انجام نشد؛ دوباره وارد شو.");
    } finally {
      loginButton.disabled = !hasConfig;
    }
  }

  async function requestSiteAnalytics(retried, mode = "dashboard") {
    const response = await fetch(apiUrl("/functions/v1/site-analytics"), {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: "Bearer " + state.accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mode })
    });

    if (response.status === 401 && !retried && await refreshSessionOnce()) {
      return requestSiteAnalytics(true, mode);
    }
    if (response.status === 401 || response.status === 403) {
      logout();
      throw new Error("این حساب مجاز به دیدن داشبورد نیست یا نشست آن منقضی شده. دوباره وارد شو.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        status: payload.status || "error",
        message: payload.message || payload.error || "دریافت آمار گوگل ناموفق بود.",
        requestMode: mode
      };
    }
    return payload;
  }

  async function requestStats(retried) {
    const response = await fetch(apiUrl("/functions/v1/download-stats"), {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: "Bearer " + state.accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mode: "dashboard" })
    });

    if (response.status === 401 && !retried && await refreshSessionOnce()) {
      return requestStats(true);
    }
    if (response.status === 401 || response.status === 403) {
      logout();
      throw new Error("این حساب مجاز به دیدن داشبورد نیست یا نشست آن منقضی شده. دوباره وارد شو.");
    }
    return parseResponse(response);
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
  }

  function showLogin() {
    dashboardView.hidden = true;
    loginView.hidden = false;
    $("#password").value = "";
  }

  function logout() {
    stopAutoRefresh();
    const accessToken = state.accessToken;
    clearRememberedSession();
    state.accessToken = "";
    state.refreshToken = "";
    state.stats = null;
    showLogin();
    setLoginMessage("از حساب خارج شدی.");

    // Revoke the current local Supabase session as well as clearing browser state.
    if (accessToken && hasConfig) {
      void fetch(apiUrl("/auth/v1/logout?scope=local"), {
        method: "POST",
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: "Bearer " + accessToken
        }
      }).catch(() => {
        // The browser session is already cleared; remote revocation is best-effort.
      });
    }
  }

  function renderMetrics(stats) {
    $("#total-downloads").textContent = formatNumber(stats.totalDownloads);
    $("#today-downloads").textContent = formatNumber(stats.todayDownloads);
    $("#week-downloads").textContent = formatNumber(stats.last7DaysDownloads);
    $("#month-downloads").textContent = formatNumber(stats.last30DaysDownloads);
    $("#last-updated").textContent = stats.updatedAt
      ? new Intl.DateTimeFormat("fa-IR", {
          dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran"
        }).format(new Date(stats.updatedAt))
      : "—";
    $("#history-count").textContent = formatNumber((stats.history || []).length) + " روز";
  }

  function svgNode(name, attributes) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function renderChart(history, range) {
    const chartWrap = $("#chart-wrap");
    const empty = $("#chart-empty");
    const grid = $("#chart-grid");
    const area = $("#chart-area");
    const line = $("#chart-line");
    const points = $("#chart-points");
    const labels = $("#chart-labels");

    grid.replaceChildren();
    points.replaceChildren();
    labels.replaceChildren();
    area.setAttribute("d", "");
    line.setAttribute("points", "");

    const rows = (history || []).slice(-range);
    if (!rows.length || rows.every((row) => Number(row.downloads) === 0)) {
      chartWrap.hidden = true;
      empty.hidden = false;
      return;
    }

    chartWrap.hidden = false;
    empty.hidden = true;

    const width = 920, height = 260, left = 24, right = 16, top = 14, bottom = 20;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxValue = Math.max(1, ...rows.map((row) => Number(row.downloads || 0)));
    const yMax = Math.max(1, Math.ceil(maxValue * 1.2));
    const coordinates = rows.map((row, index) => ({
      x: left + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth),
      y: top + plotHeight - (Number(row.downloads || 0) / yMax) * plotHeight,
      row
    }));

    for (let index = 0; index <= 4; index += 1) {
      const y = top + (plotHeight / 4) * index;
      grid.appendChild(svgNode("line", {
        x1: left, y1: y, x2: width - right, y2: y, class: "chart-grid-line"
      }));
    }

    line.setAttribute("points", coordinates.map((point) => point.x + "," + point.y).join(" "));
    const first = coordinates[0], last = coordinates[coordinates.length - 1];
    area.setAttribute("d", "M " + first.x + " " + (height - bottom) + " L " +
      coordinates.map((point) => point.x + " " + point.y).join(" L ") +
      " L " + last.x + " " + (height - bottom) + " Z");

    coordinates.forEach((point, index) => {
      if (index === 0 || index === coordinates.length - 1 || Number(point.row.downloads) > 0) {
        points.appendChild(svgNode("circle", {
          cx: point.x, cy: point.y, r: index === coordinates.length - 1 ? 5 : 3.4, class: "chart-point"
        }));
      }
    });

    const labelIndexes = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
    labelIndexes.forEach((index) => {
      const span = document.createElement("span");
      span.textContent = formatDate(rows[index].date);
      labels.appendChild(span);
    });
  }

  function renderHistory(history) {
    const body = $("#history-body");
    body.replaceChildren();
    const rows = (history || []).slice(-10).reverse();

    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.className = "empty-cell";
      td.textContent = "هنوز سابقه‌ای ثبت نشده.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const date = document.createElement("td");
      const daily = document.createElement("td");
      const total = document.createElement("td");

      date.textContent = formatDate(row.date, { year: "numeric", month: "short", day: "numeric" });
      daily.textContent = formatNumber(row.downloads);
      daily.className = "number" + (Number(row.downloads) > 0 ? " positive" : "");
      total.textContent = formatNumber(row.totalDownloads);
      total.className = "number";
      tr.append(date, daily, total);
      body.appendChild(tr);
    });
  }

  function setTableRows(selector, rows, columns, emptyText) {
    const body = $(selector);
    if (!body) return;
    body.replaceChildren();
    if (!Array.isArray(rows) || rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = columns;
      td.className = "empty-cell";
      td.textContent = emptyText || "داده‌ای برای این بازه ثبت نشده.";
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.cells.forEach((value, index) => {
        const td = document.createElement("td");
        td.textContent = value;
        if (index > 0) td.className = "number";
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  function setIntegrationStatus(prefix, status, message) {
    const badge = $("#" + prefix + "-status");
    const box = $("#" + prefix + "-message");
    const labels = {
      ok: "متصل",
      error: "خطا در اتصال",
      not_configured: "نیازمند راه‌اندازی",
      no_data: "اتصال برقرار، بدون داده",
      partial: "گزارش ناقص",
    };
    if (badge) {
      badge.className = "status-pill " + (status === "ok" ? "ok" : status === "error" ? "error" : "pending");
      badge.textContent = labels[status] || "وضعیت نامشخص";
    }
    if (box) {
      box.textContent = message || "";
      box.className = "integration-message" + (status === "error" ? " error" : "");
      box.hidden = !message;
    }
  }

  function formatPercent(value) {
    return new Intl.NumberFormat("fa-IR", { style: "percent", maximumFractionDigits: 1 }).format(Number(value || 0));
  }

  function renderDownloadAttribution(ga) {
    const container = $("#ga-download-attribution");
    const totalNode = $("#ga-download-attribution-total");
    if (!container) return;

    container.replaceChildren();
    const rows = Array.isArray(ga.downloadAttribution) ? ga.downloadAttribution : [];
    const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.downloads || 0)), 0);
    if (totalNode) totalNode.textContent = formatNumber(total) + " دانلود";

    if (!rows.length || total === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-cell";
      empty.textContent = "برای این بازه رویداد دانلودی ثبت نشده.";
      container.appendChild(empty);
      return;
    }

    rows.forEach((row) => {
      const downloads = Math.max(0, Number(row.downloads || 0));
      const share = total > 0 ? (downloads / total) * 100 : 0;
      const linkText = String(row.linkText || "").trim();
      const linkId = String(row.linkId || "").trim();
      const label = linkText === "دانلود رایگان کتاب"
        ? "دکمۀ Hero"
        : linkText === "دانلود مستقیم PDF"
        ? "سکشن دانلود"
        : linkText || (linkId ? "لینک با شناسه " + linkId : "متن لینک ثبت نشده");

      const item = document.createElement("div");
      item.className = "attribution-row";
      const meta = document.createElement("div");
      meta.className = "attribution-meta";
      const identity = document.createElement("div");
      identity.className = "attribution-identity";
      const name = document.createElement("span");
      name.className = "attribution-name";
      name.textContent = label;
      identity.appendChild(name);

      const detailText = linkText && label !== linkText ? linkText : (linkId ? "Link ID: " + linkId : "");
      if (detailText) {
        const detail = document.createElement("small");
        detail.className = "attribution-detail";
        detail.textContent = detailText;
        identity.appendChild(detail);
      }

      const value = document.createElement("strong");
      value.className = "attribution-value";
      value.textContent = formatNumber(downloads) + " · " + formatPercent(share / 100);
      meta.append(identity, value);

      const track = document.createElement("div");
      track.className = "attribution-track";
      track.setAttribute("role", "img");
      track.setAttribute("aria-label", label + ": " + formatNumber(downloads) + " دانلود");
      const fill = document.createElement("span");
      fill.className = "attribution-fill";
      fill.style.width = share.toFixed(2) + "%";
      track.appendChild(fill);

      item.append(meta, track);
      container.appendChild(item);
    });
  }

  function renderBookFunnel(ga) {
    const funnel = ga.funnel || {};
    const hasSummary = ga.summaryAvailable !== false && ga.status !== "no_data";
    const values = {
      siteSessions: Number(funnel.siteSessions || 0),
      bookPageSessions: Number(funnel.bookPageSessions || 0),
      bookPageUsers: Number(funnel.bookPageUsers || 0),
      bookPageViews: Number(funnel.bookPageViews || 0),
      downloadSessions: Number(funnel.downloadSessions || 0),
      downloadUsers: Number(funnel.downloadUsers || 0),
      downloadEvents: Number(funnel.downloadEvents || 0),
    };
    const display = (value) => hasSummary ? formatNumber(value) : "—";
    $("#ga-funnel-site-sessions").textContent = display(values.siteSessions);
    $("#ga-funnel-book-sessions").textContent = display(values.bookPageSessions);
    $("#ga-funnel-download-sessions").textContent = display(values.downloadSessions);
    $("#ga-funnel-site-detail").textContent = hasSummary ? "مبنای مقایسه" : "—";
    $("#ga-funnel-book-detail").textContent = hasSummary
      ? formatNumber(values.bookPageUsers) + " کاربر · " + formatNumber(values.bookPageViews) + " بازدید صفحه"
      : "—";
    $("#ga-funnel-download-detail").textContent = hasSummary
      ? formatNumber(values.downloadUsers) + " کاربر · " + formatNumber(values.downloadEvents) + " رویداد دانلود"
      : "—";
    $("#ga-funnel-book-rate").textContent = hasSummary && values.siteSessions > 0
      ? formatPercent(values.bookPageSessions / values.siteSessions) + " از نشست‌های سایت"
      : "—";
    $("#ga-funnel-download-rate").textContent = hasSummary && values.bookPageSessions > 0
      ? formatPercent(values.downloadSessions / values.bookPageSessions) + " از نشست‌های صفحه کتاب"
      : "—";
  }

  function renderBookAnalytics(ga) {
    renderDownloadAttribution(ga);
    renderBookFunnel(ga);
  }

  function renderGoogleAnalytics(payload) {
    if (!payload || payload.status === "not_configured") {
      const message = payload?.message || "برای اتصال، کلید Service Account گوگل باید در Secrets پروژه Supabase ثبت بشه.";
      setIntegrationStatus("ga4", "not_configured", message);
      setIntegrationStatus("gsc", "not_configured", message);
      return;
    }

    // A top-level failure (for example, OAuth or Supabase configuration) is
    // different from an individual GA4 or Search Console report failure.
    if (payload.status === "error" && !payload.ga4 && !payload.searchConsole) {
      const message = payload.message || payload.error || "دریافت گزارش‌های گوگل ناموفق بود.";
      setIntegrationStatus("ga4", "error", message);
      ["#ga-users", "#ga-sessions", "#ga-views", "#ga-download-events"]
        .forEach((selector) => { $(selector).textContent = "—"; });
      renderBookAnalytics({});
      if (payload.requestMode !== "ga4") {
        setIntegrationStatus("gsc", "error", message);
        ["#gsc-clicks", "#gsc-impressions", "#gsc-ctr", "#gsc-position"]
          .forEach((selector) => { $(selector).textContent = "—"; });
      }
      return;
    }

    const ga = payload.ga4 || {};
    setIntegrationStatus("ga4", ga.status, ga.message);
    const gaPeriod = $("#ga4-period");
    if (gaPeriod && ga.period) {
      gaPeriod.textContent = "بازهٔ گزارش GA4: " + ga.period + " · بر اساس منطقۀ زمانی Property";
    }
    const gaUpdated = $("#ga4-updated");
    if (gaUpdated && payload.generatedAt) {
      gaUpdated.textContent = "آخرین دریافت از API: " + new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran"
      }).format(new Date(payload.generatedAt)) + " · تازه‌سازی خودکار هر ۱۵ دقیقه";
    }
    if (["ok", "partial", "no_data"].includes(ga.status)) {
      const summary = ga.summary || {};
      const summaryAvailable = ga.summaryAvailable !== false && ga.status !== "no_data";
      $("#ga-users").textContent = summaryAvailable ? formatNumber(summary.users) : "—";
      $("#ga-sessions").textContent = summaryAvailable ? formatNumber(summary.sessions) : "—";
      $("#ga-views").textContent = summaryAvailable ? formatNumber(summary.pageViews) : "—";
      $("#ga-download-events").textContent = summaryAvailable ? formatNumber(summary.fileDownloadEvents) : "—";
      setTableRows("#ga-sources-body", (ga.sources || []).map((row) => ({
        cells: [row.sourceMedium, formatNumber(row.sessions), formatNumber(row.users)]
      })), 3);
      setTableRows("#ga-referrers-body", (ga.referrers || []).map((row) => ({
        cells: [row.referrer, formatNumber(row.events)]
      })), 2);
      setTableRows("#ga-pages-body", (ga.pages || []).map((row) => ({
        cells: [row.path, formatNumber(row.views), formatNumber(row.users)]
      })), 3);
      renderBookAnalytics(ga);
    } else {
      ["#ga-users", "#ga-sessions", "#ga-views", "#ga-download-events"]
        .forEach((selector) => { $(selector).textContent = "—"; });
      renderBookAnalytics({});
    }

    if (payload.searchConsole) {
      const gsc = payload.searchConsole;
      setIntegrationStatus("gsc", gsc.status, gsc.message);
      const gscPeriod = $("#gsc-period");
      if (gscPeriod && gsc.startDate && gsc.endDate) {
        gscPeriod.textContent = "بازهٔ گزارش Search Console: " + gsc.startDate + " تا " + gsc.endDate +
        (gsc.propertyUrl ? " · Property: " + gsc.propertyUrl : "");
      }
      if (["ok", "partial", "no_data"].includes(gsc.status)) {
        const summary = gsc.summary || {};
        const summaryAvailable = gsc.summaryAvailable !== false && gsc.status !== "no_data";
        $("#gsc-clicks").textContent = summaryAvailable ? formatNumber(summary.clicks) : "—";
        $("#gsc-impressions").textContent = summaryAvailable ? formatNumber(summary.impressions) : "—";
        $("#gsc-ctr").textContent = summaryAvailable ? formatPercent(summary.ctr) : "—";
        $("#gsc-position").textContent = summaryAvailable
          ? new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(Number(summary.position || 0))
          : "—";
        const reportRows = (rows) => (rows || []).map((row) => ({
          cells: [row.name, formatNumber(row.clicks), formatNumber(row.impressions), formatPercent(row.ctr)]
        }));
        setTableRows("#gsc-queries-body", reportRows(gsc.queries), 4);
        setTableRows("#gsc-pages-body", reportRows(gsc.pages), 4);
        setTableRows("#gsc-devices-body", (gsc.devices || []).map((row) => ({
          cells: [row.name, formatNumber(row.clicks), formatNumber(row.impressions), new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(row.position)]
        })), 4);
      } else {
        ["#gsc-clicks", "#gsc-impressions", "#gsc-ctr", "#gsc-position"]
          .forEach((selector) => { $(selector).textContent = "—"; });
      }
    }
  }

  function renderGoogleRealtime(payload) {
    const report = payload?.ga4Realtime;
    if (!report || report.status !== "ok") {
      const status = report?.status || payload?.status || "error";
      const message = report?.message || payload?.message || payload?.error ||
        "دریافت آمار لحظه‌ای GA4 ناموفق بود.";
      setIntegrationStatus("ga4-realtime", status, message);
      ["#ga4-realtime-users", "#ga4-realtime-views", "#ga4-realtime-events"]
        .forEach((selector) => { $(selector).textContent = "—"; });
      return;
    }

    setIntegrationStatus("ga4-realtime", "ok", "");
    const summary = report.summary || {};
    $("#ga4-realtime-users").textContent = formatNumber(summary.activeUsers);
    $("#ga4-realtime-views").textContent = formatNumber(summary.pageViews);
    $("#ga4-realtime-events").textContent = formatNumber(summary.events);
    const updated = $("#ga4-realtime-updated");
    if (updated && payload.generatedAt) {
      updated.textContent = "آخرین دریافت: " + new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran"
      }).format(new Date(payload.generatedAt));
    }
  }

  async function refreshGoogleRealtime() {
    if (!state.accessToken || document.hidden || state.busy || realtimeInFlight) return;
    realtimeInFlight = requestSiteAnalytics(false, "realtime")
      .then(renderGoogleRealtime)
      .catch((error) => renderGoogleRealtime({ status: "error", message: error.message }))
      .finally(() => { realtimeInFlight = null; });
    return realtimeInFlight;
  }

  async function refreshGoogleReports() {
    if (!state.accessToken || document.hidden || state.busy || ga4ReportInFlight) return;
    ga4ReportInFlight = requestSiteAnalytics(false, "ga4")
      .then(renderGoogleAnalytics)
      .catch((error) => setIntegrationStatus("ga4", "error",
        error.message || "به‌روزرسانی گزارش GA4 ناموفق بود."))
      .finally(() => { ga4ReportInFlight = null; });
    return ga4ReportInFlight;
  }

  function stopAutoRefresh() {
    if (realtimeTimer !== null) window.clearInterval(realtimeTimer);
    if (ga4ReportTimer !== null) window.clearInterval(ga4ReportTimer);
    realtimeTimer = null;
    ga4ReportTimer = null;
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    if (!state.accessToken) return;
    realtimeTimer = window.setInterval(() => { void refreshGoogleRealtime(); }, REALTIME_REFRESH_MS);
    ga4ReportTimer = window.setInterval(() => { void refreshGoogleReports(); }, GA4_REPORT_REFRESH_MS);
  }

  function render(stats) {
    state.stats = stats;
    renderMetrics(stats);
    renderChart(stats.history, state.range);
    renderHistory(stats.history);
  }

  async function loadDashboard() {
    const button = $("#refresh-button");
    setBusy(true, button, "به‌روزرسانی آمار", "در حال دریافت…");
    setDashboardMessage("در حال دریافت آمار از GitHub و سرویس‌های گوگل…");
    try {
      const [downloadResult, googleResult, realtimeResult] = await Promise.allSettled([
        requestStats(false),
        requestSiteAnalytics(false, "dashboard"),
        requestSiteAnalytics(false, "realtime")
      ]);

      if (downloadResult.status === "fulfilled") {
        render(downloadResult.value);
      } else {
        setDashboardMessage(downloadResult.reason?.message || "دریافت آمار دانلود ناموفق بود.", "error");
      }

      if (googleResult.status === "fulfilled") {
        renderGoogleAnalytics(googleResult.value);
      } else {
        setIntegrationStatus("ga4", "error", googleResult.reason?.message || "دریافت آمار GA4 ناموفق بود.");
        setIntegrationStatus("gsc", "error", googleResult.reason?.message || "دریافت آمار سرچ کنسول ناموفق بود.");
      }

      if (realtimeResult.status === "fulfilled") {
        renderGoogleRealtime(realtimeResult.value);
      } else {
        renderGoogleRealtime({ status: "error", message: realtimeResult.reason?.message });
      }

      if (downloadResult.status === "fulfilled" && googleResult.status === "fulfilled") {
        setDashboardMessage("گزارش‌ها به‌روزرسانی شدن.");
        window.setTimeout(() => setDashboardMessage(""), 3500);
      }
    } catch (error) {
      setDashboardMessage(error.message || "دریافت آمار ناموفق بود.", "error");
    } finally {
      setBusy(false, button, "به‌روزرسانی آمار", "در حال دریافت…");
      startAutoRefresh();
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.accessToken) {
      void refreshGoogleRealtime();
      void refreshGoogleReports();
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!hasConfig || state.busy) return;

    const email = $("#email").value.trim();
    const password = $("#password").value;
    if (!email || !password) return;

    setBusy(true, loginButton, "ورود", "در حال بررسی…");
    setLoginMessage("");
    try {
      await signIn(email, password);
      $("#password").value = "";
      showDashboard();
      await loadDashboard();
    } catch (error) {
      $("#password").value = "";
      clearRememberedSession();
      state.accessToken = "";
      state.refreshToken = "";
      setLoginMessage(error.message || "ورود ناموفق بود.");
    } finally {
      setBusy(false, loginButton, "ورود", "در حال بررسی…");
    }
  });

  rememberSession.addEventListener("change", () => {
    if (!rememberSession.checked) clearRememberedSession();
    else if (state.refreshToken) persistRememberedSession();
  });

  $("#refresh-button").addEventListener("click", loadDashboard);
  $("#logout-button").addEventListener("click", logout);

  document.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      state.range = Number(button.dataset.range);
      document.querySelectorAll("[data-range]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === button));
      });
      if (state.stats) renderChart(state.stats.history, state.range);
    });
  });

  void restoreRememberedSession();
})();