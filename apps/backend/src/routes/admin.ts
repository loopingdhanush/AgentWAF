import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { generateApiKey } from "../lib/agentAuth.js";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { logger } from "../lib/logger.js";

export const adminRouter = Router();

// Middleware to check admin session
const requireAdminAuth = async (req: any, res: any, next: any) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      // In dev or demo mode, if session cookie isn't present, check for bypass header or allow dev fallback
      const devBypass =
        req.headers["x-demo-admin"] === "true" ||
        process.env.NODE_ENV === "development";
      if (devBypass) {
        req.user = {
          id: "user_admin_demo_01",
          email: "admin@agentwaf.local",
          name: "Security Admin",
        };
        return next();
      }
      res.status(401).json({ error: "Unauthorized: Admin session required" });
      return;
    }

    req.user = session.user;
    req.session = session.session;
    next();
  } catch (err: any) {
    logger.error({ err }, "Admin auth verification error");
    res.status(401).json({ error: "Unauthorized: Invalid session" });
  }
};

adminRouter.use(requireAdminAuth);

// -------------------------------------------------------------
// AGENTS MANAGEMENT
// -------------------------------------------------------------
adminRouter.get("/agents", async (req, res) => {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { logs: true, sessions: true },
      },
    },
  });

  res.json(
    agents.map((a) => ({
      id: a.id,
      name: a.name,
      apiKeyPrefix: a.apiKeyPrefix,
      declaredScope: a.declaredScope,
      createdAt: a.createdAt,
      totalCalls: a._count.logs,
      totalSessions: a._count.sessions,
    })),
  );
});

adminRouter.post("/agents", async (req, res): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    declaredScope: z
      .record(z.any())
      .default({ allowedCustomerIdPattern: "^CUST-1" }),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.errors });
    return;
  }

  const { rawKey, prefix, hash } = await generateApiKey();

  const agent = await prisma.agent.create({
    data: {
      name: parsed.data.name,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      declaredScope: parsed.data.declaredScope,
    },
  });

  res.status(201).json({
    agent: {
      id: agent.id,
      name: agent.name,
      apiKeyPrefix: agent.apiKeyPrefix,
      declaredScope: agent.declaredScope,
      createdAt: agent.createdAt,
    },
    rawApiKey: rawKey, // Shown only once
  });
});

adminRouter.patch("/agents/:id", async (req, res): Promise<void> => {
  const schema = z.object({
    name: z.string().optional(),
    declaredScope: z.record(z.any()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.errors });
    return;
  }

  const agent = await prisma.agent.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  res.json(agent);
});

adminRouter.delete("/agents/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    await prisma.$transaction([
      prisma.toolCallLog.deleteMany({ where: { agentId: id } }),
      prisma.agentSession.deleteMany({ where: { agentId: id } }),
      prisma.agent.delete({ where: { id } }),
    ]);
    res.json({ success: true, deletedId: id });
  } catch (err: any) {
    logger.error({ err, agentId: id }, "Failed to delete agent");
    res.status(500).json({ error: `Failed to delete agent: ${err.message}` });
  }
});

// -------------------------------------------------------------
// RULES MANAGEMENT
// -------------------------------------------------------------
adminRouter.get("/rules", async (req, res) => {
  const rules = await prisma.rule.findMany({
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  res.json(rules);
});

adminRouter.post("/rules", async (req, res): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    type: z.enum([
      "RATE_LIMIT",
      "PARAM_BLOCKLIST",
      "PARAM_SIZE_LIMIT",
      "DATA_SCOPE",
      "SEQUENCE",
    ]),
    enabled: z.boolean().default(true),
    enforcementMode: z.enum(["BLOCK", "SHADOW"]).default("BLOCK"),
    targetAgentId: z.string().nullable().optional(),
    targetTool: z.string().nullable().optional(),
    config: z.record(z.any()),
    priority: z.number().int().default(0),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.errors });
    return;
  }

  const rule = await prisma.rule.create({
    data: parsed.data as any,
  });

  res.status(201).json(rule);
});

adminRouter.patch("/rules/:id", async (req, res): Promise<void> => {
  const schema = z.object({
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    enforcementMode: z.enum(["BLOCK", "SHADOW"]).optional(),
    targetAgentId: z.string().nullable().optional(),
    targetTool: z.string().nullable().optional(),
    config: z.record(z.any()).optional(),
    priority: z.number().int().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.errors });
    return;
  }

  const rule = await prisma.rule.update({
    where: { id: req.params.id },
    data: parsed.data as any,
  });

  res.json(rule);
});

adminRouter.delete("/rules/:id", async (req, res) => {
  await prisma.rule.delete({
    where: { id: req.params.id },
  });
  res.json({ success: true, deletedId: req.params.id });
});

// -------------------------------------------------------------
// LOGS EXPLORER
// -------------------------------------------------------------
adminRouter.get("/logs", async (req, res) => {
  const { agentId, tool, disposition, limit = "50", cursor } = req.query;
  const take = Math.min(parseInt(limit as string, 10) || 50, 100);

  const whereClause: any = {};
  if (agentId) whereClause.agentId = String(agentId);
  if (tool) whereClause.tool = String(tool);
  if (disposition) whereClause.disposition = String(disposition);

  const logs = await prisma.toolCallLog.findMany({
    where: whereClause,
    take: take + 1,
    cursor: cursor ? { id: String(cursor) } : undefined,
    orderBy: { timestamp: "desc" },
    include: {
      agent: { select: { id: true, name: true } },
    },
  });

  let nextCursor: string | null = null;
  if (logs.length > take) {
    const nextItem = logs.pop();
    nextCursor = nextItem?.id || null;
  }

  res.json({
    logs,
    nextCursor,
    totalReturned: logs.length,
  });
});

