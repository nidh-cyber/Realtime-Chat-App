import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { userAuthStore } from "./userAuthStore";

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
            // const res = await axiosInstance.get("/messages/users");
            const res = await axiosInstance.get("/messages/users");
            set({ users: res.data});
        } catch(error) {
            toast.error(error.response.data.message);
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
        const { selectedUser, messages} = get();
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
            set({ messages: [...messages, res.data ]});
        } catch (error) {
            toast.error(error.response.data.message);
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
        const { selectedUser } = get();
        if( !selectedUser ) return;

        const socket = userAuthStore.getState().socket;

        socket.on("newMessage", (newMessage) => {
            const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
            if(!isMessageSentFromSelectedUser) return;
            set({
                messages: [...get().messages, newMessage],
            });
        });
    },

       unsubscribeFromMessages: () => {
        const socket = userAuthStore.getState().socket;
        socket.off("newMessage");
    },

    setSelectedUser: (selectedUser) => set({ selectedUser }),
}))
