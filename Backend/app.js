/* QueueLeaf – static vanilla JS with Night Mode */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
// --- API config ---
const API_BASE = "http://localhost:3001";
const LOCATION_ID = "7874adec-7300-4bc5-a562-e5bb0b6f646b"; // <- my UUID
// make them visible in DevTools console
window.API_BASE = API_BASE;
window.LOCATION_ID = LOCATION_ID;

async function api(path, opts) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}



// ---------- Persistence ----------
const ls = {
  get(k, fb){ try{ return JSON.parse(localStorage.getItem(k)) ?? fb }catch{ return fb } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)) }catch{} }
};

// ---------- Theme ----------
const THEME_KEY = "queueleaf_theme";
const prefersDark = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

// always update both attribute and dataset for max compatibility
function setTheme(t) {
  const html = document.documentElement;
  html.setAttribute("data-theme", t);
  html.dataset.theme = t;
  try { localStorage.setItem(THEME_KEY, JSON.stringify(t)); } catch {}
  const b = document.getElementById("theme-toggle");
  if (b) b.textContent = t === "dark" ? "☀️" : "🌙";
}

(function initTheme() {
  // read saved theme
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(THEME_KEY)); } catch {}
  const initial = saved || (prefersDark() ? "dark" : "light");
  setTheme(initial);

  // user toggle
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(cur === "dark" ? "light" : "dark");
  });

  // watch system only if the user hasn't made a choice
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (!saved && mq && mq.addEventListener) {
    mq.addEventListener("change", (e) => setTheme(e.matches ? "dark" : "light"));
  }
})();

// ---------- Store ----------
const initialStore = {
  isOpen: true,
  customMsg: "Welcome to QueueLeaf demo!",
  avgServiceMins: 6,
  tickets: [], // {id,name,party,contact,status,createdAt,servedAt}
  staff: { loggedIn: false },
  history: []
};
let store = ls.get("queueleaf_store", initialStore);
function save(){ ls.set("queueleaf_store", store); }

// ---------- Helpers ----------
const uid = () => Math.random().toString(36).slice(2,10);
const fmtMins = (m) => `${Math.max(0, Math.round(Number(m)||0))} min`;
const waitingTickets = () => store.tickets.filter(t => t.status === "waiting" || t.status === "called");
const updateTicket = (id, patch) => { store.tickets = store.tickets.map(t => t.id===id? {...t, ...patch}: t); save(); render(); }

// ---------- Routing ----------
function setRoute(route){
  $$(".nav-btn").forEach(b => { if (b.dataset.route) b.classList.toggle("active", b.dataset.route === route); });
  ["join","status","staff","analytics"].forEach(r => { const page = $("#page-"+r); if (page) page.hidden = r !== route; });
  ls.set("queueleaf_route", route);
  render();
}
$$(".nav-btn").forEach(btn => btn.addEventListener("click", () => btn.dataset.route && setRoute(btn.dataset.route)));
setRoute(ls.get("queueleaf_route", "join"));

// ---------- JOIN ----------
function renderJoin(){
  if ($("#page-join").hidden) return;
  const queueLen = store.tickets.filter(t => t.status === "waiting").length;
  $("#avg-wait").textContent = fmtMins(queueLen * store.avgServiceMins);
  $("#custom-message").textContent = store.customMsg || "";
  $("#closed-msg").style.display = store.isOpen ? "none" : "block";
  $("#join-btn").disabled = !store.isOpen;
}
// JOIN -> create ticket in backend (no local guard)
$("#join-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fd = new FormData(e.target);
  const payload = {
    name: (fd.get("name") || "").toString().trim(),
    party_size: Math.max(1, Number(fd.get("party")) || 1),
    contact: ((fd.get("contact") || "").toString().trim()) || null,
  };

  try {
    const created = await api(`/api/tickets/${LOCATION_ID}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    // remember your ticket
    ls.set("queueleaf_lastTicket", created.id);
    // go to Status
    setRoute("status");
  } catch (err) {
    console.error("Join failed:", err);
    alert("Failed to join queue. Check console for details.");
  }
});


// ---------- STATUS ----------
async function renderStatus(){
  if ($("#page-status").hidden) return;

  const tid = ls.get("queueleaf_lastTicket", null);

  // 1) load current queue (waiting + called)
  let list = [];
  try {
    list = await api(`/api/tickets?locationId=${LOCATION_ID}`);
  } catch (e) {
    console.error(e);
    $("#status-stats").style.display = "none";
    $("#queue-list").innerHTML = "<p class='subtle'>Failed to load queue.</p>";
    return;
  }

  // 2) if no saved ticket yet
  if (!tid){
    $("#status-stats").style.display = "none";
    $("#ticket-name").textContent = "—";
    $("#ticket-id").textContent = "#----";
    $("#ticket-status").textContent = "waiting";
    $("#your-position").textContent = "-";
    $("#your-eta").textContent = "-";
    $("#queue-list").innerHTML = "<p class='subtle'>No ticket selected yet. Join the queue to see your status.</p>";
    $("#leave-queue").style.display = "none";
    return;
  }

  // 3) find my ticket among waiting/called
  const me = list.find(x => x.id === tid);

  // if not found, it's likely already served/cancelled
  if (!me){
    $("#status-stats").style.display = "none";
    $("#ticket-name").textContent = "—";
    $("#ticket-id").textContent = "#----";
    $("#ticket-status").textContent = "waiting";
    $("#your-position").textContent = "-";
    $("#your-eta").textContent = "-";
    $("#queue-list").innerHTML = "<p class='subtle'>Your ticket is not in the active queue. It may have been served or cancelled. Join again if needed.</p>";
    $("#leave-queue").style.display = "none";
    return;
  }

  // 4) stats for my ticket
  $("#status-stats").style.display = "grid";
  $("#leave-queue").style.display = (me.status === "waiting" || me.status === "called") ? "inline-block" : "none";
  $("#ticket-name").textContent = me.name;
  $("#ticket-id").textContent = "#" + me.id.slice(0,4);
  $("#ticket-status").textContent = me.status;

  const idx = list.findIndex(x => x.id === me.id);
  $("#your-position").textContent = idx >= 0 ? (idx + 1) : "-";
  const avg = store?.avgServiceMins || 6;
  $("#your-eta").textContent = `${Math.max(0, idx) * avg} min`;

  // 5) render queue snapshot
  const ol = $("#queue-list");
  ol.innerHTML = "";
  if (list.length === 0){
    const p = document.createElement("p");
    p.className = "subtle";
    p.textContent = "No one is waiting.";
    ol.appendChild(p);
  } else {
    list.forEach((x, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="row">
          <div class="pos">${i + 1}</div>
          <div class="value">${x.name}</div>
          <span class="pill">party ${x.party_size}</span>
          ${x.status === "called" ? '<span class="pill" style="background:#dcfce7;color:#166534">called</span>' : ""}
        </div>
        <div class="micro subtle">${new Date(x.created_at).toLocaleTimeString()}</div>
      `;
      if (x.id === me.id) li.style.borderColor = "#14b8a6";
      ol.appendChild(li);
    });
  }
}

