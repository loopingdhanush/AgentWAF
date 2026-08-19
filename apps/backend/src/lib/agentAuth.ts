import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./prisma.js";

export interface GeneratedApiKey {
  rawKey: string;
  prefix: string;
  hash: string;
}

export async function generateApiKey(): Promise<GeneratedApiKey> {
  const randomPart = crypto.randomBytes(24).toString("hex");
  const rawKey = `agnt_${randomPart}`;
  const prefix = rawKey.substring(0, 8); // e.g. "agnt_abc"
  const hash = await bcrypt.hash(rawKey, 10);

  return { rawKey, prefix, hash };
}

export async function authenticateAgentKey(rawKey: string | undefined) {
  if (!rawKey || typeof rawKey !== "string" || !rawKey.startsWith("agnt_")) {
    return null;
  }

  const prefix = rawKey.substring(0, 8);
  const candidates = await prisma.agent.findMany({
    where: { apiKeyPrefix: prefix },
  });

  for (const agent of candidates) {
    const isMatch = await bcrypt.compare(rawKey, agent.apiKeyHash);
    if (isMatch) {
      return agent;
    }
  }

  return null;
}
