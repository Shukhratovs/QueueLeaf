import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  globalStats,
  queueStats,
  dailyActivity,
  dailyAnalyticsRange,
  customAnalyticsRange,
  queueDailyAnalytics,
  queueCustomAnalytics,
} from "../controllers/analyticsController.js";

const router = Router();
router.use(requireAuth);

router.get("/global", globalStats);
router.get("/queue/:queueId", queueStats);
// router.get("/daily", dailyActivity);

// NEW (fully detailed daily analytics):
router.get("/daily", dailyAnalyticsRange);

router.get("/custom", customAnalyticsRange);

router.get("/queue/:queueId/daily", queueDailyAnalytics);
router.get("/queue/:queueId/custom", queueCustomAnalytics);

export default router;
