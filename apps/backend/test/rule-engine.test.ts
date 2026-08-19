import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import {
  evaluateRateLimit,
  evaluateParamBlocklist,
  evaluateParamSizeLimit,
  evaluateDataScope,
  evaluateSequence,
  RuleModel,
  EvaluationContext,
} from "../src/rules/evaluators.js";
import { sanitizeParams } from "../src/rules/utils.js";
import { executeMockTool } from "../src/mock-tools/executors.js";
import { customerStore } from "../src/mock-tools/store.js";

// In-memory mock for Redis state in unit tests
class MockRedis {
  private kv = new Map<string, string>();
  private sets = new Map<string, Set<string>>();

  async get(key: string): Promise<string | null> {
    return this.kv.get(key) || null;
  }

  async sismember(key: string, member: string): Promise<number> {
    const s = this.sets.get(key);
    return s && s.has(member) ? 1 : 0;
  }

  async sadd(key: string, member: string): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    this.sets.get(key)!.add(member);
    return 1;
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    return 1;
  }

  multi() {
    const operations: Array<() => void> = [];
    return {
      incr: (key: string) => {
        operations.push(() => {
          const val = parseInt(this.kv.get(key) || "0", 10) + 1;
          this.kv.set(key, val.toString());
        });
        return this;
      },
      expire: (_key: string, _sec: number) => {
        return this;
      },
      exec: async () => {
        for (const op of operations) op();
        return [];
      },
    };
  }

  clear() {
    this.kv.clear();
    this.sets.clear();
  }
}

