import { prisma } from "../config/db.js";

export async function createTicket(data) {
  return prisma.ticket.create({
    data: {
      queueId: data.queueId,
      name: data.name,
      partySize: data.partySize,
      contactType: data.contactType || null,
      contactValue: data.contactValue || null,
      status: "waiting",
    },
  });
}

export async function getTicketsByQueue(queueId) {
  // Calculate midnight (start of today)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return prisma.ticket.findMany({
    where: {
      queueId: Number(queueId),
      createdAt: {
        gte: startOfToday,
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateTicketStatus(id, newStatus) {
  const ticket = await prisma.ticket.findUnique({ where: { id: Number(id) } });
  if (!ticket) throw new Error("Ticket not found");

  return prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: newStatus,
      ...(newStatus === "called" && { calledAt: new Date() }),
      ...(newStatus === "served" && { servedAt: new Date() }),
      ...(newStatus === "left" && { leftAt: new Date() }),
    },
  });
}

export async function calculatePositionAndETA(queueId, ticketId) {
  const queue = await prisma.queue.findUnique({
    where: { id: Number(queueId) },
    include: { tickets: true },
  });
  if (!queue) throw new Error("Queue not found");

  const waitingTickets = queue.tickets
    .filter((t) => t.status === "waiting")
    .sort((a, b) => a.createdAt - b.createdAt);

  const position =
    waitingTickets.findIndex((t) => t.id === Number(ticketId)) + 1;
  const etaSeconds = position * (queue.avgServiceSec || 300);

  return { position, etaSeconds };
}
