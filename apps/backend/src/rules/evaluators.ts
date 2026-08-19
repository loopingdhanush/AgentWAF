import { Redis } from "ioredis";
import {
  RuleType,
  EnforcementMode,
  RuleEvaluationResult,
  RateLimitConfig,
  ParamBlocklistConfig,
  ParamSizeLimitConfig,
  DataScopeConfig,
  SequenceConfig,
  DeclaredScope,
} from "@agentwaf/shared-types";
import { getNestedValue } from "./utils.js";

export interface EvaluationContext {
  agentId: string;
  agentName?: string;
  declaredScope?: DeclaredScope;
  sessionId: string;
  tool: string;
  params: Record<string, any>;
  redis: Redis;
}

export interface RuleModel {
  id: string;
  name: string;
  type: RuleType;
  enabled: boolean;
  enforcementMode: EnforcementMode;
  targetAgentId?: string | null;
  targetTool?: string | null;
  config: any;
  priority: number;
}

export interface EvaluatorOutput extends RuleEvaluationResult {
  matchedPatterns?: string[];
  postExecutionStateUpdate?: () => Promise<void>;
}

export async function evaluateRateLimit(
  rule: RuleModel,
  ctx: EvaluationContext,
): Promise<EvaluatorOutput> {
  const config = rule.config as RateLimitConfig;
  const maxCalls = config.maxCalls || 5;
  const windowSeconds = config.windowSeconds || 60;
  const scope = config.scope || "agent";

  const targetId = scope === "session" ? ctx.sessionId : ctx.agentId;
  const redisKey = `rl:${scope}:${targetId}:${ctx.tool}`;

  const currentCountStr = await ctx.redis.get(redisKey);
  const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;

  if (currentCount >= maxCalls) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      type: "RATE_LIMIT",
      enforcementMode: rule.enforcementMode,
      passed: false,
      reason: `Rate limit exceeded: tool '${ctx.tool}' has reached ${currentCount}/${maxCalls} calls allowed in ${windowSeconds}s window`,
    };
  }

  // Create closure to atomically increment and set expire on post-execution
  const postExecutionStateUpdate = async () => {
    const multi = ctx.redis.multi();
    multi.incr(redisKey);
    // If it was 0 or not set, ensure expiry is set
    if (currentCount === 0) {
      multi.expire(redisKey, windowSeconds);
    }
    await multi.exec();
  };

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: "RATE_LIMIT",
    enforcementMode: rule.enforcementMode,
    passed: true,
    postExecutionStateUpdate,
  };
}

export async function evaluateParamBlocklist(
  rule: RuleModel,
  ctx: EvaluationContext,
): Promise<EvaluatorOutput> {
  const config = rule.config as ParamBlocklistConfig;
  const paramPath = config.paramPath;
  const patterns = config.patterns || [];
  const value = getNestedValue(ctx.params, paramPath);

  if (value === undefined || value === null) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      type: "PARAM_BLOCKLIST",
      enforcementMode: rule.enforcementMode,
      passed: true,
    };
  }

  const stringVal = typeof value === "string" ? value : JSON.stringify(value);
  const matchedPatterns: string[] = [];

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, "i");
      if (regex.test(stringVal)) {
        matchedPatterns.push(pattern);
      }
    } catch {
      // Fallback substring check if regex invalid
      if (stringVal.toLowerCase().includes(pattern.toLowerCase())) {
        matchedPatterns.push(pattern);
      }
    }
  }

  if (matchedPatterns.length > 0) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      type: "PARAM_BLOCKLIST",
      enforcementMode: rule.enforcementMode,
      passed: false,
      reason: `Parameter '${paramPath}' contained blocked pattern(s): ${matchedPatterns.join(", ")}`,
      matchedPatterns,
    };
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: "PARAM_BLOCKLIST",
    enforcementMode: rule.enforcementMode,
    passed: true,
  };
}

export async function evaluateParamSizeLimit(
  rule: RuleModel,
  ctx: EvaluationContext,
): Promise<EvaluatorOutput> {
  const config = rule.config as ParamSizeLimitConfig;
  const paramPath = config.paramPath;
  const maxLength = config.maxLength;
  const value = getNestedValue(ctx.params, paramPath);

  if (value === undefined || value === null) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      type: "PARAM_SIZE_LIMIT",
      enforcementMode: rule.enforcementMode,
      passed: true,
    };
  }

  const actualLength =
    typeof value === "string"
      ? value.length
      : Array.isArray(value)
        ? value.length
        : JSON.stringify(value).length;

  if (actualLength > maxLength) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      type: "PARAM_SIZE_LIMIT",
      enforcementMode: rule.enforcementMode,
      passed: false,
      reason: `Parameter '${paramPath}' length (${actualLength}) exceeds maximum allowed length (${maxLength})`,
    };
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: "PARAM_SIZE_LIMIT",
    enforcementMode: rule.enforcementMode,
    passed: true,
  };
}

export async function evaluateDataScope(
  rule: RuleModel,
  ctx: EvaluationContext,
): Promise<EvaluatorOutput> {
  const config = rule.config as DataScopeConfig;
  const scopeParam = config.scopeParam;
  const val = getNestedValue(ctx.params, scopeParam);

  const pattern = ctx.declaredScope?.allowedCustomerIdPattern;
  if (!pattern) {
    // If no pattern constraint defined for the agent, allow
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      type: "DATA_SCOPE",
      enforcementMode: rule.enforcementMode,
      passed: true,
    };
  }

  if (!val) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      type: "DATA_SCOPE",
      enforcementMode: rule.enforcementMode,
      passed: false,
      reason: `Data scope check failed: missing required scope parameter '${scopeParam}'`,
    };
  }

  try {
    const regex = new RegExp(pattern);
    if (!regex.test(String(val))) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        type: "DATA_SCOPE",
        enforcementMode: rule.enforcementMode,
        passed: false,
        reason: `Data scope violation: target '${scopeParam}' value '${val}' does not match agent scope pattern '${pattern}'`,
      };
    }
  } catch (err: any) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      type: "DATA_SCOPE",
      enforcementMode: rule.enforcementMode,
      passed: false,
      reason: `Invalid regex in agent scope pattern: ${pattern}`,
    };
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: "DATA_SCOPE",
    enforcementMode: rule.enforcementMode,
    passed: true,
  };
}

export async function evaluateSequence(
  rule: RuleModel,
  ctx: EvaluationContext,
): Promise<EvaluatorOutput> {
  const config = rule.config as SequenceConfig;
  const requiredTool = config.requiresToolBefore;
  const seqKey = `seq:${ctx.sessionId}`;

  const hasCalledRequired = await ctx.redis.sismember(seqKey, requiredTool);

  if (hasCalledRequired !== 1) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      type: "SEQUENCE",
      enforcementMode: rule.enforcementMode,
      passed: false,
      reason: `Sequence violation: tool '${ctx.tool}' requires '${requiredTool}' to have been called earlier in session '${ctx.sessionId}'`,
    };
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: "SEQUENCE",
    enforcementMode: rule.enforcementMode,
    passed: true,
  };
}