describe("Agent WAF — Rule Engine Unit Test Suite", () => {
  let mockRedis: MockRedis;

  beforeEach(() => {
    mockRedis = new MockRedis();
    customerStore.reset();
  });

  // Test 1: Rate Limiting
  describe("1. RATE_LIMIT rule evaluator", () => {
    const rateLimitRule: RuleModel = {
      id: "rule_rl_1",
      name: "Export Report Rate Limit (max 2)",
      type: "RATE_LIMIT",
      enabled: true,
      enforcementMode: "BLOCK",
      config: { maxCalls: 2, windowSeconds: 60, scope: "agent" },
      priority: 1,
    };

    it("should allow calls within the configured threshold and increment count", async () => {
      const ctx: EvaluationContext = {
        agentId: "agent_alpha",
        sessionId: "sess_1",
        tool: "export_report",
        params: {},
        redis: mockRedis as any,
      };

      // 1st call
      const res1 = await evaluateRateLimit(rateLimitRule, ctx);
      expect(res1.passed).toBe(true);
      if (res1.postExecutionStateUpdate) await res1.postExecutionStateUpdate();

      // 2nd call
      const res2 = await evaluateRateLimit(rateLimitRule, ctx);
      expect(res2.passed).toBe(true);
      if (res2.postExecutionStateUpdate) await res2.postExecutionStateUpdate();

      // 3rd call should trigger rate limit (N+1st call)
      const res3 = await evaluateRateLimit(rateLimitRule, ctx);
      expect(res3.passed).toBe(false);
      expect(res3.reason).toContain("Rate limit exceeded");
      expect(res3.reason).toContain("2/2 calls allowed");
    });
  });

  // Test 2: Parameter Blocklist & Injection Detection
  describe("2. PARAM_BLOCKLIST rule evaluator", () => {
    const blocklistRule: RuleModel = {
      id: "rule_bl_1",
      name: "SQL Injection Blocklist",
      type: "PARAM_BLOCKLIST",
      enabled: true,
      enforcementMode: "BLOCK",
      config: {
        paramPath: "sqlLike",
        patterns: [
          "(DROP|DELETE|TRUNCATE|ALTER)\\s+TABLE",
          "UNION\\s+SELECT",
          "--|;|'\\s*OR\\s*'1'='1'",
        ],
        matchType: "regex",
      },
      priority: 1,
    };

    it("should pass when clean parameters are provided", async () => {
      const ctx: EvaluationContext = {
        agentId: "agent_alpha",
        sessionId: "sess_1",
        tool: "execute_report_query",
        params: {
          sqlLike:
            "SELECT name, email FROM customers WHERE tier = 'enterprise'",
        },
        redis: mockRedis as any,
      };

      const res = await evaluateParamBlocklist(blocklistRule, ctx);
      expect(res.passed).toBe(true);
    });

    it("should block SQL injection attack payloads", async () => {
      const ctx: EvaluationContext = {
        agentId: "agent_alpha",
        sessionId: "sess_1",
        tool: "execute_report_query",
        params: {
          sqlLike:
            "SELECT * FROM customers WHERE id = 'CUST-1001' UNION SELECT username, password FROM users --",
        },
        redis: mockRedis as any,
      };

      const res = await evaluateParamBlocklist(blocklistRule, ctx);
      expect(res.passed).toBe(false);
      expect(res.reason).toContain("contained blocked pattern");
    });

    it("should sanitize and redact matched injection payloads in params", () => {
      const dirtyParams = {
        sqlLike: "SELECT * FROM customers; DROP TABLE customers; --",
        note: "Normal note",
      };
      const sanitized = sanitizeParams(dirtyParams, ["DROP\\s+TABLE"]);
      expect(sanitized.sqlLike).toContain("[REDACTED]");
      expect(sanitized.note).toBe("Normal note");
    });
  });

  // Test 3: Parameter Size Limit
  describe("3. PARAM_SIZE_LIMIT rule evaluator", () => {
    const sizeLimitRule: RuleModel = {
      id: "rule_sl_1",
      name: "Email Body Size Limit",
      type: "PARAM_SIZE_LIMIT",
      enabled: true,
      enforcementMode: "BLOCK",
      config: { paramPath: "body", maxLength: 50 },
      priority: 1,
    };

    it("should pass when string length is within limit", async () => {
      const ctx: EvaluationContext = {
        agentId: "agent_alpha",
        sessionId: "sess_1",
        tool: "send_email",
        params: {
          to: "user@example.com",
          subject: "Hi",
          body: "Short email content",
        },
        redis: mockRedis as any,
      };

      const res = await evaluateParamSizeLimit(sizeLimitRule, ctx);
      expect(res.passed).toBe(true);
    });

    it("should block when string length exceeds max limit", async () => {
      const ctx: EvaluationContext = {
        agentId: "agent_alpha",
        sessionId: "sess_1",
        tool: "send_email",
        params: {
          to: "user@example.com",
          subject: "Exceeds",
          body: "A".repeat(100),
        },
        redis: mockRedis as any,
      };

      const res = await evaluateParamSizeLimit(sizeLimitRule, ctx);
      expect(res.passed).toBe(false);
      expect(res.reason).toContain("exceeds maximum allowed length (50)");
    });
  });

  // Test 4: Data Scope Enforcement
  describe("4. DATA_SCOPE rule evaluator", () => {
    const dataScopeRule: RuleModel = {
      id: "rule_ds_1",
      name: "Customer Tier-1 Data Scope Rule",
      type: "DATA_SCOPE",
      enabled: true,
      enforcementMode: "BLOCK",
      config: { scopeParam: "customerId" },
      priority: 1,
    };

    it("should pass when target customerId matches agent's declared scope pattern", async () => {
      const ctx: EvaluationContext = {
        agentId: "agent_alpha",
        declaredScope: { allowedCustomerIdPattern: "^CUST-1" },
        sessionId: "sess_1",
        tool: "get_customer_record",
        params: { customerId: "CUST-1005" },
        redis: mockRedis as any,
      };

      const res = await evaluateDataScope(dataScopeRule, ctx);
      expect(res.passed).toBe(true);
    });

    it("should block out-of-scope customerId (e.g. CUST-2005 for a ^CUST-1 agent)", async () => {
      const ctx: EvaluationContext = {
        agentId: "agent_alpha",
        declaredScope: { allowedCustomerIdPattern: "^CUST-1" },
        sessionId: "sess_1",
        tool: "get_customer_record",
        params: { customerId: "CUST-2005" },
        redis: mockRedis as any,
      };

      const res = await evaluateDataScope(dataScopeRule, ctx);
      expect(res.passed).toBe(false);
      expect(res.reason).toContain("Data scope violation");
      expect(res.reason).toContain(
        "does not match agent scope pattern '^CUST-1'",
      );
    });
  });

  // Test 5: Sequence Enforcement
  describe("5. SEQUENCE rule evaluator", () => {
    const sequenceRule: RuleModel = {
      id: "rule_seq_1",
      name: "Update Requires Get First",
      type: "SEQUENCE",
      enabled: true,
      enforcementMode: "BLOCK",
      config: { requiresToolBefore: "get_customer_record" },
      priority: 1,
    };

    it("should block update_customer_record when get_customer_record has not been called in session", async () => {
      const ctx: EvaluationContext = {
        agentId: "agent_alpha",
        sessionId: "session_fresh_123",
        tool: "update_customer_record",
        params: { customerId: "CUST-1001", fields: { status: "suspended" } },
        redis: mockRedis as any,
      };

      const res = await evaluateSequence(sequenceRule, ctx);
      expect(res.passed).toBe(false);
      expect(res.reason).toContain("Sequence violation");
      expect(res.reason).toContain("requires 'get_customer_record'");
    });

    it("should allow update_customer_record after get_customer_record was called in session", async () => {
      const sessionId = "session_fresh_123";
      await mockRedis.sadd(`seq:${sessionId}`, "get_customer_record");

      const ctx: EvaluationContext = {
        agentId: "agent_alpha",
        sessionId,
        tool: "update_customer_record",
        params: { customerId: "CUST-1001", fields: { status: "suspended" } },
        redis: mockRedis as any,
      };

      const res = await evaluateSequence(sequenceRule, ctx);
      expect(res.passed).toBe(true);
    });
  });

  // Test 6: Shadow Mode Behavior
  describe("6. SHADOW Mode Evaluation", () => {
    const shadowRule: RuleModel = {
      id: "rule_shadow_1",
      name: "Shadow SQL Inspection",
      type: "PARAM_BLOCKLIST",
      enabled: true,
      enforcementMode: "SHADOW",
      config: {
        paramPath: "sqlLike",
        patterns: ["DROP\\s+TABLE"],
        matchType: "regex",
      },
      priority: 1,
    };

    it("evaluator should flag failure with enforcementMode=SHADOW", async () => {
      const ctx: EvaluationContext = {
        agentId: "agent_alpha",
        sessionId: "sess_shadow",
        tool: "execute_report_query",
        params: { sqlLike: "DROP TABLE users;" },
        redis: mockRedis as any,
      };

      const res = await evaluateParamBlocklist(shadowRule, ctx);
      expect(res.passed).toBe(false);
      expect(res.enforcementMode).toBe("SHADOW");
    });
  });

  // Test 7: Mock Tool Executors
  describe("7. Mock Tool Execution Suite", () => {
    it("should fetch customer records correctly", async () => {
      const res = await executeMockTool("get_customer_record", {
        customerId: "CUST-1001",
      });
      expect(res.success).toBe(true);
      expect(res.data.name).toBe("Acme Corp");
    });

    it("should update customer records correctly", async () => {
      const res = await executeMockTool("update_customer_record", {
        customerId: "CUST-1001",
        fields: { tier: "enterprise", balance: 99999 },
      });
      expect(res.success).toBe(true);
      expect(res.data.balance).toBe(99999);
    });

    it("should return error for non-existent customer", async () => {
      const res = await executeMockTool("get_customer_record", {
        customerId: "CUST-9999",
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("not found");
    });
  });
});
