import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import cloudinary from "../lib/cloudinary.js";
import { emitToUser } from "../lib/socket.js";
import { HttpError } from "../lib/errorHandler.js";
import { clearUnread, incrementUnread } from "../lib/chatState.js";

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

export const getUsersForSidebar = async (req, res, next) => {
  try {
    const loggedInUserId = req.user._id;
    const users = await User.find({ _id: { $ne: loggedInUserId } }).select("-password").lean();

    const existingConversations = await Conversation.find({ participants: loggedInUserId })
      .populate({ path: "lastMessage", select: "text message image createdAt senderId" })
      .populate({ path: "participants", select: "_id fullName profilePic email" })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    const conversationMap = new Map();
    for (const conversation of existingConversations) {
      const otherParticipant = conversation.participants.find((participant) => participant._id.toString() !== loggedInUserId.toString());
      if (!otherParticipant) continue;
      conversationMap.set(otherParticipant._id.toString(), {
        ...otherParticipant,
        lastMessage: conversation.lastMessage || null,
        lastMessageAt: conversation.lastMessageAt || null,
        lastMessageBy: conversation.lastMessageBy || null,
        conversationId: conversation._id,
      });
    }

    if (existingConversations.length === 0) {
      const recentMessages = await Message.find({
        $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
      })
        .sort({ createdAt: -1 })
        .lean();

      for (const message of recentMessages) {
        const otherUserId = message.senderId.toString() === loggedInUserId.toString() ? message.receiverId : message.senderId;
        if (!otherUserId) continue;
        const participantIds = [loggedInUserId, otherUserId].sort((a, b) => a.toString().localeCompare(b.toString()));
        const existingConversation = await Conversation.findOne({ participants: { $all: participantIds, $size: 2 } });
        if (existingConversation) continue;
        await Conversation.create({
          participants: participantIds,
          lastMessage: message._id,
          lastMessageAt: message.createdAt,
          lastMessageBy: message.senderId,
        });
      }
    }

    const conversations = await Conversation.find({ participants: loggedInUserId })
      .populate({ path: "lastMessage", select: "text message image createdAt senderId" })
      .populate({ path: "participants", select: "_id fullName profilePic email" })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    for (const conversation of conversations) {
      const otherParticipant = conversation.participants.find((participant) => participant._id.toString() !== loggedInUserId.toString());
      if (!otherParticipant) continue;
      conversationMap.set(otherParticipant._id.toString(), {
        ...otherParticipant,
        lastMessage: conversation.lastMessage || null,
        lastMessageAt: conversation.lastMessageAt || null,
        lastMessageBy: conversation.lastMessageBy || null,
        conversationId: conversation._id,
      });
    }

    const sidebarUsers = users
      .map((user) => {
        const cached = conversationMap.get(user._id.toString());
        return cached ? { ...user, ...cached } : user;
      })
      .sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

    res.status(200).json(sidebarUsers);
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { id: userToChatId } = req.params;
    const { before } = req.query;
    const myId = req.user._id;

    if (before && !/^[a-f\d]{24}$/i.test(before)) {
      throw new HttpError(400, "Invalid message cursor");
    }

    const page = await getMessagePage({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }, before);

    await clearUnread(myId, userToChatId);
    res.status(200).json(page);
  } catch (error) {
    next(error);
  }
};

export const sendMessages = async (req, res, next) => {
  try {
    const { text, message, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    const content = message || text || "";
    if (!content.trim() && !image) {
      throw new HttpError(400, "Message content is required");
    }

    let imageUrl = "";
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      sender: senderId,
      senderId,
      receiverId,
      text: content.trim(),
      message: content.trim(),
      image: imageUrl,
      seenBy: [senderId],
    });

    await newMessage.save();

    const participantIds = [senderId, receiverId].sort((a, b) => a.toString().localeCompare(b.toString()));
    const existingConversation = await Conversation.findOne({
      participants: { $all: participantIds, $size: 2 },
    });

    if (existingConversation) {
      await Conversation.updateOne(
        { _id: existingConversation._id },
        {
          $set: {
            lastMessage: newMessage._id,
            lastMessageAt: newMessage.createdAt,
            lastMessageBy: senderId,
          },
        }
      );
    } else {
      await Conversation.create({
        participants: participantIds,
        lastMessage: newMessage._id,
        lastMessageAt: newMessage.createdAt,
        lastMessageBy: senderId,
      });
    }

    emitToUser(receiverId, "newMessage", newMessage);
    emitToUser(receiverId, "conversationUpdated", {
      conversationId: receiverId.toString(),
      user: { _id: senderId, fullName: req.user.fullName, profilePic: req.user.profilePic },
      message: newMessage,
      lastMessageAt: newMessage.createdAt,
      lastMessageBy: senderId,
    });
    emitToUser(senderId, "conversationUpdated", {
      conversationId: receiverId.toString(),
      user: { _id: receiverId },
      message: newMessage,
      lastMessageAt: newMessage.createdAt,
      lastMessageBy: senderId,
    });
    await incrementUnread(receiverId, senderId);

    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};
