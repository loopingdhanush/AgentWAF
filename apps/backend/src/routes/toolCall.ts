import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { ToolCallRequestSchema } from "@agentwaf/shared-types";
import { authenticateAgentKey } from "../lib/agentAuth.js";
import { ruleEngine } from "../rules/engine.js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

export const toolCallRouter = Router();

// Front-door rate limit for the WAF gateway endpoint (e.g. 100 requests per minute per IP)
const gatewayLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - ioredis client compatibility
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: "rl:frontdoor:",
  }),
  message: {
    error: "Too many requests to WAF gateway frontdoor, please slow down.",
  },
});

toolCallRouter.post(
  "/tool-call",
  gatewayLimiter,
  async (req, res): Promise<void> => {
    const requestId = (req.headers["x-request-id"] as string) || "req_direct";
    const agentKeyHeader = req.headers["x-agent-key"] as string | undefined;

    // 1. Authenticate Agent
    const agent = await authenticateAgentKey(agentKeyHeader);
    if (!agent) {
      logger.warn(
        { ip: req.ip, requestId },
        "Unauthorized tool call: invalid or missing x-agent-key",
      );
      res.status(401).json({
        disposition: "BLOCKED",
        blockedReason:
          "Authentication failed: invalid or missing 'x-agent-key' header",
        ruleResults: [],
        requestId,
      });
      return;
    }

    // 2. Validate Request Body with Zod
    const parseResult = ToolCallRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      logger.warn(
        { errors: parseResult.error.errors, requestId },
        "Invalid tool call request payload",
      );
      res.status(400).json({
        disposition: "BLOCKED",
        blockedReason: `Malformed request payload: ${parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
        ruleResults: [],
        requestId,
      });
      return;
    }

    const { sessionId, tool, params } = parseResult.data;

    // 3. Process Call through Rule Engine Pipeline
    const outcome = await ruleEngine.processToolCall({
      agentId: agent.id,
      agentName: agent.name,
      declaredScope: (agent.declaredScope as any) || {},
      sessionId,
      tool,
      params,
      requestId,
    });

    // 4. Respond according to disposition
    if (outcome.disposition === "BLOCKED") {
      res.status(403).json(outcome);
      return;
    }

    if (outcome.disposition === "ERROR") {
      res.status(500).json(outcome);
      return;
    }

    res.status(200).json(outcome);
  },
);
