import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { emitToRoom } from "../lib/socket.js";
import { HttpError } from "../lib/errorHandler.js";
import { clearUnread, incrementUnread, invalidateGroupCaches } from "../lib/chatState.js";
import { cacheKey, getCachedJson, setCachedJson, withDistributedLock } from "../lib/redis.js";

const MESSAGE_PAGE_SIZE = 30;

const getMessagePage = async (filter, before) => {
  const cursorFilter = before ? { _id: { $lt: before } } : {};
  const results = await Message.find({ ...filter, ...cursorFilter })
    .sort({ _id: -1 })
    .limit(MESSAGE_PAGE_SIZE + 1);

  const hasMore = results.length > MESSAGE_PAGE_SIZE;
  const messages = results.slice(0, MESSAGE_PAGE_SIZE).reverse();

  return {
    messages,
    hasMore,
    nextCursor: messages[0]?._id?.toString() || null,
  };
};

const toObjectId = (value) => {
  if (!value) return null;

  if (typeof value === "object") {
    if (value._id) return value._id.toString();
    if (value.toString && value.toString !== Object.prototype.toString) return value.toString();
    return null;
  }

  return value.toString();
};

const buildGroupPayload = (group) => ({
  _id: group._id,
  name: group.name,
  avatar: group.avatar,
  members: group.members,
  admins: group.admins,
  createdBy: group.createdBy,
  lastMessage: group.lastMessage,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

const ensureMember = (group, userId) => {
  const memberIds = (group.members || []).map((member) => toObjectId(member));
  if (!memberIds.includes(toObjectId(userId))) {
    throw new HttpError(403, "You are not a member of this group");
  }
};

const ensureAdmin = (group, userId) => {
  const adminIds = (group.admins || []).map((admin) => toObjectId(admin));
  if (!adminIds.includes(toObjectId(userId))) {
    throw new HttpError(403, "Only admins can perform this action");
  }
};

const normalizeMembers = (members = []) => {
  const uniqueMembers = [...new Set(members.map((member) => member.toString()))];
  return uniqueMembers;
};

export const createGroup = async (req, res, next) => {
  try {
    const { name, members = [], avatar } = req.body;

    if (!name?.trim()) {
      throw new HttpError(400, "Group name is required");
    }

    const normalizedMembers = normalizeMembers([req.user._id, ...members]);

    if (normalizedMembers.length < 2) {
      throw new HttpError(400, "A group must have at least two members");
    }

    let avatarUrl = "";
    if (avatar) {
      const uploadResponse = await cloudinary.uploader.upload(avatar);
      avatarUrl = uploadResponse.secure_url;
    }

    const group = await Group.create({
      name: name.trim(),
      avatar: avatarUrl,
      members: normalizedMembers,
      admins: [req.user._id],
      createdBy: req.user._id,
    });

    const populatedGroup = await Group.findById(group._id)
      .populate("members", "fullName profilePic email")
      .populate("admins", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic email");

    await invalidateGroupCaches(populatedGroup);
    res.status(201).json({ group: populatedGroup });
  } catch (error) {
    next(error);
  }
};

export const getGroups = async (req, res, next) => {
  try {
    const cachedGroups = await getCachedJson(cacheKey("cache", "groups", req.user._id.toString()));
    if (cachedGroups) return res.status(200).json(cachedGroups);

    const groups = await Group.find({ members: req.user._id })
      .populate("members", "fullName profilePic email")
      .populate("admins", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic email")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    await setCachedJson(cacheKey("cache", "groups", req.user._id.toString()), groups, 60);
    res.status(200).json(groups);
  } catch (error) {
    next(error);
  }
};

export const getGroupById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { before } = req.query;
    if (before && !/^[a-f\d]{24}$/i.test(before)) {
      throw new HttpError(400, "Invalid message cursor");
    }
    const group = await Group.findById(id)
      .populate("members", "fullName profilePic email")
      .populate("admins", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic email");

    if (!group) {
      throw new HttpError(404, "Group not found");
    }

    ensureMember(group, req.user._id);

    const page = await getMessagePage({ groupId: group._id }, before);
    res.status(200).json({ group, ...page });
  } catch (error) {
    next(error);
  }
};

export const updateGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, avatar } = req.body;

    const group = await Group.findById(id);
    if (!group) {
      throw new HttpError(404, "Group not found");
    }

    ensureMember(group, req.user._id);
    ensureAdmin(group, req.user._id);

    if (!name?.trim() && !avatar) {
      throw new HttpError(400, "At least one field is required");
    }

    const updates = {};
    if (name?.trim()) updates.name = name.trim();
    if (avatar) {
      const uploadResponse = await cloudinary.uploader.upload(avatar);
      updates.avatar = uploadResponse.secure_url;
    }

    const updatedGroup = await Group.findByIdAndUpdate(id, updates, { new: true })
      .populate("members", "fullName profilePic email")
      .populate("admins", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic email");

    await invalidateGroupCaches(updatedGroup);
    res.status(200).json({ group: updatedGroup });
  } catch (error) {
    next(error);
  }
};

export const deleteGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);

    if (!group) {
      throw new HttpError(404, "Group not found");
    }

    ensureMember(group, req.user._id);
    ensureAdmin(group, req.user._id);

    await Message.deleteMany({ groupId: group._id });
    await Group.findByIdAndDelete(group._id);

    await invalidateGroupCaches(group);
    emitToRoom(group._id, "groupDeleted", { groupId: group._id.toString() });

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const addMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { members = [] } = req.body;

    const group = await Group.findById(id);
    if (!group) {
      throw new HttpError(404, "Group not found");
    }

    ensureMember(group, req.user._id);
    ensureAdmin(group, req.user._id);

    if (!members.length) {
      throw new HttpError(400, "At least one member is required");
    }

    const normalizedMembers = normalizeMembers(members);
    const existingMembers = group.members.map((member) => member.toString());
    const newMembers = normalizedMembers.filter((member) => !existingMembers.includes(member));

    if (!newMembers.length) {
      throw new HttpError(400, "These members are already part of the group");
    }

    await invalidateGroupCaches(group);
    group.members = [...existingMembers, ...newMembers];
    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate("members", "fullName profilePic email")
      .populate("admins", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic email");

    const addedUsers = await User.find({ _id: { $in: newMembers } }).select("fullName profilePic email");

    await invalidateGroupCaches(populatedGroup);
    emitToRoom(group._id, "groupUserJoined", {
      groupId: group._id.toString(),
      members: addedUsers,
    });

    res.status(200).json({ group: populatedGroup, addedUsers });
  } catch (error) {
    next(error);
  }
};