// Leave Queue -> cancel ticket in backend
$("#leave-queue").addEventListener("click", async () => {
  const tid = ls.get("queueleaf_lastTicket", null);
  if (!tid) return;
  try {
    await api(`/api/ticket/${tid}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" })
    });
    ls.remove("queueleaf_lastTicket");
    setRoute("join");        // go back to Join page
  } catch (e) {
    console.error(e);
    alert("Failed to leave queue.");
  }
});


// ---------- STAFF ----------
// STAFF — load from API instead of local store
// STAFF — load from API instead of local store
async function renderStaff(){
  if ($("#page-staff").hidden) return;

  // -------- gate --------
  $("#staff-gate").hidden = store.staff.loggedIn;
  $("#staff-ui").hidden   = !store.staff.loggedIn;
  if (!store.staff.loggedIn) return;

  // -------- fetch live data (independent) --------
  let queue = [], settings = {}, summary = {};
  try { queue    = await api(`/api/tickets?locationId=${LOCATION_ID}`); } catch (e) { console.error("queue load failed:", e); }
  try { settings = await api(`/api/settings/${LOCATION_ID}`); }          catch (e) { console.error("settings load failed:", e); }
  try {
    const pad = n => String(n).padStart(2,"0");
    const d = new Date();
    const localDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    summary = await api(`/api/analytics/summary/${LOCATION_ID}?date=${localDate}`);
  } catch (e) { console.error("summary load failed:", e); }

  // -------- helpers --------
  const asBool = (v) => {
    if (v === true || v === false) return v;
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === "true" || s === "t" || s === "1" || s === "open";
  };

  const paintStatus = (isOpen) => {
    const pill = $("#toggle-open");
    if (pill) {
      pill.textContent = isOpen ? "Open" : "Closed";
      pill.setAttribute("aria-pressed", isOpen ? "true" : "false");
    }
    const stat = $("#stat-status");           // the big value in the header
    if (stat) stat.textContent = isOpen ? "Open" : "Closed";
  };

  // -------- stats / controls header --------
  $("#stat-inqueue").textContent = queue.length ?? 0;
  $("#stat-avg").textContent     = settings?.avg_service_mins ?? 6;
  $("#stat-served").textContent  = summary?.served ?? 0;

  const msgEl = $("#input-message");
  if (msgEl) msgEl.value = settings?.custom_message ?? "";

  const avgEl = $("#input-avg");
  if (avgEl) avgEl.value = settings?.avg_service_mins ?? 6;

  let openState = asBool(settings?.is_open);
  paintStatus(openState);

  // -------- queue table --------
  const tbody = $("#queue-body");
  tbody.innerHTML = "";
  if (!queue?.length){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="subtle">No one is waiting.</td>`;
    tbody.appendChild(tr);
  } else {
    queue.forEach((t, i) => {
      const tr = document.createElement("tr");
      const eta = i * (settings?.avg_service_mins ?? 6);
      tr.innerHTML = `
        <td class="value">${t.name}</td>
        <td>${t.party_size}</td>
        <td>${t.status}</td>
        <td class="subtle">${new Date(t.created_at).toLocaleTimeString()}</td>
        <td>${eta} min</td>
        <td>
          ${t.status === "waiting" ? '<button class="btn tiny" data-act="call">Call</button>' : ""}
          <button class="btn tiny" data-act="served">Served</button>
          <button class="btn tiny" data-act="noshow">No-show</button>
        </td>`;
      tbody.appendChild(tr);

      tr.querySelectorAll("button").forEach((b) =>
        b.onclick = async () => {
          const act = b.dataset.act;
          const status = act === "call" ? "called" : act === "served" ? "served" : "cancelled";
          try {
            await api(`/api/ticket/${t.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
            render(); // re-render current route
          } catch (err) {
            console.error(err);
            alert("Action failed");
          }
        }
      );
    });
  }

  // -------- Call next --------
  const callNext = $("#call-next");
  if (callNext) {
    callNext.onclick = async () => {
      const next = queue.find(x => x.status === "waiting") || queue[0];
      if (!next) return;
      try {
        await api(`/api/ticket/${next.id}`, { method: "PATCH", body: JSON.stringify({ status: "called" }) });
        render();
      } catch (e) { console.error(e); alert("Failed to call next"); }
    };
  }

  // -------- toggle open/closed --------
  const toggleBtn = $("#toggle-open");
  if (toggleBtn) {
    toggleBtn.onclick = async () => {
      try {
        toggleBtn.disabled = true;
        const next = !openState;

        // optimistic paint
        paintStatus(next);

        // IMPORTANT: use param route and send a real boolean
        const updated = await api(`/api/settings/${LOCATION_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ is_open: next })
        });

        openState = asBool(updated?.is_open);
        paintStatus(openState);
      } catch (err) {
        console.error("toggle open failed:", err);
        const fresh = await api(`/api/settings/${LOCATION_ID}`);
        openState = asBool(fresh?.is_open);
        paintStatus(openState);
        alert("Failed to update status");
      } finally {
        toggleBtn.disabled = false;
      }
    };
  }

  // -------- custom message --------
  if (msgEl) {
    msgEl.onchange = async () => {
      try {
        await api(`/api/settings/${LOCATION_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ custom_message: msgEl.value })
        });
      } catch (e) {
        console.error(e);
        alert("Failed to save message");
      }
    };
  }

  // -------- avg service mins --------
  if (avgEl) {
    avgEl.onchange = async () => {
      const v = Math.max(1, parseInt(avgEl.value, 10) || 6);
      try {
        await api(`/api/settings/${LOCATION_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ avg_service_mins: v })
        });
      } catch (e) {
        console.error(e);
        alert("Failed to save average time");
      }
    };
  }
}

// ----- QR CODE RENDER -----
(function renderQR() {
  const qrBox = $("#qr-box");
  if (!qrBox) return;

  qrBox.innerHTML = ""; // clear any old content

  // URL that customers will scan — this is an example link
  const joinUrl = `https://play.tetris.com/`;

  try {
    new QRCode(qrBox, {
      text: joinUrl,
      width: 160,
      height: 160,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });

    const linkLbl = document.createElement("div");
    linkLbl.className = "micro subtle";
    linkLbl.style.wordBreak = "break-all";
    linkLbl.style.textAlign = "center";
    linkLbl.style.marginTop = "0.5rem";
    linkLbl.textContent = joinUrl;
    qrBox.appendChild(linkLbl);
  } catch (err) {
    console.error("QR generation failed:", err);
    qrBox.textContent = "⚠️ QR failed to generate";
  }
})();


$("#toggle-open").addEventListener("click", ()=>{ store.isOpen = !store.isOpen; save(); render(); });
$("#input-message").addEventListener("change", (e)=>{ store.customMsg = e.target.value; save(); render(); });
$("#input-avg").addEventListener("change", (e)=>{ store.avgServiceMins = Math.max(1, Number(e.target.value||1)); save(); render(); });

// ---------- Analytics ----------
async function renderAnalytics(){
  if ($("#page-analytics").hidden) return;
  const chart = $("#chart"); chart.innerHTML = "Loading…";
  try {
    // build YYYY-MM-DD in my local timezone
    const pad = n => String(n).padStart(2, "0");
    const d = new Date();
    const localDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    const data = await api(`/api/analytics/served-per-hour/${LOCATION_ID}?date=${localDate}`);
    chart.innerHTML = "";
    const max = Math.max(1, ...data.map(d => d.served));
    data.forEach(d => {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = Math.max(2, Math.round((d.served / max) * 220)) + "px";
      bar.title = `${d.hour} • ${d.served}`;
      const label = document.createElement("span");
      label.textContent = d.served;
      bar.appendChild(label);
      chart.appendChild(bar);
    });
  } catch (e) {
    chart.textContent = "Failed to load analytics.";
    console.error(e);
  }
}

// ---------- Render dispatcher ----------
function render(){ renderJoin(); renderStatus(); renderStaff(); renderAnalytics(); }
render();
