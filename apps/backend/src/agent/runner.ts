import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import { WAF_FUNCTION_DECLARATIONS } from "./tools.js";
import { DEMO_AGENT_KEY } from "../db/seed.js";
import { logger } from "../lib/logger.js";
import "dotenv/config";

export interface AgentStep {
  stepIndex: number;
  toolCall?: {
    tool: string;
    params: Record<string, any>;
  };
  wafResponse?: {
    disposition: string;
    result?: any;
    blockedReason?: string;
    ruleResults: any[];
  };
  modelThought?: string;
}

export interface AgentRunResult {
  sessionId: string;
  goal: string;
  model: string;
  isRealGemini: boolean;
  finalAnswer: string;
  steps: AgentStep[];
  totalSteps: number;
  totalBlocks: number;
}

/**
 * Executes an agentic goal either via live Google Gen AI SDK (@google/genai)
 * or via simulated loop when GEMINI_API_KEY is not yet populated.
 */
export async function runAgentGoal(options: {
  goal: string;
  sessionId?: string;
  agentKey?: string;
  gatewayUrl?: string;
  maxSteps?: number;
  onStep?: (step: AgentStep) => void;
}): Promise<AgentRunResult> {
  const {
    goal,
    sessionId = `sess_agent_${crypto.randomBytes(4).toString("hex")}`,
    agentKey = DEMO_AGENT_KEY,
    gatewayUrl = `http://localhost:${process.env.PORT || 4000}/api/v1/tool-call`,
    maxSteps = 8,
    onStep,
  } = options;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  // If GEMINI_API_KEY is present, execute via real @google/genai SDK
  if (apiKey) {
    return runWithLiveGemini({
      goal,
      sessionId,
      agentKey,
      gatewayUrl,
      maxSteps,
      apiKey,
      modelName,
      onStep,
    });
  }

  // Fallback simulator for offline evaluation when GEMINI_API_KEY is not configured
  return runSimulatedAgentLoop({
    goal,
    sessionId,
    agentKey,
    gatewayUrl,
    modelName: `${modelName} (simulated fallback - set GEMINI_API_KEY in .env for live Gemini API)`,
    onStep,
  });
}

