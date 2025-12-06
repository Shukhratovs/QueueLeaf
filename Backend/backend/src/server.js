import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { prisma } from "./config/db.js"; // <-- import Prisma

import { env } from "./config/env.js";

import authRoutes from "./routes/authRoutes.js";

import queueRoutes from "./routes/queueRoutes.js";

import ticketRoutes from "./routes/ticketRoutes.js";

import analyticsRoutes from "./routes/analyticsRoutes.js";

dotenv.config();
const app = express();

app.set("trust proxy", 1); // Required when using HTTPS on Render/Vercel

app.use(express.json());
app.use(cookieParser());
//app.use(cors({ origin: "http://localhost:5173", credentials: true }));

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true, // allow cookies
  })
);

app.use(helmet());
app.use(morgan("dev"));

// Updated health route with DB check
app.get("/api/health", async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      status: "ok",
      uptime: process.uptime(),
      connectedToDB: true,
      userCount,
    });
  } catch (err) {
    console.error("DB connection error:", err);
    res
      .status(500)
      .json({ status: "error", message: "Database not reachable" });
  }
});

app.use("/api/auth", authRoutes);

app.use("/api/queues", queueRoutes);

app.use("/api/tickets", ticketRoutes);

app.use("/api/analytics", analyticsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Server running on ${PORT}`);
});
