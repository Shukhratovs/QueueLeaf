import { prisma } from "../config/db.js";

export async function getGlobalStats() {
  const totalTickets = await prisma.ticket.count();
  const totalQueues = await prisma.queue.count();
  const totalUsers = await prisma.user.count();

  const servedTickets = await prisma.ticket.count({
    where: { status: "served" },
  });

  const avgServiceTimeResult = await prisma.ticket.aggregate({
    _avg: { partySize: true },
  });

  return {
    totalTickets,
    servedTickets,
    totalQueues,
    totalUsers,
    avgPartySize: avgServiceTimeResult._avg.partySize || 0,
  };
}

export async function getQueueStats(queueId) {
  const tickets = await prisma.ticket.findMany({
    where: { queueId: Number(queueId) },
  });

  const served = tickets.filter((t) => t.status === "served");
  const waiting = tickets.filter((t) => t.status === "waiting");

  const avgWaitMs = served.length
    ? served.reduce((acc, t) => acc + (t.servedAt - t.createdAt), 0) /
      served.length
    : 0;

  return {
    queueId: Number(queueId),
    totalTickets: tickets.length,
    servedCount: served.length,
    waitingCount: waiting.length,
    avgWaitMinutes: (avgWaitMs / 60000).toFixed(1),
  };
}

export async function getDailyActivity(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const grouped = await prisma.ticket.groupBy({
    by: ["status"],
    _count: { status: true },
    where: { createdAt: { gte: since } },
  });
  return grouped;
}

export async function getCustomRange(start, end) {
  if (!start || !end) {
    throw new Error("Start and end dates are required");
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  const grouped = await prisma.ticket.groupBy({
    by: ["status"],
    _count: { status: true },
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return grouped;
}

export async function getQueueDailyActivity(queueId, days = 7) {
  if (!queueId) throw new Error("Queue ID required");

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const grouped = await prisma.ticket.groupBy({
    by: ["status"],
    _count: { status: true },
    where: {
      queueId: Number(queueId),
      createdAt: { gte: since },
    },
  });

  return grouped;
}

export async function buildDailyAnalytics(startDate, endDate, queueId = null) {
  // Ensure date objects
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // include full last day

  // Filter by queueId if provided
  const where = {
    createdAt: { gte: start, lte: end },
  };

  if (queueId) {
    where.queueId = Number(queueId);
  }

  // Fetch all tickets for this time range
  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  // --- Create a map of days ---
  // Format: YYYY-MM-DD → analytics object
  const dayMap = {};

  const cursor = new Date(start);
  while (cursor <= end) {
    const dayKey = cursor.toISOString().split("T")[0]; // YYYY-MM-DD

    dayMap[dayKey] = {
      date: dayKey,
      served: 0,
      waiting: 0,
      called: 0,
      left: 0,
      total: 0,
      avgWaitMinutes: 0, // fill later
      waitSamples: [], // used to compute avgWaitMinutes
      hourly: {}, // 0–23
    };

    // Initialize hourly map (0–23 each day)
    for (let h = 0; h < 24; h++) {
      dayMap[dayKey].hourly[h] = 0;
    }

    // Move to next day
    cursor.setDate(cursor.getDate() + 1);
  }

  // --- Fill buckets with ticket data ---
  for (const t of tickets) {
    const dayKey = t.createdAt.toISOString().split("T")[0];

    const bucket = dayMap[dayKey];
    if (!bucket) continue; // safety check

    // Count statuses
    bucket.total += 1;

    if (t.status === "served") bucket.served += 1;
    if (t.status === "waiting") bucket.waiting += 1;
    if (t.status === "called") bucket.called += 1;
    if (t.status === "left") bucket.left += 1;

    // Avg wait time calculation: use servedAt - createdAt
    if (t.status === "served" && t.servedAt) {
      const waitMs = new Date(t.servedAt) - new Date(t.createdAt);
      if (!isNaN(waitMs) && waitMs >= 0) {
        bucket.waitSamples.push(waitMs / 60000); // convert to minutes
      }
    }

    // Hourly heatmap: use createdAt hour
    const hour = new Date(t.createdAt).getHours();
    bucket.hourly[hour] += 1;
  }

  // --- Finalize buckets into results array ---
  const resultsArray = Object.values(dayMap).map((day) => {
    // Compute average wait
    if (day.waitSamples.length > 0) {
      const sum = day.waitSamples.reduce((a, b) => a + b, 0);
      day.avgWaitMinutes = Number((sum / day.waitSamples.length).toFixed(1));
    } else {
      day.avgWaitMinutes = 0;
    }

    // Remove internal temp array
    delete day.waitSamples;

    return day;
  });

  // Sort newest → oldest
  resultsArray.sort((a, b) => (a.date < b.date ? 1 : -1));

  return resultsArray;
}
