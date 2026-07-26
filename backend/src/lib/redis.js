import Redis from "ioredis";
import crypto from "crypto";

const INSTANCE_ID = process.env.INSTANCE_ID || crypto.randomUUID();
const CACHE_PREFIX = "chat:";

let redis = null;
let subscriber = null;
let available = false;

const createClient = (url) => new Redis(url, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: null,
  retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
});

export const initRedis = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || redis) return available;

  redis = createClient(redisUrl);
  subscriber = createClient(redisUrl);
  redis.on("ready", () => { available = true; });
  redis.on("error", (error) => console.warn("Redis unavailable:", error.message));
  subscriber.on("error", (error) => console.warn("Redis subscriber unavailable:", error.message));

  try {
    await Promise.all([redis.connect(), subscriber.connect()]);
    available = true;
  } catch (error) {
    // The app still works on a single instance when Redis is not configured/reachable.
    console.warn("Starting without Redis:", error.message);
  }
  return available;
};

export const getRedis = () => (available ? redis : null);
export const getRedisSubscriber = () => (available ? subscriber : null);
export const redisAvailable = () => available;
export const instanceId = INSTANCE_ID;

export const cacheKey = (...parts) => `${CACHE_PREFIX}${parts.join(":")}`;

export const getCachedJson = async (key) => {
  const client = getRedis();
  if (!client) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn("Redis cache read failed:", error.message);
    return null;
  }
};

export const setCachedJson = async (key, value, ttlSeconds = 60) => {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.warn("Redis cache write failed:", error.message);
  }
};

export const deleteCache = async (...keys) => {
  const client = getRedis();
  if (!client || !keys.length) return;
  try {
    await client.del(...keys);
  } catch (error) {
    console.warn("Redis cache invalidation failed:", error.message);
  }
};

export const withDistributedLock = async (name, callback, ttlMs = 10_000) => {
  const client = getRedis();
  if (!client) return callback();

  const key = cacheKey("lock", name);
  const token = crypto.randomUUID();
  let acquired;
  try {
    acquired = await client.set(key, token, "PX", ttlMs, "NX");
  } catch (error) {
    console.warn("Redis lock unavailable:", error.message);
    return callback();
  }
  if (!acquired) {
    const error = new Error("This operation is already in progress");
    error.statusCode = 409;
    throw error;
  }

  try {
    return await callback();
  } finally {
    // Never delete a lock that has expired and been acquired by another request.
    await client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      token
    ).catch(() => {});
  }
};
