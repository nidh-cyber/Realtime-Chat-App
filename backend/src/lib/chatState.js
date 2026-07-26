import { cacheKey, deleteCache, getRedis } from "./redis.js";
import { emitToUser } from "./socket.js";

export const groupListCacheKey = (userId) => cacheKey("cache", "groups", userId.toString());
export const groupDetailCacheKey = (groupId, userId) => cacheKey("cache", "group", groupId.toString(), userId.toString());

export const invalidateGroupCaches = async (group) => {
  const groupId = group._id?.toString() || group.toString();
  const memberIds = (group.members || []).map((member) => (member._id || member).toString());
  await deleteCache(
    ...memberIds.flatMap((userId) => [groupListCacheKey(userId), groupDetailCacheKey(groupId, userId)])
  );
};

export const incrementUnread = async (userId, conversationId) => {
  const redis = getRedis();
  if (!redis) return;
  try {
    const count = await redis.hincrby(cacheKey("unread", userId.toString()), conversationId.toString(), 1);
    emitToUser(userId, "unreadCount", { conversationId: conversationId.toString(), count: Number(count) });
  } catch (error) {
    console.warn("Unread counter update failed:", error.message);
  }
};

export const clearUnread = async (userId, conversationId) => {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.hdel(cacheKey("unread", userId.toString()), conversationId.toString());
    emitToUser(userId, "unreadCount", { conversationId: conversationId.toString(), count: 0 });
  } catch (error) {
    console.warn("Unread counter clear failed:", error.message);
  }
};

export const getUnreadCounts = async (userId) => {
  const redis = getRedis();
  if (!redis) return {};
  const counts = await redis.hgetall(cacheKey("unread", userId.toString()));
  return Object.fromEntries(Object.entries(counts).map(([id, count]) => [id, Number(count)]));
};
