// src/config/env.js
import dotenv from "dotenv";

// Load .env or environment variables on Render
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 5000),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev_secret_change_me",
  COOKIE_NAME: process.env.COOKIE_NAME ?? "ql_auth",
  DATABASE_URL: process.env.DATABASE_URL,
};
