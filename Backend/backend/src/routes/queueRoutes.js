import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  getQueues,
  createQueue,
  toggleQueue,
  updateMessage,
} from "../controllers/queueController.js";

import { prisma } from "../config/db.js";

const router = Router();
router.use(requireAuth); // all routes protected

router.get("/", getQueues);
router.post("/", createQueue);
router.patch("/:id/toggle", toggleQueue);
router.patch("/:id/message", updateMessage);

// NEEDS IMPLEMENTATION
router.patch("/:id/avg", async (req, res) => {
  return res.json({ patched: true });
});

// DELETE a queue
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Count tickets in this queue
    const ticketCount = await prisma.ticket.count({
      where: { queueId: id },
    });

    // If tickets exist and no ?force=true → return 409
    if (ticketCount > 0 && req.query.force !== "true") {
      return res.status(409).json({
        error: "Queue has tickets. Use ?force=true to force delete.",
      });
    }

    // If force=true → delete all tickets first
    if (req.query.force === "true") {
      await prisma.ticket.deleteMany({ where: { queueId: id } });
    }

    // Delete the queue
    await prisma.queue.delete({
      where: { id },
    });

    return res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
