import * as analyticsService from "../services/analyticsService.js";

export async function globalStats(req, res) {
  try {
    const stats = await analyticsService.getGlobalStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function queueStats(req, res) {
  try {
    const { queueId } = req.params;
    const stats = await analyticsService.getQueueStats(queueId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function dailyActivity(req, res) {
  try {
    const { days } = req.query;
    const data = await analyticsService.getDailyActivity(Number(days) || 7);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function customRange(req, res) {
  try {
    const { start, end } = req.query;

    const data = await analyticsService.getCustomRange(start, end);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function queueDailyActivity(req, res) {
  try {
    const { queueId } = req.params;
    const { days } = req.query;

    const data = await analyticsService.getQueueDailyActivity(
      queueId,
      Number(days) || 7
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function dailyWaitTime(req, res) {
  try {
    const { days = 7 } = req.query;
    const data = await analyticsService.getDailyWaitTimes(Number(days));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function heatmapActivity(req, res) {
  try {
    const { days = 7 } = req.query;
    const data = await analyticsService.getHeatmapActivity(Number(days));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function peakDay(req, res) {
  try {
    const { days = 30 } = req.query;
    const data = await analyticsService.getPeakDay(Number(days));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function dailyAnalyticsRange(req, res) {
  try {
    const days = Number(req.query.days) || 7;

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);

    const data = await analyticsService.buildDailyAnalytics(start, end);

    res.json(data);
  } catch (err) {
    console.error("dailyAnalyticsRange error:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function customAnalyticsRange(req, res) {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res
        .status(400)
        .json({ error: "Both 'start' and 'end' query params are required." });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ error: "Invalid date format." });
    }

    if (startDate > endDate) {
      return res
        .status(400)
        .json({ error: "'start' date must be before 'end' date." });
    }

    const data = await analyticsService.buildDailyAnalytics(startDate, endDate);

    res.json(data);
  } catch (err) {
    console.error("customAnalyticsRange error:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function queueDailyAnalytics(req, res) {
  try {
    const { queueId } = req.params;
    const { days } = req.query;

    if (!queueId) {
      return res.status(400).json({ error: "queueId is required." });
    }

    const numDays = Number(days) || 7;

    const end = new Date();
    const start = new Date(end.getTime() - numDays * 24 * 60 * 60 * 1000);

    const result = await analyticsService.buildDailyAnalytics(
      start,
      end,
      queueId
    );

    res.json(result);
  } catch (err) {
    console.error("queueDailyAnalytics error:", err);
    res.status(500).json({ error: err.message });
  }
}

export async function queueCustomAnalytics(req, res) {
  try {
    const { queueId } = req.params;
    const { start, end } = req.query;

    if (!queueId) {
      return res.status(400).json({ error: "queueId is required." });
    }

    if (!start || !end) {
      return res
        .status(400)
        .json({ error: "Both 'start' and 'end' query params are required." });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ error: "Invalid date format." });
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: "'start' must be before 'end'." });
    }

    const result = await analyticsService.buildDailyAnalytics(
      startDate,
      endDate,
      queueId
    );

    res.json(result);
  } catch (err) {
    console.error("queueCustomAnalytics error:", err);
    res.status(500).json({ error: err.message });
  }
}