async function runWithLiveGemini(opts: {
  goal: string;
  sessionId: string;
  agentKey: string;
  gatewayUrl: string;
  maxSteps: number;
  apiKey: string;
  modelName: string;
  onStep?: (step: AgentStep) => void;
}): Promise<AgentRunResult> {
  const {
    goal,
    sessionId,
    agentKey,
    gatewayUrl,
    maxSteps,
    apiKey,
    modelName,
    onStep,
  } = opts;
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are Support Bot Alpha, an enterprise AI assistant.
You have access to tools: get_customer_record, update_customer_record, delete_customer_record, send_email, execute_report_query, export_report.
Every tool call is intercepted and inspected by an Agent WAF Gateway.
If a call is denied with a security reason, inspect the error, explain it, or adapt (e.g. look up customer before update, shorten email text).
Summarize your final answer clearly for the user.`;

  const contents: any[] = [
    {
      role: "user",
      parts: [{ text: goal }],
    },
  ];

  const steps: AgentStep[] = [];
  let totalBlocks = 0;
  let finalAnswer = "";

  logger.info(
    { sessionId, goal, model: modelName },
    "Running live Gemini agent loop",
  );

  for (let stepIndex = 1; stepIndex <= maxSteps; stepIndex++) {
    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        tools: [
          {
            functionDeclarations: WAF_FUNCTION_DECLARATIONS as any,
          },
        ],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate || !candidate.content) {
      finalAnswer = "Gemini returned empty response.";
      break;
    }

    const contentParts = candidate.content.parts || [];
    const functionCalls = response.functionCalls || [];

    let modelText = "";
    for (const part of contentParts) {
      if (part.text) modelText += part.text;
    }

    contents.push(candidate.content);

    if (functionCalls.length === 0) {
      finalAnswer = modelText || "Task completed successfully.";
      const finalStep: AgentStep = { stepIndex, modelThought: finalAnswer };
      steps.push(finalStep);
      if (onStep) onStep(finalStep);
      break;
    }

    const functionResponseParts: any[] = [];

    for (const fCall of functionCalls) {
      const toolName = fCall.name;
      const toolParams = (fCall.args as Record<string, any>) || {};

      let wafResponse: any;
      try {
        const httpRes = await fetch(gatewayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-agent-key": agentKey,
            "x-request-id": `req_gemini_${stepIndex}_${Date.now()}`,
          },
          body: JSON.stringify({
            sessionId,
            tool: toolName,
            params: toolParams,
          }),
        });
        wafResponse = await httpRes.json();
      } catch (err: any) {
        wafResponse = {
          disposition: "ERROR",
          blockedReason: `Gateway communication error: ${err.message}`,
          ruleResults: [],
        };
      }

      if (wafResponse.disposition === "BLOCKED") {
        totalBlocks++;
      }

      const currentStep: AgentStep = {
        stepIndex,
        toolCall: { tool: toolName, params: toolParams },
        wafResponse,
        modelThought: modelText || undefined,
      };

      steps.push(currentStep);
      if (onStep) onStep(currentStep);

      functionResponseParts.push({
        functionResponse: {
          name: toolName,
          response:
            wafResponse.disposition === "ALLOWED" ||
            wafResponse.disposition === "SHADOW_BLOCKED"
              ? {
                  status: "SUCCESS",
                  data: wafResponse.result,
                  disposition: wafResponse.disposition,
                }
              : {
                  status: "DENIED",
                  error: wafResponse.blockedReason,
                  disposition: wafResponse.disposition,
                },
        },
      });
    }

    contents.push({
      role: "user",
      parts: functionResponseParts,
    });
  }

  return {
    sessionId,
    goal,
    model: modelName,
    isRealGemini: true,
    finalAnswer:
      finalAnswer ||
      steps[steps.length - 1]?.modelThought ||
      "Goal processing completed.",
    steps,
    totalSteps: steps.length,
    totalBlocks,
  };
}

async function runSimulatedAgentLoop(opts: {
  goal: string;
  sessionId: string;
  agentKey: string;
  gatewayUrl: string;
  modelName: string;
  onStep?: (step: AgentStep) => void;
}): Promise<AgentRunResult> {
  const { goal, sessionId, agentKey, gatewayUrl, modelName, onStep } = opts;
  const steps: AgentStep[] = [];
  let totalBlocks = 0;
  let finalAnswer = "";

  const sendCall = async (
    stepIndex: number,
    tool: string,
    params: Record<string, any>,
  ) => {
    let wafResponse: any;
    try {
      const httpRes = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agent-key": agentKey,
          "x-request-id": `req_sim_${stepIndex}_${Date.now()}`,
        },
        body: JSON.stringify({ sessionId, tool, params }),
      });
      wafResponse = await httpRes.json();
    } catch (err: any) {
      wafResponse = {
        disposition: "ERROR",
        blockedReason: err.message,
        ruleResults: [],
      };
    }

    if (wafResponse.disposition === "BLOCKED") totalBlocks++;
    const step: AgentStep = {
      stepIndex,
      toolCall: { tool, params },
      wafResponse,
    };
    steps.push(step);
    if (onStep) onStep(step);
    return wafResponse;
  };

  // Determine intent from goal for simulation
  const lowerGoal = goal.toLowerCase();

  if (
    lowerGoal.includes("cust-2005") ||
    (lowerGoal.includes("cust-2") && lowerGoal.includes("fetch"))
  ) {
    // Data scope violation
    const res = await sendCall(1, "get_customer_record", {
      customerId: "CUST-2005",
    });
    finalAnswer = `I attempted to retrieve customer CUST-2005, but the operation was blocked by the Agent WAF security policy: "${res.blockedReason}". As Support Bot Alpha, my permissions are restricted to CUST-1xxx accounts.`;
  } else if (
    lowerGoal.includes("without manual inspection") ||
    lowerGoal.includes("immediately update") ||
    lowerGoal.includes("cust-1002")
  ) {
    // Sequence rule test & recovery
    const res1 = await sendCall(1, "update_customer_record", {
      customerId: "CUST-1002",
      fields: { balance: 88500 },
    });
    if (res1.disposition === "BLOCKED") {
      // Adapt: call get_customer_record first
      await sendCall(2, "get_customer_record", { customerId: "CUST-1002" });
      // Retry update
      const res3 = await sendCall(3, "update_customer_record", {
        customerId: "CUST-1002",
        fields: { balance: 88500 },
      });
      finalAnswer = `Initial direct update was blocked by the WAF sequence policy (${res1.blockedReason}). I adapted by inspecting the customer record first with get_customer_record, and then successfully updated CUST-1002's balance to 88,500.`;
    }
  } else if (
    lowerGoal.includes("drop table") ||
    lowerGoal.includes("select * from customers;")
  ) {
    // SQL Injection attempt
    const res = await sendCall(1, "execute_report_query", {
      sqlLike: "SELECT * FROM customers; DROP TABLE customers; --",
    });
    finalAnswer = `Query execution was denied by the Agent WAF policy: "${res.blockedReason}". Destructive database operations and concatenated SQL queries are strictly prohibited.`;
  } else if (
    lowerGoal.includes("redundant notification") ||
    lowerGoal.includes("extremely long")
  ) {
    // Size limit
    const res = await sendCall(1, "send_email", {
      to: "support@acme.corp",
      subject: "Urgent Alert",
      body: "This is an extremely long and redundant notification message that contains far more than one hundred characters of explanatory text designed to exceed the size limit.",
    });
    finalAnswer = `The email dispatch was blocked by the WAF parameter size limit policy (${res.blockedReason}). Please provide a concise summary within 100 characters.`;
  } else if (lowerGoal.includes("export") && lowerGoal.includes("4 times")) {
    // Rate limit
    for (let i = 1; i <= 4; i++) {
      await sendCall(i, "export_report", { dateRange: "last_30_days" });
    }
    finalAnswer = `Triggered bulk export requests. The first 3 export jobs succeeded, but call #4 was blocked by the WAF rate limit (maximum 3 exports per minute).`;
  } else {
    // Default legitimate flow
    await sendCall(1, "get_customer_record", { customerId: "CUST-1001" });
    await sendCall(2, "update_customer_record", {
      customerId: "CUST-1001",
      fields: { balance: 55000 },
    });
    await sendCall(3, "send_email", {
      to: "contact@acme.corp",
      subject: "Balance Update",
      body: "Your balance was updated to 55,000.",
    });
    finalAnswer = `Successfully inspected customer CUST-1001 (Acme Corp), updated account balance to 55,000, and sent confirmation email. All tool calls were verified and allowed by the Agent WAF.`;
  }

  const finalStep: AgentStep = {
    stepIndex: steps.length + 1,
    modelThought: finalAnswer,
  };
  steps.push(finalStep);
  if (onStep) onStep(finalStep);

  return {
    sessionId,
    goal,
    model: modelName,
    isRealGemini: false,
    finalAnswer,
    steps,
    totalSteps: steps.length,
    totalBlocks,
  };
}
