import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";

const MAX_RESULTS = 12;

const normalizeQuery = (value) => (value || "").trim();
const toId = (value) => value?.toString();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildUserPayload = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  profilePic: user.profilePic,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

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

const buildMessagePayload = (message) => ({
  _id: message._id,
  text: message.text || message.message || "",
  message: message.message || message.text || "",
  image: message.image || "",
  sender: message.sender,
  senderId: message.senderId,
  receiverId: message.receiverId,
  groupId: message.groupId?._id || message.groupId || null,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

export const searchEverything = async (req, res, next) => {
  try {
    const query = normalizeQuery(req.query.q || req.query.query || "");
    if (!query) {
      return res.status(200).json({ users: [], chats: [], messages: [], groups: [] });
    }

    const userId = toId(req.user._id);
    const escapedQuery = escapeRegex(query);
    const accessibleGroupIds = (await Group.find({ members: req.user._id }).select("_id")).map((group) => group._id);

    const [textUsers, textGroups, textMessages] = await Promise.all([
      User.find({
        _id: { $ne: req.user._id },
        $text: { $search: query },
      })
        .select("-password")
        .sort({ score: { $meta: "textScore" } })
        .limit(MAX_RESULTS),

      Group.find({
        members: req.user._id,
        $text: { $search: query },
      })
        .populate("members", "fullName profilePic email")
        .populate("admins", "fullName profilePic email")
        .populate("createdBy", "fullName profilePic email")
        .sort({ score: { $meta: "textScore" } })
        .limit(MAX_RESULTS),

      Message.find({
        $or: [
          { senderId: req.user._id },
          { receiverId: req.user._id },
          { groupId: { $in: accessibleGroupIds } },
        ],
        $text: { $search: query },
      })
        .populate("sender", "fullName profilePic email")
        .populate("groupId", "name avatar")
        .sort({ score: { $meta: "textScore" } })
        .limit(MAX_RESULTS),
    ]);

    const users = textUsers.length
      ? textUsers
      : await User.find({
          _id: { $ne: req.user._id },
          $or: [
            { fullName: { $regex: escapedQuery, $options: "i" } },
            { email: { $regex: escapedQuery, $options: "i" } },
          ],
        })
          .select("-password")
          .limit(MAX_RESULTS);

    const groups = textGroups.length
      ? textGroups
      : await Group.find({
          members: req.user._id,
          $or: [{ name: { $regex: escapedQuery, $options: "i" } }],
        })
          .populate("members", "fullName profilePic email")
          .populate("admins", "fullName profilePic email")
          .populate("createdBy", "fullName profilePic email")
          .limit(MAX_RESULTS);

    const messages = textMessages.length
      ? textMessages
      : await Message.find({
          $or: [
            { senderId: req.user._id },
            { receiverId: req.user._id },
            { groupId: { $in: accessibleGroupIds } },
          ],
          $or: [
            { text: { $regex: escapedQuery, $options: "i" } },
            { message: { $regex: escapedQuery, $options: "i" } },
          ],
        })
          .populate("sender", "fullName profilePic email")
          .populate("groupId", "name avatar")
          .limit(MAX_RESULTS);

    const directChats = users.slice(0, MAX_RESULTS).map((user) => ({
      type: "direct",
      user: buildUserPayload(user),
    }));

    const groupChats = groups.slice(0, MAX_RESULTS).map((group) => ({
      type: "group",
      group: buildGroupPayload(group),
    }));

    const messageResults = [];
    for (const message of messages) {
      const payload = {
        ...buildMessagePayload(message),
        conversationType: message.groupId ? "group" : "direct",
        conversationName: message.groupId
          ? message.groupId.name
          : message.sender?._id?.toString() === userId
            ? "You"
            : message.sender?.fullName || "Conversation",
      };

      if (message.groupId) {
        payload.conversationGroup = buildGroupPayload(message.groupId);
      } else {
        const participantId = message.senderId?.toString() === userId ? message.receiverId : message.senderId;
        if (participantId) {
          const participant = await User.findById(participantId).select("-password");
          if (participant) payload.conversationUser = buildUserPayload(participant);
        }
      }

      messageResults.push(payload);
    }

    res.status(200).json({
      users: users.map(buildUserPayload),
      chats: [...directChats, ...groupChats],
      messages: messageResults,
      groups: groups.map(buildGroupPayload),
    });
  } catch (error) {
    next(error);
  }
};
