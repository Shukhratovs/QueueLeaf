import { prisma } from "../config/db.js";

export async function getAllQueues() {
  return prisma.queue.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createQueue(data) {
  return prisma.queue.create({ data });
}

export async function toggleQueue(id) {
  const queue = await prisma.queue.findUnique({ where: { id: Number(id) } });
  if (!queue) throw new Error("Queue not found");
  return prisma.queue.update({
    where: { id: queue.id },
    data: { isOpen: !queue.isOpen },
  });
}

export async function updateMessage(id, message) {
  const queue = await prisma.queue.findUnique({ where: { id: Number(id) } });
  if (!queue) throw new Error("Queue not found");
  return prisma.queue.update({
    where: { id: queue.id },
    data: { customMessage: message },
  });
}
