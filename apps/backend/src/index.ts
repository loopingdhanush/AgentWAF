import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import { Server as SocketIOServer } from "socket.io";
import { toNodeHandler } from "better-auth/node";
import crypto from "crypto";
import "dotenv/config";

import { prisma } from "./lib/prisma.js";
import { redis, redisSub, REDIS_CHANNELS } from "./lib/redis.js";
import { logger } from "./lib/logger.js";
import { auth } from "./lib/auth.js";

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// Security & Core Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-agent-key",
      "x-request-id",
    ],
  }),
);

// Better-Auth handler
app.all("/api/auth/{*path}", toNodeHandler(auth));

app.use(express.json({ limit: "1mb" }));

import { toolCallRouter } from "./routes/toolCall.js";
import { agentRunRouter } from "./routes/agentRun.js";
import { adminRouter } from "./routes/admin.js";

// Request ID and Structured Logging Middleware
app.use((req, res, next) => {
  const reqId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  req.headers["x-request-id"] = reqId;
  res.setHeader("x-request-id", reqId);

  const startTime = Date.now();
  res.on("finish", () => {
    const latencyMs = Date.now() - startTime;
    logger.info({
      requestId: reqId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      latencyMs,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  });

  next();
});

// Realtime Layer: Socket.IO
export const io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGIN,
    credentials: true,
  },
  path: "/socket.io",
});

const dashboardNamespace = io.of("/dashboard");

dashboardNamespace.on("connection", (socket) => {
  logger.info(
    { socketId: socket.id },
    "Dashboard client connected to /dashboard",
  );
  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Dashboard client disconnected");
  });
});

// Subscribe to Redis pub/sub channel for tool events and broadcast to Socket.IO
redisSub.subscribe(REDIS_CHANNELS.TOOL_EVENTS, (err, count) => {
  if (err) {
    logger.error({ err }, "Failed to subscribe to Redis tool events channel");
  } else {
    logger.info({ count }, "Subscribed to Redis tool events channel");
  }
});

redisSub.on("message", (channel, message) => {
  if (channel === REDIS_CHANNELS.TOOL_EVENTS) {
    try {
      const eventData = JSON.parse(message);
      dashboardNamespace.emit("tool_call", eventData);
    } catch (e) {
      logger.error({ err: e }, "Failed to parse tool event from Redis");
    }
  }
});

// Mount Gateway & Admin API Routes
app.use("/api/v1", toolCallRouter);
app.use("/api/v1", agentRunRouter);
app.use("/api/admin", adminRouter);

// Operational Endpoints
app.get("/healthz", async (req, res) => {
  let pgStatus = "disconnected";
  let redisStatus = "disconnected";
  let isHealthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    pgStatus = "connected";
  } catch (err: any) {
    pgStatus = `error: ${err.message}`;
    isHealthy = false;
  }

  try {
    const pingRes = await redis.ping();
    if (pingRes === "PONG") {
      redisStatus = "connected";
    } else {
      redisStatus = `unexpected: ${pingRes}`;
      isHealthy = false;
    }
  } catch (err: any) {
    redisStatus = `error: ${err.message}`;
    isHealthy = false;
  }

  const statusCode = isHealthy ? 200 : 503;
  res.status(statusCode).json({
    status: isHealthy ? "ok" : "degraded",
    postgres: pgStatus,
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/version", (req, res) => {
  res.json({
    name: "agent-waf-gateway",
    version: "1.0.0",
    node: process.version,
    buildTime: new Date().toISOString(),
    gitSha: process.env.GIT_SHA || "local-dev",
    enforcementReady: true,
  });
});

// Export server and start function
export { app, server };

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    logger.info(`Agent WAF Gateway running on http://localhost:${PORT}`);
  });
}
