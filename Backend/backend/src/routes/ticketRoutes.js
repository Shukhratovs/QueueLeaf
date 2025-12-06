import { Router } from "express";
import { prisma } from "../config/db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  createTicket,
  getTickets,
  updateStatus,
  leaveTicket,
  calculateETA,
} from "../controllers/ticketController.js";

const router = Router();

router.post("/", createTicket); // customers can join

router.patch("/:ticketId/leave", leaveTicket);

router.get("/public/:ticketId", async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
      include: { Queue: true },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    if (ticket.status === "left") {
      return res.json({
        id: ticket.id,
        name: ticket.name,
        status: "left",
        message: "You have left the queue.",
        leftAt: ticket.leftAt,
      });
    }

    const allTickets = await prisma.ticket.findMany({
      where: {
        queueId: ticket.queueId,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)), // today's tickets only
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Waiting tickets sorted by creation time
    const waiting = allTickets.filter((t) => t.status === "waiting");

    const positionIndex = waiting.findIndex((t) => t.id === ticket.id);
    const position = positionIndex >= 0 ? positionIndex + 1 : null;

    const aheadOfYou = positionIndex > 0 ? waiting.slice(0, positionIndex) : [];

    const totalWaiting = waiting.length;

    const avgServiceSec = ticket.Queue.avgServiceSec || 300;
    const avgServiceMinutes = Math.round(avgServiceSec / 60);

    const etaData =
      position && position > 0
        ? await calculateETA(ticket, position - 1)
        : { etaSeconds: 0, recentAvg: 0, dailyAvg: 0 };

    res.json({
      id: ticket.id,
      name: ticket.name,
      queueId: ticket.queueId,
      queueName: ticket.Queue.name,
      status: ticket.status,
      createdAt: ticket.createdAt,

      // Live info
      position,
      totalWaiting,
      aheadOfYou: aheadOfYou.map((t) => ({
        id: t.id,
        name: t.name,
        partySize: t.partySize,
      })),

      avgServiceMinutes,
      etaSeconds: etaData.etaSeconds,
      serviceStats: {
        recentAvgSec: etaData.recentAvg,
        dailyAvgSec: etaData.dailyAvg,
      },

      customMessage: ticket.Queue.customMessage || "",
    });
  } catch (err) {
    console.error("Public ticket fetch failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.use(requireAuth); // everything after this is staff-only
router.get("/:queueId", getTickets);
router.patch("/:id/status", updateStatus);

export default router;
