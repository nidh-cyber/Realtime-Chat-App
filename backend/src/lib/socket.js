import { Server } from "socket.io";
import http from "http";
import express from "express";
import {
  cacheKey,
  getRedis,
  getRedisSubscriber,
  initRedis,
  instanceId,
  redisAvailable,
} from "./redis.js";
import { consumeSocketRateLimit } from "../middleware/rateLimit.middleware.js";

const app = express();
const server = http.createServer(app);
const REALTIME_CHANNEL = "chat:realtime";
const PRESENCE_TTL_SECONDS = 90;

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

const localUserSockets = new Map();

const emitLocally = ({ scope, target, event, payload, excludeSocketId }) => {
  if (scope === "user") {
    for (const socketId of localUserSockets.get(target) || []) {
      if (socketId !== excludeSocketId) io.to(socketId).emit(event, payload);
    }
    return;
  }

  if (scope === "room") {
    const audience = io.to(target);
    if (excludeSocketId) audience.except(excludeSocketId).emit(event, payload);
    else audience.emit(event, payload);
    return;
  }

  io.emit(event, payload);
};

const publishRealtime = async (message) => {
  const redis = getRedis();
  if (!redis) return;
  await redis.publish(REALTIME_CHANNEL, JSON.stringify({ ...message, source: instanceId })).catch((error) => {
    console.warn("Realtime publish failed:", error.message);
  });
};

const emitRealtime = (scope, target, event, payload, excludeSocketId) => {
  const message = { scope, target, event, payload, excludeSocketId };
  emitLocally(message);
  void publishRealtime(message);
};

export const emitToUser = (userId, event, payload) => emitRealtime("user", userId.toString(), event, payload);
export const emitToRoom = (roomId, event, payload, excludeSocketId) => emitRealtime("room", roomId.toString(), event, payload, excludeSocketId);
export const emitToAll = (event, payload) => emitRealtime("all", null, event, payload);

// Kept for callers that only need to know whether this process owns a socket.
export function getReceiverSocketId(userId) {
  return [...(localUserSockets.get(userId.toString()) || [])][0];
}

const presenceKey = (userId) => cacheKey("presence", "user", userId);

const addPresence = async (userId, socketId) => {
  const redis = getRedis();
  if (!redis) return;
  await redis.multi()
    .sadd(presenceKey(userId), socketId)
    .expire(presenceKey(userId), PRESENCE_TTL_SECONDS)
    .set(cacheKey("socket", socketId), userId, "EX", PRESENCE_TTL_SECONDS)
    .sadd(cacheKey("presence", "users"), userId)
    .exec();
};

const removePresence = async (userId, socketId) => {
  const redis = getRedis();
  if (!redis) return;
  await redis.srem(presenceKey(userId), socketId);
  await redis.del(cacheKey("socket", socketId));
  if (await redis.scard(presenceKey(userId)) === 0) {
    await redis.srem(cacheKey("presence", "users"), userId);
  }
};

const refreshLocalPresence = async () => {
  if (!redisAvailable()) return;
  await Promise.all(
    [...localUserSockets.entries()].flatMap(([userId, socketIds]) =>
      [...socketIds].map((socketId) => addPresence(userId, socketId))
    )
  );
};

const broadcastOnlineUsers = async () => {
  const redis = getRedis();
  const users = redis
    ? await redis.smembers(cacheKey("presence", "users"))
    : [...localUserSockets.keys()];
  emitToAll("getOnlineUsers", users);
};

export const initializeSocketRedis = async () => {
  if (!await initRedis()) return;
  const subscriber = getRedisSubscriber();
  await subscriber.subscribe(REALTIME_CHANNEL);
  subscriber.on("message", (channel, rawMessage) => {
    if (channel !== REALTIME_CHANNEL) return;
    try {
      const message = JSON.parse(rawMessage);
      if (message.source !== instanceId) emitLocally(message);
    } catch (error) {
      console.warn("Invalid realtime message:", error.message);
    }
  });
  setInterval(() => { void refreshLocalPresence(); }, 30_000).unref();
};

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId?.toString();
  if (!userId) return socket.disconnect(true);

  const sockets = localUserSockets.get(userId) || new Set();
  sockets.add(socket.id);
  localUserSockets.set(userId, sockets);
  void addPresence(userId, socket.id).catch(() => {}).finally(broadcastOnlineUsers);

  socket.on("joinGroup", async ({ groupId } = {}) => {
    if (!groupId) return;
    try {
      await consumeSocketRateLimit(userId, "joinGroup");
      socket.join(groupId);
    } catch {
      socket.emit("rateLimitExceeded", { event: "joinGroup" });
    }
  });

  socket.on("leaveGroup", ({ groupId } = {}) => {
    if (groupId) socket.leave(groupId);
  });

  socket.on("groupTyping", async ({ groupId, user, isTyping } = {}) => {
    if (!groupId || !user) return;
    try {
      await consumeSocketRateLimit(userId, "groupTyping");
      // The client already debounces this event; Redis additionally shares it across instances.
      emitToRoom(groupId, "groupTyping", { groupId, user, isTyping: Boolean(isTyping) }, socket.id);
    } catch {
      socket.emit("rateLimitExceeded", { event: "groupTyping" });
    }
  });

  socket.on("disconnect", () => {
    const userSockets = localUserSockets.get(userId);
    userSockets?.delete(socket.id);
    if (!userSockets?.size) localUserSockets.delete(userId);
    void removePresence(userId, socket.id).catch(() => {}).finally(broadcastOnlineUsers);
  });
});

export { io, app, server };
