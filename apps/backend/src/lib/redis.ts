import { Redis } from "ioredis";
import "dotenv/config";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  lazyConnect: false,
});

export const redisPub = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

export const redisSub = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on("error", (err) => {
  console.error("Redis Client Error:", err.message);
});

export const REDIS_CHANNELS = {
  TOOL_EVENTS: "tool-events",
} as const;
