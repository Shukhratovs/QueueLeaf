// js/staff.js
import { api } from "./api.js";

let queuesClickBound = false;

// ===============================
// STAFF LOGIN PAGE LOGIC
// ===============================

// Detect if we're on index.html (login page)
const loginForm = document.querySelector("#login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.querySelector("#email").value.trim();
    const password = document.querySelector("#password").value.trim();

    try {
      // Send login request to backend
      const res = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      console.log("Login success:", res);

      // Redirect to staff dashboard after login
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error("Login failed:", err);
      const msg = document.querySelector("#login-error");
      msg.style.display = "block";
      msg.textContent = "Invalid login. Please try again.";
    }
  });
}

// ===============================
// DASHBOARD PAGE LOGIC
// ===============================

const dashboardPage = document.querySelector("#queues-container");

async function verifyAuth() {
  try {
    const user = await api("/auth/me");
    console.log("Authenticated as:", user);
    return true;
  } catch {
    console.warn("Not logged in. Redirecting...");
    window.location.href = "index.html";
    return false;
  }
}

async function loadQueues() {
  try {
    const queues = await api("/queues");
    const container = document.getElementById("queues-container");
    container.innerHTML = "";

    if (queues.length === 0) {
      container.innerHTML = `
    <div class="col-span-full bg-white rounded-2xl shadow p-8 text-center border border-gray-200">
      <h3 class="text-lg font-semibold text-gray-800 mb-2">No queues created yet</h3>
      <p class="text-gray-500 text-sm mb-4">
        Click the button above to create your first queue.
      </p>
      <button 
        id="empty-create-btn"
        class="px-4 py-2 bg-brand text-white rounded-lg font-medium shadow hover:bg-brandDark transition"
      >
        + Create Queue
      </button>
    </div>
  `;

      // allow creating queue from empty-state button
      document
        .getElementById("empty-create-btn")
        ?.addEventListener("click", () => {
          document.getElementById("btn-new-queue").click();
        });

      return;
    }

    queues.forEach((q) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
  <div class="bg-white rounded-2xl shadow-md p-5 border border-gray-100 hover:shadow-lg transition hover:scale-[1.02] transition-transform duration-200
">

    <!-- Queue Name -->
    <h3 class="text-lg font-semibold text-gray-800 mb-1">${q.name}</h3>

    <!-- Status Badge -->
    <span class="inline-block px-3 py-1 text-xs font-medium rounded-full 
      ${q.isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}">
      ${q.isOpen ? "Open" : "Closed"}
    </span>

    <!-- Avg Service Time -->
    <p class="text-gray-500 text-sm mt-2">
      Avg service: ${Math.round((q.avgServiceSec || 300) / 60)} min
    </p>

    <!-- Action Buttons -->
    <div class="mt-4 flex items-center gap-2">

      <!-- MANAGE -->
      <button 
        data-action="manage"
        data-id="${q.id}"
        class="flex-1 bg-brand text-white py-2 rounded-lg text-sm font-medium shadow hover:bg-brandDark transition"
      >
        Manage
      </button>

      <!-- QR -->
      <button 
        data-action="qr"
        data-id="${q.id}"
        class="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-200 transition"
      >
        QR
      </button>

      <!-- DELETE -->
      <button 
        data-action="delete"
        data-id="${q.id}"
        class="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg border border-red-200 hover:bg-red-200 transition"
      >
        Delete
      </button>

    </div>
  </div>
`;
      card.classList.add("animate-fadeInUp");
      container.appendChild(card);
    });

    if (!queuesClickBound) {
      queuesClickBound = true;

      container.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.dataset.action;

        // ---------------------------
        // MANAGE
        // ---------------------------
        if (action === "manage") {
          sessionStorage.setItem("activeQueueId", id);
          window.location.href = `manage-queue.html?queueId=${id}`;
          return;
        }

        // ---------------------------
        // DELETE
        // ---------------------------
        if (action === "delete") {
          const confirmDelete = confirm(
            "Are you sure you want to delete this queue?"
          );
          if (!confirmDelete) return;

          try {
            await api(`/queues/${id}`, { method: "DELETE" });
            await loadQueues();
          } catch (err) {
            // If backend returned 409, the message will say "Queue has tickets..."
            const msg = err.message.toLowerCase();

            if (msg.includes("queue has tickets")) {
              const force = confirm("This queue has tickets. Force delete?");
              if (force) {
                await api(`/queues/${id}?force=true`, { method: "DELETE" });
                await loadQueues();
              }
              return;
            }

            console.error("Delete failed:", err);
            alert("Delete failed: " + err.message);
          }

          return;
        }

        // ---------------------------
        // QR HANDLER (handled in next step)
        // ---------------------------
        // -------- QR --------
        if (action === "qr") {
          // 1. Build the join URL for this queue
          const joinUrl = `https://queueleaf-frontend.vercel.app/join-queue.html?queueId=${id}`;

          // 2. Clear previous QR state
          qrCanvas.innerHTML = "";
          qrUrl.textContent = "";

          // 3. Generate QR code
          new QRCode(qrCanvas, {
            text: joinUrl,
            width: 256,
            height: 256,
          });

          // 4. Show URL underneath
          qrUrl.textContent = joinUrl;

          // Ensure QR image is ready before downloading
          setTimeout(() => {
            const img = qrCanvas.querySelector("img");
            if (img) {
              const downloadBtn = document.getElementById("qr-download");
              downloadBtn.href = img.src; // data URL of the PNG
            }
          }, 200);

          // 5. Show modal
          qrModal.classList.remove("hidden");
          qrBackdrop.classList.remove("hidden");

          return;
        }
      });
    }
  } catch (err) {
    console.error("Error loading queues:", err);
  }
}

