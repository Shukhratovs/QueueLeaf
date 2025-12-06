// services/etaService.js
import { prisma } from "../config/db.js";

export async function getServiceStats(queueId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Fetch all served tickets today for this queue
  const servedToday = await prisma.ticket.findMany({
    where: {
      queueId: Number(queueId),
      status: "served",
      servedAt: { not: null },
      createdAt: { gte: startOfDay },
    },
    orderBy: { servedAt: "desc" },
  });

  if (servedToday.length === 0) {
    return {
      recentAvg: 300, // fallback 5 min
      dailyAvg: 300,
    };
  }

  // Compute daily average
  let dailyTotal = 0;
  for (const t of servedToday) {
    const diff = (new Date(t.servedAt) - new Date(t.createdAt)) / 1000;
    if (diff > 0) dailyTotal += diff;
  }
  const dailyAvg = dailyTotal / servedToday.length;

  // Compute recent average (last 5)
  const recent = servedToday.slice(0, 5);
  let recentTotal = 0;
  for (const t of recent) {
    const diff = (new Date(t.servedAt) - new Date(t.createdAt)) / 1000;
    if (diff > 0) recentTotal += diff;
  }
  const recentAvg = recentTotal / recent.length;

  return { recentAvg, dailyAvg };
}