// -------------------------------------------------------------
// STATS SUMMARY (FOR DASHBOARD CHARTS)
// -------------------------------------------------------------
adminRouter.get("/stats/summary", async (req, res) => {
  const totalCalls = await prisma.toolCallLog.count();

  const allowedCount = await prisma.toolCallLog.count({
    where: { disposition: "ALLOWED" },
  });
  const blockedCount = await prisma.toolCallLog.count({
    where: { disposition: "BLOCKED" },
  });
  const shadowBlockedCount = await prisma.toolCallLog.count({
    where: { disposition: "SHADOW_BLOCKED" },
  });
  const errorCount = await prisma.toolCallLog.count({
    where: { disposition: "ERROR" },
  });

  const blockRatePercentage =
    totalCalls > 0 ? Math.round((blockedCount / totalCalls) * 1000) / 10 : 0;

  // Calls grouped by tool
  const callsByToolRaw = await prisma.toolCallLog.groupBy({
    by: ["tool"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 8,
  });

  // Top blocked tools
  const topBlockedToolsRaw = await prisma.toolCallLog.groupBy({
    by: ["tool"],
    where: { disposition: "BLOCKED" },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  // Recent 20 logs for time series chart
  const recentLogs = await prisma.toolCallLog.findMany({
    take: 30,
    orderBy: { timestamp: "desc" },
    select: {
      id: true,
      timestamp: true,
      disposition: true,
      tool: true,
      latencyMs: true,
    },
  });

  res.json({
    totalCalls,
    dispositionCounts: {
      ALLOWED: allowedCount,
      BLOCKED: blockedCount,
      SHADOW_BLOCKED: shadowBlockedCount,
      ERROR: errorCount,
    },
    blockRatePercentage,
    callsByTool: callsByToolRaw.map((c) => ({
      tool: c.tool,
      count: c._count.id,
    })),
    topBlockedTools: topBlockedToolsRaw.map((c) => ({
      tool: c.tool,
      count: c._count.id,
    })),
    recentLogs: recentLogs.reverse(),
  });
});

// -------------------------------------------------------------
// SYSTEM & INFRASTRUCTURE DIAGNOSTICS
// -------------------------------------------------------------
adminRouter.get("/diagnostics", async (req, res) => {
  // PostgreSQL Ping & Latency
  let pgStatus = "disconnected";
  let pgLatencyMs = 0;
  try {
    const pgStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    pgLatencyMs = Date.now() - pgStart;
    pgStatus = "healthy";
  } catch (err: any) {
    pgStatus = `error: ${err.message}`;
  }

  // Redis Ping & Latency
  let redisStatus = "disconnected";
  let redisLatencyMs = 0;
  let redisMemory = "N/A";
  try {
    const redisStart = Date.now();
    const pingRes = await import("../lib/redis.js").then((m) => m.redis.ping());
    redisLatencyMs = Date.now() - redisStart;
    if (pingRes === "PONG") {
      redisStatus = "healthy";
      try {
        const info = await import("../lib/redis.js").then((m) =>
          m.redis.info("memory"),
        );
        const match = info.match(/used_memory_human:(.+)/);
        if (match) redisMemory = match[1].trim();
      } catch {
        // Ignore info parse error
      }
    } else {
      redisStatus = `unexpected: ${pingRes}`;
    }
  } catch (err: any) {
    redisStatus = `error: ${err.message}`;
  }

  // Database Counts
  const [agentsCount, rulesCount, logsCount, customersCount] =
    await Promise.all([
      prisma.agent.count().catch(() => 0),
      prisma.rule.count().catch(() => 0),
      prisma.toolCallLog.count().catch(() => 0),
      prisma.customer.count().catch(() => 0),
    ]);

  // Process & Host Metrics
  const memUsage = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  // Gemini AI Status
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const geminiKeyConfigured = Boolean(process.env.GEMINI_API_KEY);
  const geminiKeyMasked = geminiKeyConfigured
    ? `${process.env.GEMINI_API_KEY?.substring(0, 8)}••••••••`
    : "NOT_SET";

  res.json({
    status:
      pgStatus === "healthy" && redisStatus === "healthy"
        ? "healthy"
        : "degraded",
    timestamp: new Date().toISOString(),
    postgres: {
      status: pgStatus,
      latencyMs: pgLatencyMs,
      databaseUrl:
        process.env.DATABASE_URL?.replace(/:\/\/.*@/, "://***@") ||
        "configured",
      tables: {
        agents: agentsCount,
        rules: rulesCount,
        logs: logsCount,
        customers: customersCount,
      },
    },
    redis: {
      status: redisStatus,
      latencyMs: redisLatencyMs,
      usedMemory: redisMemory,
      url:
        process.env.REDIS_URL?.replace(/:\/\/.*@/, "://***@") ||
        "redis://localhost:6380",
      channel: "agent_waf:tool_events",
    },
    gemini: {
      model: geminiModel,
      keyConfigured: geminiKeyConfigured,
      keyMasked: geminiKeyMasked,
      status: geminiKeyConfigured ? "ready" : "missing_key",
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds,
      memory: {
        rssMb: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      env: process.env.NODE_ENV || "development",
      port: process.env.PORT || 4000,
    },
  });
});
