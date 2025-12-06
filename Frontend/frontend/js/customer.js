// js/customer.js
import { api } from "./api.js";

let lastStatus = null;

let countdownStarted = false;

let countdownInterval = null;

const urlParams = new URLSearchParams(window.location.search);
const queueIdFromUrl = urlParams.get("queueId");

const enableSoundBtn = document.getElementById("enable-sound");
const callSound = document.getElementById("call-sound");
let soundEnabled = false;

if (enableSoundBtn) {
  enableSoundBtn.addEventListener("click", () => {
    callSound.play().catch(() => {});
    soundEnabled = true;
    enableSoundBtn.style.display = "none";
  });
}
// ===============================
// STATUS PAGE LOGIC
// ===============================

const ticketId = localStorage.getItem("ticketId");
const queueId = localStorage.getItem("queueId");

// Only run this part if we're on status.html
if (document.querySelector("#status-card")) {
  const nameEl = document.getElementById("ticket-name");
  const idEl = document.getElementById("ticket-id");
  const statusEl = document.getElementById("ticket-status");
  const positionEl = document.getElementById("your-position");
  const etaEl = document.getElementById("your-eta");
  const refreshBtn = document.getElementById("refresh-btn");

  async function loadStatus() {
    try {
      if (!ticketId || !queueId) {
        alert("Missing ticket info. Please join the queue again.");
        window.location.href = "join-queue.html";
        return;
      }

      // Fetch public status
      const ticket = await api(`/tickets/public/${ticketId}`);

      if (ticket.status === "left") {
        // Replace card with a message
        document.getElementById("status-card").innerHTML = `
    <div class="text-center py-10">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">
        You have left the queue
      </h2>
      <p class="text-gray-600 mb-6">We hope to see you again.</p>
      <button
        onclick="window.location.href='join-queue.html'"
        class="px-4 py-2 bg-brand text-white rounded-lg shadow hover:bg-brandDark transition"
      >
        Join Again
      </button>
    </div>
  `;

        // Stop refresh
        if (window.__statusInterval) {
          clearInterval(window.__statusInterval);
        }

        return; // exit early
      }

      if (ticket.status === "served") {
        // Replace card with a message
        document.getElementById("status-card").innerHTML = `
    <div class="text-center py-10">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">
        All Set!!!
      </h2>
      <p class="text-gray-600 mb-6">Thank you for using Queueleaf.</p>
      <button
        onclick="window.location.href='join-queue.html'"
        class="px-4 py-2 bg-brand text-white rounded-lg shadow hover:bg-brandDark transition"
      >
        Join Again
      </button>
    </div>
  `;
        // Stop refresh
        if (window.__statusInterval) {
          clearInterval(window.__statusInterval);
        }
        localStorage.removeItem("ticketId");
        localStorage.removeItem("queueId");

        return; // exit early
      }

      updateStatusPill(ticket.status);

      /* -----------------------------------------------------
       🔔 STATUS CHANGE ALERT (called → sound + notify)
    -----------------------------------------------------*/
      if (lastStatus !== ticket.status) {
        if (ticket.status === "called") {
          if (soundEnabled) callSound.play().catch(() => {});

          const alertBox = document.getElementById("called-alert");
          /* On status change to CALLED */
          if (ticket.status === "called" && lastStatus !== "called") {
            alertBox.classList.remove("hidden", "alert-hide");
            alertBox.classList.add("alert-slide-in");
          }

          /* If user is no longer called, hide the bar cleanly */
          if (
            ticket.status !== "called" &&
            !alertBox.classList.contains("hidden")
          ) {
            alertBox.classList.remove("alert-slide-in");
            alertBox.classList.add("alert-hide");

            setTimeout(() => {
              alertBox.classList.add("hidden");
            }, 350);
          }
        }

        lastStatus = ticket.status;
      }

      /* -----------------------------------------------------
       🧾 BASIC TICKET INFO
    -----------------------------------------------------*/
      document.getElementById("queue_Name").textContent = ticket.queueName;
      document.getElementById("ticket-name").textContent = ticket.name;
      document.getElementById("ticket-id").textContent = "#" + ticket.id;

      const statusEl = document.getElementById("ticket-status");
      statusEl.textContent = ticket.status;

      statusEl.classList.remove(
        "bg-yellow-100",
        "text-yellow-800",
        "bg-blue-100",
        "text-blue-800",
        "bg-green-100",
        "text-green-800",
        "bg-red-100",
        "text-red-800"
      );

      if (ticket.status === "waiting")
        statusEl.classList.add("bg-yellow-100", "text-yellow-800");
      if (ticket.status === "called")
        statusEl.classList.add("bg-blue-100", "text-blue-800");
      if (ticket.status === "served")
        statusEl.classList.add("bg-green-100", "text-green-800");
      if (ticket.status === "left")
        statusEl.classList.add("bg-red-100", "text-red-800");

      /* -----------------------------------------------------
       🧮 POSITION & ETA
    -----------------------------------------------------*/
      document.getElementById("your-position").textContent = ticket.position;
      scalePositionNumber(); // new
      // ======================
      //  ETA DISPLAY + COUNTDOWN
      // ======================
      const etaMin = ticket.etaSeconds
        ? Math.round(ticket.etaSeconds / 60)
        : null;

      etaEl.textContent = etaMin ? `${etaMin} min` : "–";
      if (!countdownStarted) {
        setupCountdown(ticket.etaSeconds);
        countdownStarted = true;
      }

      /* -----------------------------------------------------
       🔵 CUSTOM QUEUE MESSAGE
    -----------------------------------------------------*/
      const msgBox = document.getElementById("queue-custom-message");
      msgBox.textContent = "HOST NOTES: ";
      msgBox.textContent += ticket.customMessage || "";
      msgBox.classList.toggle("hidden", !ticket.customMessage);

      /* -----------------------------------------------------
       📊 SNAPSHOT SECTION (new)
    -----------------------------------------------------*/
      document.getElementById("modal-queue-name").textContent =
        ticket.queueName || "—";

      document.getElementById("modal-ahead-count").textContent =
        ticket.aheadOfYou.length ?? "—";

      document.getElementById("modal-avg-service").textContent =
        ticket.avgServiceMinutes ? ticket.avgServiceMinutes + " min" : "—";

      document.getElementById("modal-total-waiting").textContent =
        ticket.totalWaiting ?? "—";

      /* -----------------------------------------------------
       👥 AHEAD-OF-YOU LIST
    -----------------------------------------------------*/
      const list = document.getElementById("modal-ahead-list");
      list.innerHTML = ""; // clear first

      if (ticket.aheadOfYou && ticket.aheadOfYou.length > 0) {
        ticket.aheadOfYou.forEach((p) => {
          const item = document.createElement("div");
          item.className =
            "text-xs text-gray-700 flex justify-between bg-white border border-gray-200 rounded-md py-1 px-2";
          item.innerHTML = `
          <span>${p.name}</span>
          <span class="text-gray-500">(${p.partySize})</span>
        `;
          list.appendChild(item);
        });
      } else {
        list.innerHTML = `<div class="text-xs text-gray-400">No one ahead.</div>`;
      }
    } catch (err) {
      console.error("Error loading status:", err);
    }
  }

  /* ============================
   LIVE COUNTDOWN TIMER
   ============================ */

  function setupCountdown(seconds) {
    const countdownEl = document.getElementById("eta-countdown");

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    if (!seconds || seconds <= 0) {
      countdownEl.textContent = "—";
      updateProgressRing(1, 1); // full ring
      return;
    }

    let remaining = seconds;
    const total = seconds;

    function update() {
      if (remaining <= 0) {
        countdownEl.textContent = "any moment now";
        updateProgressRing(total, 0);
        clearInterval(countdownInterval);
        return;
      }

      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;

      countdownEl.textContent =
        mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`;

      updateProgressRing(total, remaining);

      remaining--;
    }

    update();
    countdownInterval = setInterval(update, 1000);
  }

  function updateStatusPill(status) {
    const el = document.getElementById("ticket-status");

    // Reset animations
    el.className =
      "px-3 py-1 rounded-full text-sm font-semibold status-transition";

    // Apply colors + pulse
    if (status === "waiting") {
      el.classList.add("bg-yellow-100", "text-yellow-800");
    }
    if (status === "called") {
      el.classList.add("bg-blue-100", "text-blue-800", "status-pulse");
    }
    if (status === "served") {
      el.classList.add("bg-green-100", "text-green-800");
    }
    if (status === "left") {
      el.classList.add("bg-red-100", "text-red-800");
    }

    // Animate text change smoothly
    el.style.opacity = 0;
    setTimeout(() => {
      el.textContent = status;
      el.style.opacity = 1;
    }, 150);
  }

  refreshBtn.addEventListener("click", loadStatus);
  // ===============================
  // LEAVE QUEUE BUTTON
  // ===============================
  const leaveBtn = document.getElementById("leave-queue");

  if (leaveBtn) {
    leaveBtn.addEventListener("click", async () => {
      if (!ticketId) {
        alert("Missing ticket. Please rejoin the queue.");
        return;
      }

      const confirmLeave = confirm("Are you sure you want to leave the queue?");
      if (!confirmLeave) return;

      try {
        await api(`/tickets/${ticketId}/leave`, { method: "PATCH" });

        // 🧹 CLEAR LOCAL STORAGE
        localStorage.removeItem("ticketId");
        localStorage.removeItem("queueId");

        // 🛑 Stop auto-refresh
        if (window.__statusInterval) {
          clearInterval(window.__statusInterval);
        }

        // 🎨 Replace UI with exit screen
        document.getElementById("status-card").innerHTML = `
        <div class="text-center py-10">
          <h2 class="text-2xl font-bold text-gray-800 mb-4">
            You have left the queue
          </h2>
          <p class="text-gray-600 mb-6">
            Thanks for using QueueLeaf!
          </p>

          <button
            onclick="window.location.href='join-queue.html?queueId=${queueId}'"
            class="px-4 py-2 bg-brand text-white rounded-lg shadow hover:bg-brandDark transition"
          >
            Join Again
          </button>
        </div>
      `;
      } catch (err) {
        console.error("Failed to leave queue:", err);
        alert("Unable to leave queue. Please try again.");
      }
    });
  }

  /* ============================
   SNAPSHOT MODAL LOGIC
   ============================ */

  const openSnapshotBtn = document.getElementById("open-snapshot");
  const snapshotModal = document.getElementById("snapshot-modal");
  const snapshotBackdrop = document.getElementById("snapshot-backdrop");
  const snapshotClose = document.getElementById("snapshot-close");

  function openSnapshot() {
    snapshotModal.classList.remove("hidden");
    snapshotBackdrop.classList.remove("hidden");
  }

  function closeSnapshot() {
    snapshotModal.classList.add("hidden");
    snapshotBackdrop.classList.add("hidden");
  }

  openSnapshotBtn?.addEventListener("click", openSnapshot);
  snapshotClose?.addEventListener("click", closeSnapshot);
  snapshotBackdrop?.addEventListener("click", closeSnapshot);

  /* ============================
   PRIVACY MODAL LOGIC
   ============================ */

  const privacyBtn = document.getElementById("privacy-info");
  const privacyModal = document.getElementById("privacy-modal");

  privacyBtn?.addEventListener("click", () => {
    snapshotBackdrop.classList.remove("hidden");
    privacyModal.classList.remove("hidden");
  });

  document.getElementById("privacy-close").addEventListener("click", () => {
    privacyModal.classList.add("hidden");
    snapshotBackdrop.classList.add("hidden");
  });

  /* ============================
   PROGRESS RING UPDATE
   ============================ */

  function updateProgressRing(totalSeconds, remainingSeconds) {
    const ring = document.getElementById("eta-ring");
    if (!ring || !totalSeconds || totalSeconds <= 0) return;

    const circumference = 2 * Math.PI * 35; // r = 35
    const progress = remainingSeconds / totalSeconds;

    ring.style.strokeDashoffset = circumference - progress * circumference;
  }

  function scalePositionNumber() {
    const el = document.getElementById("your-position");
    if (!el) return;

    const maxWidth = el.parentElement.clientWidth - 10;
    let size = 40;

    el.style.fontSize = size + "px";

    // Increase size until it barely fits
    while (el.scrollWidth < maxWidth && size < 120) {
      size += 2;
      el.style.fontSize = size + "px";
    }

    // Step back by one increment for safety
    el.style.fontSize = size - 2 + "px";
  }

  // Auto-refresh every 5 seconds
  loadStatus();
  window.__statusInterval = setInterval(loadStatus, 5000);
}
