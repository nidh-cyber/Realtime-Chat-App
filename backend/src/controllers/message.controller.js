import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { emitToUser } from "../lib/socket.js";
import { HttpError } from "../lib/errorHandler.js";
import { clearUnread, incrementUnread } from "../lib/chatState.js";

export const getUsersForSidebar = async (req, res, next) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    await clearUnread(myId, userToChatId);
    res.status(200).json(messages);
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

    emitToUser(receiverId, "newMessage", newMessage);
    await incrementUnread(receiverId, senderId);

    res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};
