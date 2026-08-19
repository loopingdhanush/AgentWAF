import { Router } from "express";
import { z } from "zod";
import { runAgentGoal } from "../agent/runner.js";
import { logger } from "../lib/logger.js";

export const agentRunRouter = Router();

const AgentRunRequestSchema = z.object({
  goal: z.string().min(1),
  sessionId: z.string().optional(),
});

agentRunRouter.post("/agent-run", async (req, res): Promise<void> => {
  const parseResult = AgentRunRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "Invalid request payload",
      details: parseResult.error.errors,
    });
    return;
  }

  const { goal, sessionId } = parseResult.data;

  try {
    const outcome = await runAgentGoal({
      goal,
      sessionId,
    });

    res.status(200).json(outcome);
  } catch (err: any) {
    logger.error({ err, goal }, "Agent run error");
    res.status(500).json({
      error: err.message || "Failed to execute agent run",
    });
  }
});
