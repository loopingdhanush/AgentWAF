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

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the environment. Please add it to apps/backend/.env");
  }

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
      const toolName = fCall.name || "unknown";
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