export const removeMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      throw new HttpError(404, "Group not found");
    }

    ensureMember(group, req.user._id);
    ensureAdmin(group, req.user._id);

    if (toObjectId(userId) === toObjectId(req.user._id)) {
      throw new HttpError(400, "Use the leave group option to remove yourself");
    }

    await invalidateGroupCaches(group);
    const memberId = userId.toString();
    group.members = group.members.filter((member) => toObjectId(member) !== memberId);
    group.admins = group.admins.filter((admin) => toObjectId(admin) !== memberId);

    if (!group.admins.length) {
      group.admins = [group.members[0] || req.user._id];
    }

    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate("members", "fullName profilePic email")
      .populate("admins", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic email");

    await invalidateGroupCaches(group);
    emitToRoom(group._id, "groupUserLeft", {
      groupId: group._id.toString(),
      userId: memberId,
    });

    res.status(200).json({ group: populatedGroup });
  } catch (error) {
    next(error);
  }
};

export const leaveGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);

    if (!group) {
      throw new HttpError(404, "Group not found");
    }

    ensureMember(group, req.user._id);

    const userId = req.user._id.toString();
    await invalidateGroupCaches(group);
    group.members = group.members.filter((member) => toObjectId(member) !== userId);
    group.admins = group.admins.filter((admin) => toObjectId(admin) !== userId);

    if (!group.members.length) {
      await Message.deleteMany({ groupId: group._id });
      await Group.findByIdAndDelete(group._id);
      await invalidateGroupCaches(group);
      emitToRoom(group._id, "groupDeleted", { groupId: group._id.toString() });
      return res.status(200).json({ message: "Group deleted because no members remain" });
    }

    if (!group.admins.length) {
      group.admins = [group.members[0]];
    }

    await group.save();

    await invalidateGroupCaches(group);
    emitToRoom(group._id, "groupUserLeft", {
      groupId: group._id.toString(),
      userId,
    });

    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    next(error);
  }
};

export const transferAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const group = await Group.findById(id);
    if (!group) {
      throw new HttpError(404, "Group not found");
    }

    ensureMember(group, req.user._id);
    ensureAdmin(group, req.user._id);

    if (!userId) {
      throw new HttpError(400, "A member is required");
    }

    if (!group.members.some((member) => toObjectId(member) === toObjectId(userId))) {
      throw new HttpError(404, "Member not found in group");
    }

    const nextAdmins = (group.admins || []).filter((admin) => toObjectId(admin) !== toObjectId(req.user._id));
    nextAdmins.push(userId);
    group.admins = [...new Set(nextAdmins)];

    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate("members", "fullName profilePic email")
      .populate("admins", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic email");

    await invalidateGroupCaches(populatedGroup);
    res.status(200).json({ group: populatedGroup });
  } catch (error) {
    next(error);
  }
};

export const sendGroupMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, text, image, attachments = [] } = req.body;

    const group = await Group.findById(id);
    if (!group) {
      throw new HttpError(404, "Group not found");
    }

    ensureMember(group, req.user._id);

    const content = message || text || "";
    if (!content?.trim() && !image && !attachments.length) {
      throw new HttpError(400, "Message content is required");
    }

    let imageUrl = "";
    let attachmentUrls = attachments;

    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
      attachmentUrls = [...attachmentUrls, imageUrl];
    }

    const newMessage = await Message.create({
      sender: req.user._id,
      senderId: req.user._id,
      groupId: group._id,
      message: content.trim(),
      text: content.trim(),
      image: imageUrl,
      attachments: attachmentUrls,
      seenBy: [req.user._id],
    });

    await withDistributedLock(`group-last-message:${group._id}`, async () => {
      group.lastMessage = newMessage._id;
      await group.save();
    });

    const populatedMessage = await Message.findById(newMessage._id).populate("sender", "fullName profilePic email");

    await invalidateGroupCaches(group);
    emitToRoom(group._id, "groupMessage", populatedMessage);
    await Promise.all(
      group.members
        .filter((member) => toObjectId(member) !== toObjectId(req.user._id))
        .map((member) => incrementUnread(member, group._id))
    );

    res.status(201).json(populatedMessage);
  } catch (error) {
    next(error);
  }
};

export const markGroupMessagesSeen = async (req, res, next) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);

    if (!group) {
      throw new HttpError(404, "Group not found");
    }

    ensureMember(group, req.user._id);

    await withDistributedLock(`group-seen:${group._id}:${req.user._id}`, async () => {
      await Message.updateMany(
        {
          groupId: group._id,
          seenBy: { $ne: req.user._id },
        },
        {
          $addToSet: { seenBy: req.user._id },
        }
      );
      await clearUnread(req.user._id, group._id);
    });
    await invalidateGroupCaches(group);

    const messages = await Message.find({ groupId: group._id }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};
