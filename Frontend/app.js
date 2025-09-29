/* QueueLeaf – static vanilla JS with Night Mode */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

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
$("#join-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!store.isOpen) return;
  const fd = new FormData(e.target);
  const t = {
    id: uid(),
    name: (fd.get("name")||"").toString().trim(),
    party: Math.max(1, Number(fd.get("party")) || 1),
    contact: (fd.get("contact")||"").toString().trim(),
    status: "waiting",
    createdAt: Date.now()
  };
  store.tickets.push(t); save();
  ls.set("queueleaf_lastTicket", t.id);
  setRoute("status");
});

// ---------- STATUS ----------
function renderStatus(){
  if ($("#page-status").hidden) return;
  const tid = ls.get("queueleaf_lastTicket", null);
  const t = store.tickets.find(x => x.id === tid);
  const list = waitingTickets();

  if (!t){
    $("#ticket-summary").innerHTML = '<div class="subtle">No ticket selected yet. Join the queue to see your status.</div>';
    $("#status-stats").style.display = "none";
    $("#queue-list").innerHTML = "";
    $("#leave-queue").style.display = "none";
    return;
  }

  $("#status-stats").style.display = "grid";
  $("#leave-queue").style.display = (t.status === "waiting" || t.status === "called") ? "inline-block" : "none";

  $("#ticket-name").textContent = t.name;
  $("#ticket-id").textContent = "#"+t.id.slice(0,4);
  $("#ticket-status").textContent = t.status;

  const idx = list.findIndex(x => x.id === t.id);
  $("#your-position").textContent = idx >= 0 ? (idx+1) : "-";
  $("#your-eta").textContent = fmtMins(store.avgServiceMins * Math.max(0, idx));

  const ol = $("#queue-list");
  ol.innerHTML = "";
  if (list.length === 0){
    const p = document.createElement("p"); p.className="subtle"; p.textContent="No one is waiting.";
    ol.appendChild(p);
  }else{
    list.forEach((x,i)=>{
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="row">
          <div class="pos">${i+1}</div>
          <div class="value">${x.name}</div>
          <span class="pill">party ${x.party}</span>
          ${x.status==="called" ? '<span class="pill" style="background:#dcfce7;color:#166534">called</span>' : ''}
        </div>
        <div class="micro subtle">${new Date(x.createdAt).toLocaleTimeString()}</div>`;
      if (x.id === t.id) li.style.borderColor = "#14b8a6";
      ol.appendChild(li);
    });
  }
}
$("#leave-queue").addEventListener("click", () => {
  const tid = ls.get("queueleaf_lastTicket", null);
  if (!tid) return;
  updateTicket(tid, { status: "cancelled" });
  setRoute("join");
});

// ---------- STAFF ----------
function renderStaff(){
  if ($("#page-staff").hidden) return;
  $("#staff-gate").hidden = store.staff.loggedIn;
  $("#staff-ui").hidden = !store.staff.loggedIn;
  if (!store.staff.loggedIn) return;

  const queue = waitingTickets();
  $("#stat-inqueue").textContent = queue.length;
  $("#stat-avg").textContent = store.avgServiceMins;
  const today = new Date().toDateString();
  $("#stat-served").textContent = store.history.filter(h => new Date(h.servedAt||0).toDateString() === today).length;
  $("#stat-open").textContent = store.isOpen ? "Open" : "Closed";
  $("#toggle-open").textContent = store.isOpen ? "Open" : "Closed";

  $("#input-message").value = store.customMsg;
  $("#input-avg").value = store.avgServiceMins;

  const tbody = $("#queue-body"); tbody.innerHTML = "";
  queue.forEach((t,i)=>{
    const tr = document.createElement("tr");
    const eta = i * store.avgServiceMins;
    tr.innerHTML = `
      <td class="value">${t.name}</td>
      <td>${t.party}</td>
      <td>${t.status}</td>
      <td class="subtle">${new Date(t.createdAt).toLocaleTimeString()}</td>
      <td>${fmtMins(eta)}</td>
      <td>
        ${t.status === "waiting" ? '<button class="btn tiny" data-act="call">Call</button>' : ''}
        ${t.status !== "served" ? '<button class="btn tiny" data-act="served">Served</button>' : ''}
        ${t.status !== "cancelled" ? '<button class="btn tiny" data-act="noshow">No-show</button>' : ''}
        <button class="btn tiny" data-act="remove">Remove</button>
      </td>`;
    tr.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      const act = b.dataset.act;
      if (act === "call") updateTicket(t.id, { status: "called" });
      if (act === "served"){
        const served = { ...t, status: "served", servedAt: Date.now() };
        store.tickets = store.tickets.map(x => x.id===t.id? served : x);
        store.history.push(served);
        save(); render();
      }
      if (act === "noshow") updateTicket(t.id, { status: "cancelled" });
      if (act === "remove"){ store.tickets = store.tickets.filter(x => x.id !== t.id); save(); render(); }
    }));
    tbody.appendChild(tr);
  });
}
$("#staff-login").addEventListener("submit", (e)=>{
  e.preventDefault();
  const val = e.target.querySelector("input").value;
  if (val === "demo"){ store.staff.loggedIn = true; save(); render(); }
});
$("#toggle-open").addEventListener("click", ()=>{ store.isOpen = !store.isOpen; save(); render(); });
$("#input-message").addEventListener("change", (e)=>{ store.customMsg = e.target.value; save(); render(); });
$("#input-avg").addEventListener("change", (e)=>{ store.avgServiceMins = Math.max(1, Number(e.target.value||1)); save(); render(); });

// ---------- Analytics (very simple bar chart) ----------
function renderAnalytics(){
  if ($("#page-analytics").hidden) return;
  const chart = $("#chart"); chart.innerHTML = "";
  const now = new Date();
  const data = Array.from({length:12}, (_,i)=>{
    const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), i).getHours();
    const count = store.history.filter(x => new Date(x.servedAt||0).getHours() === hour).length;
    return { hour: hour + ":00", served: count };
  });
  const max = Math.max(1, ...data.map(d => d.served));
  data.forEach(d => {
    const h = Math.round((d.served / max) * 220);
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = (h||2) + "px";
    bar.title = d.hour + " • " + d.served;
    const label = document.createElement("span");
    label.textContent = d.served;
    bar.appendChild(label);
    chart.appendChild(bar);
  });
}

// ---------- Render dispatcher ----------
function render(){ renderJoin(); renderStatus(); renderStaff(); renderAnalytics(); }
render();
