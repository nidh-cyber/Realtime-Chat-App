import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import { getRedis } from "../lib/redis.js";

const insuranceLimiter = new RateLimiterMemory({ points: 60, duration: 60 });
let redisLimiter = null;
const socketLimiters = new Map();

const getLimiter = () => {
  const redis = getRedis();
  if (!redis) return insuranceLimiter;
  if (!redisLimiter) {
    redisLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "chat:rate:http",
      points: 60,
      duration: 60,
      insuranceLimiter,
    });
  }
  return redisLimiter;
};

export const apiRateLimit = async (req, res, next) => {
  try {
    await getLimiter().consume(req.user?._id?.toString() || req.ip);
    next();
  } catch (result) {
    const retryAfter = Math.ceil((result.msBeforeNext || 1_000) / 1_000);
    res.set("Retry-After", retryAfter);
    res.status(429).json({ message: "Too many requests. Please try again shortly." });
  }
};

export const consumeSocketRateLimit = async (userId, event) => {
  const redis = getRedis();
  const limiterKey = `${redis ? "redis" : "memory"}:${event}`;
  let limiter = socketLimiters.get(limiterKey);
  if (!limiter) {
    const fallback = new RateLimiterMemory({ points: 20, duration: 10 });
    limiter = redis
      ? new RateLimiterRedis({ storeClient: redis, keyPrefix: `chat:rate:socket:${event}`, points: 20, duration: 10, insuranceLimiter: fallback })
      : fallback;
    socketLimiters.set(limiterKey, limiter);
  }
  await limiter.consume(userId);
};
