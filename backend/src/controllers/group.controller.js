import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io } from "../lib/socket.js";
import { HttpError } from "../lib/errorHandler.js";

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

    res.status(201).json({ group: populatedGroup });
  } catch (error) {
    next(error);
  }
};

export const getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate("members", "fullName profilePic email")
      .populate("admins", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic email")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.status(200).json(groups);
  } catch (error) {
    next(error);
  }
};

export const getGroupById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id)
      .populate("members", "fullName profilePic email")
      .populate("admins", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic email");

    if (!group) {
      throw new HttpError(404, "Group not found");
    }

    ensureMember(group, req.user._id);

    const messages = await Message.find({ groupId: group._id }).sort({ createdAt: 1 });

    res.status(200).json({ group, messages });
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

    io.to(group._id.toString()).emit("groupDeleted", { groupId: group._id.toString() });

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

    group.members = [...existingMembers, ...newMembers];
    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate("members", "fullName profilePic email")
      .populate("admins", "fullName profilePic email")
      .populate("createdBy", "fullName profilePic email");

    const addedUsers = await User.find({ _id: { $in: newMembers } }).select("fullName profilePic email");

    io.to(group._id.toString()).emit("groupUserJoined", {
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

    io.to(group._id.toString()).emit("groupUserLeft", {
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
    group.members = group.members.filter((member) => toObjectId(member) !== userId);
    group.admins = group.admins.filter((admin) => toObjectId(admin) !== userId);

    if (!group.members.length) {
      await Message.deleteMany({ groupId: group._id });
      await Group.findByIdAndDelete(group._id);
      io.to(group._id.toString()).emit("groupDeleted", { groupId: group._id.toString() });
      return res.status(200).json({ message: "Group deleted because no members remain" });
    }

    if (!group.admins.length) {
      group.admins = [group.members[0]];
    }

    await group.save();

    io.to(group._id.toString()).emit("groupUserLeft", {
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

    group.lastMessage = newMessage._id;
    await group.save();

    const populatedMessage = await Message.findById(newMessage._id).populate("sender", "fullName profilePic email");

    io.to(group._id.toString()).emit("groupMessage", populatedMessage);

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

    await Message.updateMany(
      {
        groupId: group._id,
        seenBy: { $ne: req.user._id },
      },
      {
        $addToSet: { seenBy: req.user._id },
      }
    );

    const messages = await Message.find({ groupId: group._id }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};
