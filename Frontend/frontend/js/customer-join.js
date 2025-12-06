// js/customer.js
import { api } from "./api.js";

const urlParams = new URLSearchParams(window.location.search);
const queueIdFromUrl = urlParams.get("queueId");

const form = document.querySelector("#join-form");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const name = formData.get("name");
    const partySize = Number(formData.get("party")) || 1;
    const contact = formData.get("contact");

    // First validate party size
    if (partySize > 6) {
      alert("Party size limit: 6");
      return; // ⛔ STOP — do NOT create ticket
    }

    try {
      document.querySelector("#join-btn").disabled = true;

      const data = await api("/tickets", {
        method: "POST",
        body: JSON.stringify({
          queueId: Number(queueIdFromUrl) || 1,
          name,
          partySize,
          contactType: contact ? "sms" : null,
          contactValue: contact || null,
        }),
      });

      // Save IDs so status.html can access them later
      localStorage.setItem("ticketId", data.ticket.id);
      localStorage.setItem("queueId", queueIdFromUrl || 1);

      // Redirect to status page
      window.location.href = "status.html";
    } catch (err) {
      alert("Failed to join queue: " + err.message);
    } finally {
      document.querySelector("#join-btn").disabled = false;
    }
  });
}
/* ============================
   PRIVACY MODAL (JOIN QUEUE)
   ============================ */

const privacyModal = document.getElementById("privacy-modal");
const privacyBtn = document.getElementById("privacy-btn");
const privacyAccept = document.getElementById("privacy-accept");
const joinForm = document.getElementById("join-form");

// Always show modal on page load
if (privacyModal) {
  privacyModal.classList.remove("hidden");
}

// Allow user to reopen modal
privacyBtn?.addEventListener("click", () => {
  privacyModal.classList.remove("hidden");
});

// Accept & enable form
privacyAccept?.addEventListener("click", () => {
  privacyModal.classList.add("hidden");

  // Re-enable form
  joinForm.classList.remove("opacity-30", "pointer-events-none");
});
