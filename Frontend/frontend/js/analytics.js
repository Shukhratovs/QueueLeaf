// js/analytics.js
import { api } from "./api.js";

/* ==========================================================
   GLOBAL STATE
   ==========================================================*/
let liveRefreshInterval = null;

/* ==========================================================
   UTILITY: SAFE CHART DESTROY
   ==========================================================*/
function safeDestroy(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
}

/* ==========================================================
   LIVE REFRESH
   ==========================================================*/
document
  .getElementById("live-refresh-toggle")
  .addEventListener("change", (e) => {
    if (e.target.checked) startLiveRefresh();
    else stopLiveRefresh();
  });

function startLiveRefresh() {
  stopLiveRefresh();
  liveRefreshInterval = setInterval(async () => {
    const range = document.getElementById("range-select").value;
    await loadAnalytics(range);
  }, 10000);
}

function stopLiveRefresh() {
  if (liveRefreshInterval) {
    clearInterval(liveRefreshInterval);
    liveRefreshInterval = null;
  }
}

/* ==========================================================
   DATE RANGE SELECTOR
   ==========================================================*/
const rangeSelect = document.getElementById("range-select");
const customRange = document.getElementById("custom-range");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");

rangeSelect.addEventListener("change", () => {
  if (rangeSelect.value === "custom") {
    customRange.classList.remove("hidden");
  } else {
    customRange.classList.add("hidden");
    loadAnalytics(rangeSelect.value);
  }
});

document.getElementById("apply-custom").addEventListener("click", () => {
  const start = startDateInput.value;
  const end = endDateInput.value;

  if (!start || !end) {
    alert("Please select a start and end date.");
    return;
  }

  loadAnalytics({ start, end });
});

/* ==========================================================
   MAIN ANALYTICS LOADING
   ==========================================================*/
async function loadAnalytics(range = 7) {
  try {
    // 1. Load global stats
    const global = await api("/analytics/global");

    document.getElementById("total-tickets").textContent =
      global.totalTickets ?? "–";
    document.getElementById("served-tickets").textContent =
      global.servedTickets ?? "–";
    document.getElementById("total-queues").textContent =
      global.totalQueues ?? "–";

    // 2. Load daily analytics
    let daily;

    if (typeof range === "object") {
      const { start, end } = range;
      daily = await api(`/analytics/custom?start=${start}&end=${end}`);
    } else {
      daily = await api(`/analytics/daily?days=${range}`);
    }

    // 3. Render charts
    renderServedTrend(daily);
    renderWaitTrend(daily); // placeholder
    const heatmap = buildAggregatedHeatmap(daily);
    renderHeatmap(heatmap);

    renderPeakDayChart(calculatePeakDays(daily));
  } catch (err) {
    if (err.status === 401) {
      stopLiveRefresh();
      window.location.href = "login.html";
    }
  }
}

/* ==========================================================
   CHART: Served Trend (Line)
   ==========================================================*/
function renderServedTrend(data) {
  safeDestroy("chart-served-trend");

  const labels = data.map((d) => d.date.substring(5)); // show "MM-DD"
  const served = data.map((d) => d.served);
  const left = data.map((d) => d.left || 0);

  new Chart(document.getElementById("chart-served-trend"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Served",
          data: served,
          borderColor: "#0d9488",
          backgroundColor: "rgba(13,148,136,0.15)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        },
        {
          label: "Left Queue",
          data: left,
          borderColor: "#e11d48",
          backgroundColor: "rgba(225,29,72,0.15)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
}

/* ==========================================================
   CHART: Wait Time Trend (Line) — Placeholder
   ==========================================================*/
function renderWaitTrend(data) {
  safeDestroy("chart-wait-trend");

  const waitTimes = data.map((d) => d.avgWaitMinutes);
  const labels = data.map((d) => d.date.substring(5)); // MM-DD

  new Chart(document.getElementById("chart-wait-trend"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Avg Wait (min)",
          data: waitTimes,
          borderColor: "#f97316",
          backgroundColor: "rgba(249,115,22,0.2)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
}

/* ==========================================================
   HEATMAP (Placeholder Until API Exists)
   ==========================================================*/

function renderHeatmap(heatmap) {
  const grid = document.getElementById("heatmap-grid");
  grid.innerHTML = "";

  const days = Object.keys(heatmap);

  // Header row
  grid.innerHTML += `<div></div>`;
  for (let h = 0; h < 24; h++) {
    grid.innerHTML += `<div class="text-gray-500 text-center">${h}</div>`;
  }

  // Rows
  days.forEach((day) => {
    grid.innerHTML += `<div class="font-medium text-gray-700">${day}</div>`;

    heatmap[day].forEach((value, hour) => {
      let opacity = Math.min(value / 10, 1); // scale dynamically (feel free to tune)

      grid.innerHTML += `
        <div
          title="${day} ${hour}:00 — ${value} customers"
          class="h-4"
          style="background-color: rgba(13,148,136,${opacity});"
        ></div>
      `;
    });
  });
}

function buildAggregatedHeatmap(daily) {
  // Create structure: Mon–Sun mapped to zero-filled 24-hour array
  const heatmap = {
    Mon: Array(24).fill(0),
    Tue: Array(24).fill(0),
    Wed: Array(24).fill(0),
    Thu: Array(24).fill(0),
    Fri: Array(24).fill(0),
    Sat: Array(24).fill(0),
    Sun: Array(24).fill(0),
  };

  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  daily.forEach((day) => {
    const d = new Date(day.date);
    let dow = (d.getDay() + 6) % 7; // convert: Mon=0

    const dayName = names[dow];

    // hour ranges 0–23
    for (let h = 0; h < 24; h++) {
      heatmap[dayName][h] += day.hourly[h] || 0;
    }
  });

  return heatmap;
}

/* ==========================================================
   PEAK DAY OF WEEK (Bar Chart)
   ==========================================================*/
function calculatePeakDays(daily) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Initialize counters
  const totals = {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
    Sat: 0,
    Sun: 0,
  };

  daily.forEach((day) => {
    const dateObj = new Date(day.date + "T00:00:00");
    const jsIndex = dateObj.getDay(); // 0=Sun
    const ourIndex = (jsIndex + 6) % 7; // convert to Mon=0

    const dayName = names[ourIndex];
    totals[dayName] += day.total || 0;
  });

  return totals;
}

function renderPeakDayChart(totals) {
  safeDestroy("chart-peak-day");

  new Chart(document.getElementById("chart-peak-day"), {
    type: "bar",
    data: {
      labels: Object.keys(totals),
      datasets: [
        {
          label: "Customers",
          data: Object.values(totals),
          backgroundColor: [
            "#0d9488",
            "#0ea5e9",
            "#818cf8",
            "#f43f5e",
            "#f97316",
            "#22c55e",
            "#eab308",
          ],
        },
      ],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

/* ==========================================================
   AUTH + INITIAL LOAD
   ==========================================================*/
async function verifyAuth() {
  try {
    await api("/auth/me");
    return true;
  } catch {
    window.location.href = "login.html";
    return false;
  }
}

(async () => {
  const ok = await verifyAuth();
  if (ok) {
    await loadAnalytics();

    document.getElementById("live-refresh-toggle").checked = true;
    startLiveRefresh();
  }
})();
