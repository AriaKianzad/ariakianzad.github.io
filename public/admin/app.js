(() => {
  "use strict";

  const config = window.MIAN_E_MA_DASHBOARD_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const state = { accessToken: "", refreshToken: "", stats: null, range: 30, busy: false };

  const loginView = $("#login-view");
  const dashboardView = $("#dashboard-view");
  const loginForm = $("#login-form");
  const loginButton = $("#login-button");
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
    return true;
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

    if (response.status === 401 && !retried && await refreshSession()) {
      return requestStats(true);
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

  function render(stats) {
    state.stats = stats;
    renderMetrics(stats);
    renderChart(stats.history, state.range);
    renderHistory(stats.history);
  }

  async function loadDashboard() {
    const button = $("#refresh-button");
    setBusy(true, button, "به‌روزرسانی آمار", "در حال دریافت…");
    setDashboardMessage("در حال دریافت آمار از GitHub…");
    try {
      const stats = await requestStats(false);
      render(stats);
      setDashboardMessage("");
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
})();