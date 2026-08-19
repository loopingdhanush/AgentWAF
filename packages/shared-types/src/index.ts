import { z } from "zod";

export const RuleTypeEnum = z.enum([
  "RATE_LIMIT",
  "PARAM_BLOCKLIST",
  "PARAM_SIZE_LIMIT",
  "DATA_SCOPE",
  "SEQUENCE",
]);
export type RuleType = z.infer<typeof RuleTypeEnum>;

export const EnforcementModeEnum = z.enum(["BLOCK", "SHADOW"]);
export type EnforcementMode = z.infer<typeof EnforcementModeEnum>;

export const DispositionEnum = z.enum([
  "ALLOWED",
  "BLOCKED",
  "SHADOW_BLOCKED",
  "ERROR",
]);
export type Disposition = z.infer<typeof DispositionEnum>;

// Rule Config Schemas
export const RateLimitConfigSchema = z.object({
  maxCalls: z.number().int().positive(),
  windowSeconds: z.number().int().positive(),
  scope: z.enum(["agent", "session"]).default("agent"),
});
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

export const ParamBlocklistConfigSchema = z.object({
  paramPath: z.string().min(1),
  patterns: z.array(z.string()),
  matchType: z.literal("regex").default("regex"),
});
export type ParamBlocklistConfig = z.infer<typeof ParamBlocklistConfigSchema>;

export const ParamSizeLimitConfigSchema = z.object({
  paramPath: z.string().min(1),
  maxLength: z.number().int().positive(),
});
export type ParamSizeLimitConfig = z.infer<typeof ParamSizeLimitConfigSchema>;

export const DataScopeConfigSchema = z.object({
  scopeParam: z.string().min(1),
});
export type DataScopeConfig = z.infer<typeof DataScopeConfigSchema>;

export const SequenceConfigSchema = z.object({
  requiresToolBefore: z.string().min(1),
});
export type SequenceConfig = z.infer<typeof SequenceConfigSchema>;

export const RuleConfigSchema = z.union([
  RateLimitConfigSchema,
  ParamBlocklistConfigSchema,
  ParamSizeLimitConfigSchema,
  DataScopeConfigSchema,
  SequenceConfigSchema,
  z.record(z.any()),
]);
export type RuleConfig = z.infer<typeof RuleConfigSchema>;

// Agent declaredScope Schema
export const DeclaredScopeSchema = z.object({
  allowedCustomerIdPattern: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  customAttributes: z.record(z.any()).optional(),
});
export type DeclaredScope = z.infer<typeof DeclaredScopeSchema>;

// Tool Call Request Schema
export const ToolCallRequestSchema = z.object({
  sessionId: z.string().min(1),
  tool: z.string().min(1),
  params: z.record(z.any()).default({}),
});
export type ToolCallRequest = z.infer<typeof ToolCallRequestSchema>;

// Single Rule Evaluation Outcome
export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  type: RuleType;
  enforcementMode: EnforcementMode;
  passed: boolean;
  reason?: string;
}

// Tool Call Response Schema
export interface ToolCallResponse {
  disposition: Disposition;
  result?: any;
  blockedReason?: string;
  ruleResults: RuleEvaluationResult[];
  requestId?: string;
  latencyMs?: number;
}

// Real-time Event payload (broadcast over Socket.IO)
export interface ToolCallEvent {
  id: string;
  timestamp: string;
  agentId: string;
  agentName?: string;
  sessionId: string;
  tool: string;
  paramsSanitized: Record<string, any>;
  ruleResults: RuleEvaluationResult[];
  disposition: Disposition;
  latencyMs: number;
  requestId: string;
}

// Admin stats summary
export interface StatsSummary {
  totalCalls: number;
  dispositionCounts: {
    ALLOWED: number;
    BLOCKED: number;
    SHADOW_BLOCKED: number;
    ERROR: number;
  };
  blockRatePercentage: number;
  topBlockedTools: Array<{ tool: string; count: number }>;
  callsByTool: Array<{ tool: string; count: number }>;
  recentTimeSeries: Array<{
    timestamp: string;
    allowed: number;
    blocked: number;
    shadowBlocked: number;
  }>;
}
