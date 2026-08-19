import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { INITIAL_CUSTOMERS } from "../mock-tools/store.js";
import { logger } from "../lib/logger.js";
import "dotenv/config";

export const DEMO_AGENT_KEY = "agnt_demo_alpha_key_999888777666";
export const DEMO_ADMIN_EMAIL = "admin@agentwaf.local";
export const DEMO_ADMIN_PASSWORD =
  process.env.ADMIN_DEFAULT_PASSWORD || "ChangeMe123!";

export async function seedDatabase() {
  logger.info("Starting database seed...");

  // 1. Seed ~30 Customer records
  for (const cust of INITIAL_CUSTOMERS) {
    await prisma.customer.upsert({
      where: { id: cust.id },
      create: {
        id: cust.id,
        name: cust.name,
        email: cust.email,
        tier: cust.tier,
        balance: cust.balance,
        status: cust.status,
      },
      update: {
        name: cust.name,
        email: cust.email,
        tier: cust.tier,
        balance: cust.balance,
        status: cust.status,
      },
    });
  }
  logger.info(`Seeded ${INITIAL_CUSTOMERS.length} customer records.`);

  // 2. Seed Demo Agent: Support Bot Alpha
  const agentKeyHash = await bcrypt.hash(DEMO_AGENT_KEY, 10);
  const agentKeyPrefix = DEMO_AGENT_KEY.substring(0, 8);

  const demoAgent = await prisma.agent.upsert({
    where: { id: "agent_alpha_demo_01" },
    create: {
      id: "agent_alpha_demo_01",
      name: "Support Bot Alpha",
      apiKeyHash: agentKeyHash,
      apiKeyPrefix: agentKeyPrefix,
      declaredScope: {
        allowedCustomerIdPattern: "^CUST-1",
        allowedTools: [
          "get_customer_record",
          "update_customer_record",
          "delete_customer_record",
          "send_email",
          "execute_report_query",
          "export_report",
        ],
      },
    },
    update: {
      name: "Support Bot Alpha",
      apiKeyHash: agentKeyHash,
      apiKeyPrefix: agentKeyPrefix,
      declaredScope: {
        allowedCustomerIdPattern: "^CUST-1",
        allowedTools: [
          "get_customer_record",
          "update_customer_record",
          "delete_customer_record",
          "send_email",
          "execute_report_query",
          "export_report",
        ],
      },
    },
  });
  logger.info(
    { agentId: demoAgent.id, prefix: agentKeyPrefix },
    "Seeded Demo Agent Support Bot Alpha.",
  );

  // 3. Seed Default Rules covering all 5 rule types + shadow mode
  const rulesToSeed = [
    {
      id: "rule_data_scope_cust_01",
      name: "Customer ID Scope Enforcement",
      type: "DATA_SCOPE" as const,
      enabled: true,
      enforcementMode: "BLOCK" as const,
      targetAgentId: null, // Applies to all agents
      targetTool: "get_customer_record",
      config: { scopeParam: "customerId" },
      priority: 1,
    },
    {
      id: "rule_sequence_update_01",
      name: "Update Requires Prior Get Inspection",
      type: "SEQUENCE" as const,
      enabled: true,
      enforcementMode: "BLOCK" as const,
      targetAgentId: null,
      targetTool: "update_customer_record",
      config: { requiresToolBefore: "get_customer_record" },
      priority: 2,
    },
    {
      id: "rule_sequence_delete_01",
      name: "Delete Requires Prior Update Confirmation",
      type: "SEQUENCE" as const,
      enabled: true,
      enforcementMode: "BLOCK" as const,
      targetAgentId: null,
      targetTool: "delete_customer_record",
      config: { requiresToolBefore: "update_customer_record" },
      priority: 3,
    },
    {
      id: "rule_blocklist_sql_01",
      name: "SQL Injection Payload Blocklist",
      type: "PARAM_BLOCKLIST" as const,
      enabled: true,
      enforcementMode: "BLOCK" as const,
      targetAgentId: null,
      targetTool: "execute_report_query",
      config: {
        paramPath: "sqlLike",
        patterns: [
          "(DROP|DELETE|TRUNCATE|ALTER)\\s+TABLE",
          "UNION\\s+SELECT",
          "--|;|'\\s*OR\\s*'1'='1'",
        ],
        matchType: "regex",
      },
      priority: 4,
    },
    {
      id: "rule_size_limit_email_01",
      name: "Email Body Size Limit (100 chars)",
      type: "PARAM_SIZE_LIMIT" as const,
      enabled: true,
      enforcementMode: "BLOCK" as const,
      targetAgentId: null,
      targetTool: "send_email",
      config: { paramPath: "body", maxLength: 100 },
      priority: 5,
    },
    {
      id: "rule_rate_limit_export_01",
      name: "Export Report Rate Limit (max 3/min)",
      type: "RATE_LIMIT" as const,
      enabled: true,
      enforcementMode: "BLOCK" as const,
      targetAgentId: null,
      targetTool: "export_report",
      config: { maxCalls: 3, windowSeconds: 60, scope: "agent" },
      priority: 6,
    },
    {
      id: "rule_shadow_query_watch_01",
      name: "Shadow Audit: Expensive Query Patterns",
      type: "PARAM_BLOCKLIST" as const,
      enabled: true,
      enforcementMode: "SHADOW" as const,
      targetAgentId: null,
      targetTool: "execute_report_query",
      config: {
        paramPath: "sqlLike",
        patterns: ["SELECT\\s+\\*"],
        matchType: "regex",
      },
      priority: 10,
    },
  ];

  for (const r of rulesToSeed) {
    await prisma.rule.upsert({
      where: { id: r.id },
      create: r,
      update: r,
    });
  }
  logger.info(`Seeded ${rulesToSeed.length} default WAF rules.`);

  // 4. Seed Better-Auth Admin User
  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
  const adminUser = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    create: {
      id: "user_admin_demo_01",
      name: "Security Admin",
      email: DEMO_ADMIN_EMAIL,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      accounts: {
        create: {
          id: "account_admin_demo_01",
          accountId: "user_admin_demo_01",
          providerId: "credential",
          password: passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    },
    update: {
      name: "Security Admin",
    },
  });

  logger.info(
    { adminId: adminUser.id, email: adminUser.email },
    "Seeded Better-Auth admin account.",
  );
  logger.info("Database seeding completed successfully.");
}

// Auto-run if executed directly
if (process.argv[1]?.includes("seed.ts")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
