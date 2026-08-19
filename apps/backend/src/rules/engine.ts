import { Redis } from "ioredis";
import {
  Disposition,
  RuleEvaluationResult,
  ToolCallResponse,
  ToolCallEvent,
  DeclaredScope,
} from "@agentwaf/shared-types";
import { prisma } from "../lib/prisma.js";
import { redis, redisPub, REDIS_CHANNELS } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import {
  EvaluationContext,
  RuleModel,
  EvaluatorOutput,
  evaluateRateLimit,
  evaluateParamBlocklist,
  evaluateParamSizeLimit,
  evaluateDataScope,
  evaluateSequence,
} from "./evaluators.js";
import { sanitizeParams } from "./utils.js";
import { executeMockTool } from "../mock-tools/executors.js";

export interface ProcessToolCallArgs {
  agentId: string;
  agentName: string;
  declaredScope: DeclaredScope;
  sessionId: string;
  tool: string;
  params: Record<string, any>;
  requestId: string;
}

export class RuleEngine {
  private redisClient: Redis;

  constructor(redisClient: Redis = redis) {
    this.redisClient = redisClient;
  }

  /**
   * Load active rules applicable to the given agent and tool
   */
  async loadApplicableRules(
    agentId: string,
    tool: string,
  ): Promise<RuleModel[]> {
    const rules = await prisma.rule.findMany({
      where: {
        enabled: true,
        AND: [
          {
            OR: [{ targetAgentId: null }, { targetAgentId: agentId }],
          },
          {
            OR: [{ targetTool: null }, { targetTool: tool }],
          },
        ],
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });

    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as any,
      enabled: r.enabled,
      enforcementMode: r.enforcementMode as any,
      targetAgentId: r.targetAgentId,
      targetTool: r.targetTool,
      config: r.config as any,
      priority: r.priority,
    }));
  }

  /**
   * Process a tool call through the WAF inspection pipeline
   */
  async processToolCall(args: ProcessToolCallArgs): Promise<ToolCallResponse> {
    const startTime = Date.now();
    const {
      agentId,
      agentName,
      declaredScope,
      sessionId,
      tool,
      params,
      requestId,
    } = args;

    // Ensure session exists or create AgentSession
    try {
      await prisma.agentSession.upsert({
        where: { id: sessionId },
        create: { id: sessionId, agentId },
        update: {},
      });
    } catch {
      // Ignore if session already exists
    }

    const rules = await this.loadApplicableRules(agentId, tool);

    const evalContext: EvaluationContext = {
      agentId,
      agentName,
      declaredScope,
      sessionId,
      tool,
      params,
      redis: this.redisClient,
    };

    const ruleResults: RuleEvaluationResult[] = [];
    const matchedPatterns: string[] = [];
    const stateUpdaters: Array<() => Promise<void>> = [];

    let hasBlockFailure = false;
    let hasShadowFailure = false;
    let firstBlockedReason: string | undefined;

    // Step 3 & 4: Evaluate each applicable rule
    for (const rule of rules) {
      let output: EvaluatorOutput;

      switch (rule.type) {
        case "RATE_LIMIT":
          output = await evaluateRateLimit(rule, evalContext);
          break;
        case "PARAM_BLOCKLIST":
          output = await evaluateParamBlocklist(rule, evalContext);
          break;
        case "PARAM_SIZE_LIMIT":
          output = await evaluateParamSizeLimit(rule, evalContext);
          break;
        case "DATA_SCOPE":
          output = await evaluateDataScope(rule, evalContext);
          break;
        case "SEQUENCE":
          output = await evaluateSequence(rule, evalContext);
          break;
        default:
          output = {
            ruleId: rule.id,
            ruleName: rule.name,
            type: rule.type,
            enforcementMode: rule.enforcementMode,
            passed: true,
          };
      }

      ruleResults.push({
        ruleId: output.ruleId,
        ruleName: output.ruleName,
        type: output.type,
        enforcementMode: output.enforcementMode,
        passed: output.passed,
        reason: output.reason,
      });

      if (output.matchedPatterns) {
        matchedPatterns.push(...output.matchedPatterns);
      }

      if (output.postExecutionStateUpdate) {
        stateUpdaters.push(output.postExecutionStateUpdate);
      }

      if (!output.passed) {
        if (rule.enforcementMode === "BLOCK") {
          hasBlockFailure = true;
          if (!firstBlockedReason) {
            firstBlockedReason = output.reason;
          }
        } else if (rule.enforcementMode === "SHADOW") {
          hasShadowFailure = true;
        }
      }
    }

    // Step 5: Determine final disposition
    let disposition: Disposition;
    if (hasBlockFailure) {
      disposition = "BLOCKED";
    } else if (hasShadowFailure) {
      disposition = "SHADOW_BLOCKED";
    } else {
      disposition = "ALLOWED";
    }

    let executionResult: any = undefined;

    // Execute mock tool if not blocked (Allowed or Shadow-Blocked)
    if (disposition === "ALLOWED" || disposition === "SHADOW_BLOCKED") {
      try {
        const toolRes = await executeMockTool(tool, params);
        if (toolRes.success) {
          executionResult = toolRes.data;
        } else {
          executionResult = { error: toolRes.error };
        }

        // Step 8: Update Redis rate-limit and sequence state atomically after successful execution
        for (const updateState of stateUpdaters) {
          await updateState();
        }

        // Record tool call in Redis session sequence set
        const seqKey = `seq:${sessionId}`;
        await this.redisClient.sadd(seqKey, tool);
        await this.redisClient.expire(seqKey, 86400); // 24hr session TTL
      } catch (err: any) {
        logger.error({ err, tool, sessionId }, "Mock tool execution error");
        disposition = "ERROR";
        executionResult = {
          error: err.message || "Internal tool execution error",
        };
      }
    }

    const latencyMs = Date.now() - startTime;

    // Step 6: Sanitize parameters for logging and broadcasting
    const paramsSanitized = sanitizeParams(params, matchedPatterns);

    // Step 7: Persist ToolCallLog to Postgres and broadcast to Redis pub/sub
    try {
      const logRecord = await prisma.toolCallLog.create({
        data: {
          agentId,
          sessionId,
          tool,
          paramsSanitized,
          ruleResults: ruleResults as any,
          disposition: disposition as any,
          latencyMs,
          requestId,
        },
      });

      const eventPayload: ToolCallEvent = {
        id: logRecord.id,
        timestamp: logRecord.timestamp.toISOString(),
        agentId,
        agentName,
        sessionId,
        tool,
        paramsSanitized,
        ruleResults,
        disposition,
        latencyMs,
        requestId,
      };

      // Broadcast over Redis pub/sub
      await redisPub.publish(
        REDIS_CHANNELS.TOOL_EVENTS,
        JSON.stringify(eventPayload),
      );
    } catch (err) {
      logger.error(
        { err, requestId },
        "Failed to persist tool call log or publish to Redis",
      );
    }

    return {
      disposition,
      result: executionResult,
      blockedReason: firstBlockedReason,
      ruleResults,
      requestId,
      latencyMs,
    };
  }
}

export const ruleEngine = new RuleEngine();
