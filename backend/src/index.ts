/**
 * Aegis - Backend Server
 *
 * Express API server for the Aegis AI Wallet Agent.
 * Handles chat, transaction preparation, signing, and broadcasting.
 *
 * SECURITY: All signing operations require Ledger hardware approval.
 * The server never holds or generates private keys.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat.js";
import { prepareRouter } from "./routes/prepare.js";
import { signRouter } from "./routes/sign.js";
import { broadcastRouter } from "./routes/broadcast.js";
import { addressRouter } from "./routes/address.js";
import { statusRouter } from "./routes/status.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ─── Middleware ────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json({ limit: "1mb" }));

// ─── Routes ───────────────────────────────────────────────────────────

app.use("/api", chatRouter);
app.use("/api", prepareRouter);
app.use("/api", signRouter);
app.use("/api", broadcastRouter);
app.use("/api", addressRouter);
app.use("/api", statusRouter);

// ─── Health Check ─────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "aegis-agent",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ─── Error Handler ────────────────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[Server Error]", err);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    });
  }
);

// ─── Start ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║           Aegis Agent Backend            ║
  ║  AI Wallet Agent + Ledger Hardware       ║
  ║  Listening on http://localhost:${PORT}       ║
  ╚══════════════════════════════════════════╝
  `);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[Server] Network: ${process.env.DEFAULT_NETWORK || "sepolia"}`);
});

export default app;