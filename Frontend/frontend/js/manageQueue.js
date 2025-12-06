// js/manageQueue.js
import { api } from "./api.js";

async function init() {
  /* ============================================================
     1. GET QUEUE ID
     ============================================================ */
  const params = new URLSearchParams(window.location.search);
  const queueId =
    params.get("queueId") || sessionStorage.getItem("activeQueueId");

  if (!queueId) {
    alert("Missing queue ID");
    window.location.href = "dashboard.html";
    return;
  }

  /* ============================================================
     2. DOM REFERENCES (grouped together)
     ============================================================ */
  const el = {
    name: document.getElementById("queue-name"),
    status: document.getElementById("stat-status"),
    waiting: document.getElementById("stat-inqueue"),
    served: document.getElementById("stat-served"),

    // table
    table: document.getElementById("tickets-table"),

    // call next
    callNext: document.getElementById("call-next"),

    // modal
    openControls: document.getElementById("open-controls"),
    modal: document.getElementById("controls-modal"),
    backdrop: document.getElementById("controls-backdrop"),
    modalMsg: document.getElementById("modal-input-message"),
    modalToggle: document.getElementById("modal-toggle-open"),
    modalCancel: document.getElementById("controls-cancel"),
    modalSave: document.getElementById("controls-save"),

    // logout
    logout: document.getElementById("logout-btn"),
  };

  /* ============================================================
     3. INTERNAL HELPERS
     ============================================================ */
  function formatTime(dt) {
    if (!dt) return "—";
    return new Date(dt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusIcon(status) {
    const size = "w-4 h-4 inline-block mr-1";

    const icons = {
      waiting: `<svg class="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M12 6v6l4 2"/></svg>`,
      called: `<svg class="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M15 8l7-4v16l-7-4M4 6h8"/></svg>`,
      served: `<svg class="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
      left: `<svg class="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
    };

    return icons[status] || "";
  }

  function statusBadge(status) {
    const styles = {
      waiting: "bg-yellow-100 text-yellow-700",
      called: "bg-blue-100 text-blue-700",
      served: "bg-green-100 text-green-700",
      left: "bg-red-100 text-red-700",
    };

    return `
    <span class="px-3 py-1 text-xs font-semibold rounded-full flex items-center ${
      styles[status]
    }">
      ${statusIcon(status)} ${status}
    </span>
  `;
  }

  function actionButtons(t) {
    if (t.status === "waiting") {
      return `
        <button data-action="call" data-id="${t.id}"
          class="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
          Call
        </button>`;
    }
    if (t.status === "called") {
      return `
        <button data-action="serve" data-id="${t.id}"
          class="px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
          Serve
        </button>`;
    }
    return `<span class="text-gray-400">—</span>`;
  }

  function contactIcon(type) {
    const size = "w-4 h-4 inline-block mr-1";

    if (type === "sms") {
      return `<svg class="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-width="2" d="M3 8l9 6 9-6-9-6-9 6z"/><path stroke-width="2" d="M21 8v8l-9 6-9-6V8"/>
    </svg>`;
    }

    if (type === "email") {
      return `<svg class="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-width="2" d="M4 4h16v16H4z"/><path stroke-width="2" d="M4 4l8 8 8-8"/>
    </svg>`;
    }

    return "";
  }

  /* ============================================================
     4. LOAD QUEUE METADATA
     ============================================================ */
  async function loadQueue() {
    const queues = await api("/queues");
    const q = queues.find((x) => x.id === Number(queueId));
    if (!q) return;

    el.name.textContent = q.name;

    el.status.innerHTML = q.isOpen
      ? `<span class="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-700">Open</span>`
      : `<span class="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-700">Closed</span>`;

    // preload modal values
    el.modalMsg.value = q.customMessage || "";
    el.modalToggle.textContent = q.isOpen ? "Close Queue" : "Open Queue";
  }

  /* ============================================================
     5. LOAD TICKETS
     ============================================================ */
  async function loadTickets() {
    const tickets = await api(`/tickets/${queueId}`);
    // Sort: waiting → called → served → left
    const priority = { waiting: 1, called: 2, served: 3, left: 4 };

    tickets.sort((a, b) => priority[a.status] - priority[b.status]);
    el.table.innerHTML = ""; // clear

    if (tickets.length === 0) {
      el.table.innerHTML = `
        <tr>
          <td colspan="9" class="p-6 text-center text-gray-500">
            No tickets yet.
          </td>
        </tr>`;
      return;
    }

    const waiting = tickets.filter((t) => t.status === "waiting").length;
    const served = tickets.filter((t) => t.status === "served").length;

    el.waiting.textContent = waiting;
    el.served.textContent = served;

    tickets.forEach((t) => {
      const row = document.createElement("tr");

      let bg = "";
      if (t.status === "waiting") bg = "bg-yellow-50";
      if (t.status === "called") bg = "bg-blue-50 called-blink"; // add blinking
      if (t.status === "served") bg = "bg-green-50";
      if (t.status === "left") bg = "bg-red-50";

      row.className = `${bg} hover:bg-gray-100 hover:shadow-sm transition-all`;

      row.innerHTML = `
        <td class="p-3 font-medium text-gray-900">${t.name}</td>
        <td class="p-3 text-gray-700">${t.partySize}</td>
        <td class="p-3">${statusBadge(t.status)}</td>
        <td class="p-3 text-gray-600">${formatTime(t.createdAt)}</td>
        <td class="p-3 text-gray-600">${formatTime(t.calledAt)}</td>
        <td class="p-3 text-gray-600">${formatTime(t.servedAt)}</td>
        <td class="p-3 text-gray-600">${formatTime(t.leftAt)}</td>
       <td class="p-3 text-gray-600">
  ${contactIcon(t.contactType)} ${t.contactValue || "—"}
</td>

        <td class="p-3">${actionButtons(t)}</td>
      `;

      el.table.appendChild(row);
    });
  }

  /* ============================================================
     6. ACTION: Toggle Queue
     ============================================================ */
  async function toggleQueue() {
    await api(`/queues/${queueId}/toggle`, { method: "PATCH" });
    await loadQueue();
  }

  /* ============================================================
     7. ACTION: Save Modal Settings
     ============================================================ */
  async function saveSettings() {
    const newMsg = el.modalMsg.value.trim();

    await api(`/queues/${queueId}/message`, {
      method: "PATCH",
      body: JSON.stringify({ message: newMsg }),
    });

    await loadQueue();
    closeModal();
  }

  /* ============================================================
     8. MODAL OPEN/CLOSE
     ============================================================ */
  function openModal() {
    el.modal.classList.remove("hidden");
    el.backdrop.classList.remove("hidden");
  }

  function closeModal() {
    el.modal.classList.add("hidden");
    el.backdrop.classList.add("hidden");
  }

  /* ============================================================
     9. EVENT LISTENERS
     ============================================================ */

  // Buttons inside table
  el.table.addEventListener("click", async (e) => {
    const action = e.target.dataset.action;
    const id = e.target.dataset.id;
    if (!action || !id) return;

    const newStatus = action === "call" ? "called" : "served";

    await api(`/tickets/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });

    await loadTickets();
  });

  // call next
  el.callNext.addEventListener("click", async () => {
    const tickets = await api(`/tickets/${queueId}`);
    const next = tickets.find((t) => t.status === "waiting");
    if (!next) {
      alert("No waiting customers.");
      return;
    }

    await api(`/tickets/${next.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "called" }),
    });

    await loadTickets();
  });

  // modal
  el.openControls.addEventListener("click", openModal);
  el.modalCancel.addEventListener("click", closeModal);
  el.backdrop.addEventListener("click", closeModal);
  el.modalSave.addEventListener("click", saveSettings);
  el.modalToggle.addEventListener("click", async () => {
    await toggleQueue();
    await loadQueue();
  });

  // logout
  el.logout.addEventListener("click", async () => {
    await api("/auth/logout", { method: "POST" });
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = "login.html";
  });

  /* ============================================================
     10. AUTO REFRESH (5s interval)
     ============================================================ */
  setInterval(loadTickets, 5000);

  /* ============================================================
     11. INITIAL LOAD
     ============================================================ */
  await loadQueue();
  await loadTickets();
}

init();
