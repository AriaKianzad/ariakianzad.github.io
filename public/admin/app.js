(() => {
  "use strict";

  const config = window.MIAN_E_MA_DASHBOARD_CONFIG || {};
  const SESSION_STORAGE_KEY = "mian-e-ma-dashboard-refresh-v1";
  const $ = (selector) => document.querySelector(selector);
  const state = { accessToken: "", refreshToken: "", stats: null, range: 30, busy: false };
  let refreshInFlight = null;

  const loginView = $("#login-view");
  const dashboardView = $("#dashboard-view");
  const loginForm = $("#login-form");
  const loginButton = $("#login-button");
  const rememberSession = $("#remember-session");
  const loginMessage = $("#login-message");
  const setupMessage = $("#setup-message");
  const dashboardMessage = $("#dashboard-message");

  const hasConfig = typeof config.supabaseUrl === "string" &&
    config.supabaseUrl.startsWith("https://") &&
    typeof config.supabaseAnonKey === "string" &&
    config.supabaseAnonKey.length > 20;

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
    let savedRefreshToken = "";
    try {
      savedRefreshToken = window.localStorage.getItem(SESSION_STORAGE_KEY) || "";
    } catch {
      return;
    }
    if (!savedRefreshToken) return;

    state.refreshToken = savedRefreshToken;
    loginButton.disabled = true;
    setLoginMessage("در حال بازیابی نشست قبلی…");

    try {
      const restored = await refreshSessionOnce();
      if (!restored) {
        clearRememberedSession();
        state.refreshToken = "";
        setLoginMessage("نشست قبلی معتبر نیست؛ دوباره وارد شو.");
        return;
      }
      showDashboard();
      await loadDashboard();
    } catch {
      clearRememberedSession();
      state.accessToken = "";
      state.refreshToken = "";
      showLogin();
      setLoginMessage("بازیابی نشست قبلی انجام نشد؛ دوباره وارد شو.");
    } finally {
      loginButton.disabled = !hasConfig;
    }
  }

  async function requestSiteAnalytics(retried) {
    const response = await fetch(apiUrl("/functions/v1/site-analytics"), {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: "Bearer " + state.accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mode: "dashboard" })
    });

    if (response.status === 401 && !retried && await refreshSessionOnce()) {
      return requestSiteAnalytics(true);
    }
    if (response.status === 401 || response.status === 403) {
      logout();
      throw new Error("این حساب مجاز به دیدن داشبورد نیست یا نشست آن منقضی شده. دوباره وارد شو.");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        status: payload.status || "error",
        message: payload.message || payload.error || "دریافت آمار گوگل ناموفق بود."
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
    clearRememberedSession();
    state.accessToken = "";
    state.refreshToken = "";
    state.stats = null;
    showLogin();
    setLoginMessage("از حساب خارج شدی.");
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
    if (badge) {
      badge.className = "status-pill " + (status === "ok" ? "ok" : status === "error" ? "error" : "pending");
      badge.textContent = status === "ok" ? "متصل" : status === "not_configured" ? "نیازمند راه‌اندازی" : "خطا در اتصال";
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

  function renderGoogleAnalytics(payload) {
    if (!payload || payload.status === "not_configured") {
      setIntegrationStatus("ga4", "not_configured", payload?.message || "برای اتصال، کلید Service Account گوگل باید در Secrets پروژه Supabase ثبت بشه.");
      setIntegrationStatus("gsc", "not_configured", payload?.message || "برای اتصال، کلید Service Account گوگل باید در Secrets پروژه Supabase ثبت بشه.");
      return;
    }

    const ga = payload.ga4 || {};
    setIntegrationStatus("ga4", ga.status, ga.message);
    if (ga.status === "ok") {
      const summary = ga.summary || {};
      $("#ga-users").textContent = formatNumber(summary.users);
      $("#ga-sessions").textContent = formatNumber(summary.sessions);
      $("#ga-views").textContent = formatNumber(summary.pageViews);
      $("#ga-download-events").textContent = formatNumber(summary.fileDownloadEvents);
      setTableRows("#ga-sources-body", (ga.sources || []).map((row) => ({
        cells: [row.sourceMedium, formatNumber(row.sessions), formatNumber(row.users)]
      })), 3);
      setTableRows("#ga-referrers-body", (ga.referrers || []).map((row) => ({
        cells: [row.referrer, formatNumber(row.events)]
      })), 2);
      setTableRows("#ga-pages-body", (ga.pages || []).map((row) => ({
        cells: [row.path, formatNumber(row.views), formatNumber(row.users)]
      })), 3);
    }

    const gsc = payload.searchConsole || {};
    setIntegrationStatus("gsc", gsc.status, gsc.message);
    if (gsc.status === "ok") {
      const summary = gsc.summary || {};
      $("#gsc-clicks").textContent = formatNumber(summary.clicks);
      $("#gsc-impressions").textContent = formatNumber(summary.impressions);
      $("#gsc-ctr").textContent = formatPercent(summary.ctr);
      $("#gsc-position").textContent = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(Number(summary.position || 0));
      const reportRows = (rows) => (rows || []).map((row) => ({
        cells: [row.name, formatNumber(row.clicks), formatNumber(row.impressions), formatPercent(row.ctr)]
      }));
      setTableRows("#gsc-queries-body", reportRows(gsc.queries), 4);
      setTableRows("#gsc-pages-body", reportRows(gsc.pages), 4);
      setTableRows("#gsc-devices-body", (gsc.devices || []).map((row) => ({
        cells: [row.name, formatNumber(row.clicks), formatNumber(row.impressions), new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(row.position)]
      })), 4);
    }
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
      const [downloadResult, googleResult] = await Promise.allSettled([
        requestStats(false),
        requestSiteAnalytics(false)
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

      if (downloadResult.status === "fulfilled" && googleResult.status === "fulfilled") {
        setDashboardMessage("گزارش‌ها به‌روزرسانی شدن.");
        window.setTimeout(() => setDashboardMessage(""), 3500);
      }
    } catch (error) {
      setDashboardMessage(error.message || "دریافت آمار ناموفق بود.", "error");
    } finally {
      setBusy(false, button, "به‌روزرسانی آمار", "در حال دریافت…");
    }
  }

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
      showDashboard();
      await loadDashboard();
      $("#password").value = "";
    } catch (error) {
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