if (dashboardPage) {
  (async () => {
    const ok = await verifyAuth();
    if (ok) await loadQueues();
  })();
}

// ===============================
// QR MODAL OPEN/CLOSE
// ===============================
const qrModal = document.getElementById("qr-modal");
const qrBackdrop = document.getElementById("qr-modal-backdrop");
const qrClose = document.getElementById("qr-close");
const qrCanvas = document.getElementById("qr-canvas");
const qrUrl = document.getElementById("qr-url");

// Helper function to close modal and clear content
function closeQRModal() {
  qrModal.classList.add("hidden");
  qrBackdrop.classList.add("hidden");
  qrCanvas.innerHTML = ""; // clear old QR image
  qrUrl.textContent = ""; // clear URL text
}

// Close modal via Close button
if (qrClose) {
  qrClose.addEventListener("click", closeQRModal);
}

// Close modal by clicking backdrop
if (qrBackdrop) {
  qrBackdrop.addEventListener("click", closeQRModal);
}

// ===============================
// LOGOUT BUTTON
// ===============================
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      sessionStorage.clear();
      localStorage.clear();
      window.location.href = "login.html";
    } catch (err) {
      console.error("Logout failed:", err);
    }
  });
}

// ===============================
// NEW QUEUE MODAL OPEN/CLOSE
// ===============================
const modal = document.getElementById("new-queue-modal");
const btnNewQueue = document.getElementById("btn-new-queue");
const btnCancelModal = document.getElementById("new-queue-cancel");

if (btnNewQueue && modal && btnCancelModal) {
  // Open modal
  btnNewQueue.addEventListener("click", () => {
    modal.classList.remove("hidden");
    document
      .getElementById("new-queue-modal-backdrop")
      .classList.remove("hidden");
  });

  // Close modal
  btnCancelModal.addEventListener("click", () => {
    modal.classList.add("hidden");
    document.getElementById("new-queue-modal-backdrop").classList.add("hidden");
  });

  document
    .getElementById("new-queue-modal-backdrop")
    .addEventListener("click", () => {
      modal.classList.add("hidden");
      document
        .getElementById("new-queue-modal-backdrop")
        .classList.add("hidden");
    });
}

const btnCreateModal = document.getElementById("new-queue-create");
const inputName = document.getElementById("new-queue-name");
const inputAvg = document.getElementById("new-queue-avg");

if (btnCreateModal && modal && inputName && inputAvg) {
  btnCreateModal.addEventListener("click", async () => {
    const name = inputName.value.trim();
    const avg = Number(inputAvg.value.trim());

    if (!name) {
      alert("Queue name is required.");
      return;
    }

    try {
      // Send to backend
      await api("/queues", {
        method: "POST",
        body: JSON.stringify({
          name,
          avgServiceSec: (avg || 5) * 60,
        }),
      });

      // Hide modal
      modal.classList.add("hidden");

      document
        .getElementById("new-queue-modal-backdrop")
        .classList.add("hidden");

      // Clear inputs
      inputName.value = "";
      inputAvg.value = 5;

      // Reload dashboard queues
      await loadQueues();
    } catch (err) {
      console.error("Create queue failed:", err);
      alert("Failed to create queue. Check console.");
    }
  });
}
