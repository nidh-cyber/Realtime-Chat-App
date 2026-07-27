import mongoose from "mongoose";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import Message from "../models/message.model.js";

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        await Promise.all([
            User.collection.createIndex({ fullName: "text", email: "text" }),
            Group.collection.createIndex({ name: "text" }),
            Message.collection.createIndex({ text: "text", message: "text" }),
        ]);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.log("MongoDB connection error: ", error);
    }
};