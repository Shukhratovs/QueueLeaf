import * as ticketService from "../services/ticketService.js";
import { getServiceStats } from "../services/etaService.js";
import { prisma } from "../config/db.js";

export async function createTicket(req, res) {
  try {
    const { queueId, name, partySize, contactType, contactValue } = req.body;
    if (!queueId || !name) {
      return res.status(400).json({ error: "queueId and name are required" });
    }

    const ticket = await ticketService.createTicket({
      queueId,
      name,
      partySize: Number(partySize) || 1,
      contactType,
      contactValue,
    });

    const { position, etaSeconds } =
      await ticketService.calculatePositionAndETA(queueId, ticket.id);

    res.status(201).json({
      message: "Ticket created",
      ticket,
      position,
      etaSeconds,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getTickets(req, res) {
  try {
    const { queueId } = req.params;
    const tickets = await ticketService.getTicketsByQueue(queueId);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status required" });

    const updated = await ticketService.updateTicketStatus(id, status);
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

export async function leaveTicket(req, res) {
  try {
    const { ticketId } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: Number(ticketId) },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Cannot leave if already served
    if (ticket.status === "served") {
      return res
        .status(400)
        .json({ error: "This ticket has already been served." });
    }

    // If already left, ignore
    if (ticket.status === "left") {
      return res.json(ticket);
    }

    const updated = await prisma.ticket.update({
      where: { id: Number(ticketId) },
      data: {
        status: "left",
        leftAt: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Leave ticket error:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function calculateETA(ticket, peopleAhead) {
  const { recentAvg, dailyAvg } = await getServiceStats(ticket.queueId);

  const base = recentAvg * 0.7 + dailyAvg * 0.3;

  const etaSeconds = Math.round(base * peopleAhead);

  return {
    etaSeconds,
    recentAvg,
    dailyAvg,
  };
}
