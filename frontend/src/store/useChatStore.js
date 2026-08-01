import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { userAuthStore } from "./userAuthStore";

const updateConversationUser = (users, targetUserId, conversationUpdate) => {
    const normalizedId = targetUserId?.toString();
    if (!normalizedId || !conversationUpdate) return users;

    const nextUsers = [...users];
    const existingIndex = nextUsers.findIndex((user) => user._id?.toString() === normalizedId);
    if (existingIndex === -1) return users;

    const existingUser = nextUsers[existingIndex];
    const nextUser = {
        ...existingUser,
        lastMessage: conversationUpdate.lastMessage ?? existingUser.lastMessage ?? null,
        lastMessageAt: conversationUpdate.lastMessageAt ?? existingUser.lastMessageAt ?? null,
        lastMessageBy: conversationUpdate.lastMessageBy ?? existingUser.lastMessageBy ?? null,
    };

    const [movedUser] = nextUsers.splice(existingIndex, 1);
    const reorderedUsers = [nextUser, ...nextUsers.filter((user) => user._id?.toString() !== normalizedId)];

    const currentTop = reorderedUsers[0];
    const currentTopTime = currentTop?.lastMessageAt ? new Date(currentTop.lastMessageAt).getTime() : 0;
    const targetTime = nextUser.lastMessageAt ? new Date(nextUser.lastMessageAt).getTime() : 0;

    if (currentTop?._id?.toString() === normalizedId && currentTopTime === targetTime) {
        return nextUsers.length === 0 ? [nextUser] : [nextUser, ...nextUsers];
    }

    return reorderedUsers.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
    });
};

export const useChatStore = create ((set,get) => ({
    messages: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    isLoadingOlderMessages: false,
    hasMoreMessages: true,
    searchResults: { users: [], chats: [], messages: [], groups: [] },
    isSearchLoading: false,

    getUsers: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await axiosInstance.get("/messages/users");
            const nextUsers = Array.isArray(res.data) ? res.data : [];
            set({ users: nextUsers });
        } catch(error) {
            toast.error(error.response?.data?.message || "Failed to load conversations");
        } finally {
            set({ isUsersLoading: false});
        }
    },

    getMessages: async (userId) => {
        set({ isMessagesLoading: true, messages: [], hasMoreMessages: true });
        try {
            const res = await axiosInstance.get(`/messages/${userId}`);
            set({ messages: res.data.messages || [], hasMoreMessages: res.data.hasMore });
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to load messages");
        } finally {
            set({ isMessagesLoading: false });
        }
    },

    loadOlderMessages: async (userId) => {
        const { messages, hasMoreMessages, isLoadingOlderMessages } = get();
        const oldestMessage = messages[0];
        if (!oldestMessage || !hasMoreMessages || isLoadingOlderMessages) return false;

        set({ isLoadingOlderMessages: true });
        try {
            const res = await axiosInstance.get(`/messages/${userId}?before=${oldestMessage._id}`);
            const olderMessages = res.data.messages || [];
            set((state) => ({
                messages: [...olderMessages, ...state.messages.filter((message) => !olderMessages.some((older) => older._id === message._id))],
                hasMoreMessages: res.data.hasMore,
            }));
            return olderMessages.length > 0;
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to load older messages");
            return false;
        } finally {
            set({ isLoadingOlderMessages: false });
        }
    },

    sendMessages: async (messageData) => {
        const { selectedUser, messages, users } = get();
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
            set({ messages: [...messages, res.data ]});

            const nextUsers = updateConversationUser(users, selectedUser._id, {
                lastMessage: res.data,
                lastMessageAt: res.data.createdAt,
                lastMessageBy: res.data.senderId,
            });
            set({ users: nextUsers });
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to send message");
        }
    },

    searchMessages: async (query) => {
        if (!query?.trim()) {
            set({ searchResults: { users: [], chats: [], messages: [], groups: [] } });
            return;
        }

        set({ isSearchLoading: true });
        try {
            const res = await axiosInstance.get(`/messages/search?q=${encodeURIComponent(query)}`);
            set({ searchResults: res.data });
        } catch (error) {
            toast.error(error.response?.data?.message || "Search failed");
        } finally {
            set({ isSearchLoading: false });
        }
    },

    subscribeToMessages: () => {
        const socket = userAuthStore.getState().socket;
        if (!socket) return;

        socket.off("newMessage");
        socket.off("conversationUpdated");

        socket.on("newMessage", (newMessage) => {
            const { selectedUser, messages, users } = get();
            const isMessageFromSelectedConversation = selectedUser && (newMessage.senderId === selectedUser._id || newMessage.receiverId === selectedUser._id);
            if (isMessageFromSelectedConversation) {
                set({ messages: [...messages, newMessage] });
            }

            const otherUserId = newMessage.senderId?.toString() === userAuthStore.getState().authUser?._id?.toString()
                ? newMessage.receiverId?.toString()
                : newMessage.senderId?.toString();
            if (!otherUserId) return;

            const nextUsers = updateConversationUser(users, otherUserId, {
                lastMessage: newMessage,
                lastMessageAt: newMessage.createdAt || newMessage.updatedAt,
                lastMessageBy: newMessage.senderId,
            });
            set({ users: nextUsers });
        });

        socket.on("conversationUpdated", (payload) => {
            const { users, selectedUser } = get();
            const targetUserId = payload?.user?._id?.toString();
            if (!targetUserId) return;

            const nextUsers = updateConversationUser(users, targetUserId, {
                lastMessage: payload.message,
                lastMessageAt: payload.lastMessageAt,
                lastMessageBy: payload.lastMessageBy,
            });
            set({ users: nextUsers });

            if (selectedUser?._id?.toString() === targetUserId) {
                set((state) => ({
                    selectedUser: state.selectedUser ? { ...state.selectedUser, lastMessage: payload.message, lastMessageAt: payload.lastMessageAt, lastMessageBy: payload.lastMessageBy } : state.selectedUser,
                }));
            }
        });
    },

    unsubscribeFromMessages: () => {
        const socket = userAuthStore.getState().socket;
        socket?.off("newMessage");
        socket?.off("conversationUpdated");
    },

    setSelectedUser: (selectedUser) => set({ selectedUser }),
}))
