import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { userAuthStore } from "./userAuthStore";

export const useGroupStore = create((set, get) => ({
  groups: [],
  selectedGroup: null,
  groupMessages: [],
  isGroupsLoading: false,
  isGroupMessagesLoading: false,
  typingUsers: [],
  groupUnreadCounts: {},

  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load groups");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  joinGroupRoom: (groupId) => {
    const socket = userAuthStore.getState().socket;
    if (socket && groupId) {
      socket.emit("joinGroup", { groupId });
    }
  },

  leaveGroupRoom: (groupId) => {
    const socket = userAuthStore.getState().socket;
    if (socket && groupId) {
      socket.emit("leaveGroup", { groupId });
    }
  },

  setSelectedGroup: (group) => {
    const previousGroupId = get().selectedGroup?._id;
    if (previousGroupId && previousGroupId !== group?._id) {
      get().leaveGroupRoom(previousGroupId);
    }

    set({ selectedGroup: group });
    if (group?._id) {
      get().joinGroupRoom(group._id);
      get().clearGroupUnread(group._id);
    }
  },

  fetchGroupDetails: async (groupId) => {
    if (!groupId) return;
    set({ isGroupMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}`);
      set({ groupMessages: res.data.messages || [], selectedGroup: res.data.group });
      get().clearGroupUnread(groupId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load group details");
    } finally {
      set({ isGroupMessagesLoading: false });
    }
  },

  createGroup: async (payload) => {
    try {
      const res = await axiosInstance.post("/groups", payload);
      const nextGroup = res.data.group;
      set((state) => ({ groups: [nextGroup, ...state.groups] }));
      toast.success("Group created successfully");
      return nextGroup;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
      return null;
    }
  },

  updateGroup: async (groupId, payload) => {
    try {
      const res = await axiosInstance.patch(`/groups/${groupId}`, payload);
      const updatedGroup = res.data.group;
      set((state) => ({
        groups: state.groups.map((group) => (group._id === updatedGroup._id ? updatedGroup : group)),
        selectedGroup: state.selectedGroup?._id === updatedGroup._id ? updatedGroup : state.selectedGroup,
      }));
      toast.success("Group updated successfully");
      return updatedGroup;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group");
      return null;
    }
  },

  deleteGroup: async (groupId) => {
    try {
      await axiosInstance.delete(`/groups/${groupId}`);
      get().leaveGroupRoom(groupId);
      set((state) => ({
        groups: state.groups.filter((group) => group._id !== groupId),
        selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
        groupMessages: state.selectedGroup?._id === groupId ? [] : state.groupMessages,
      }));
      toast.success("Group deleted successfully");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete group");
      return false;
    }
  },

  addMembers: async (groupId, members) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/members`, { members });
      const updatedGroup = res.data.group;
      set((state) => ({
        groups: state.groups.map((group) => (group._id === updatedGroup._id ? updatedGroup : group)),
        selectedGroup: state.selectedGroup?._id === updatedGroup._id ? updatedGroup : state.selectedGroup,
      }));
      toast.success("Members added successfully");
      return updatedGroup;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add members");
      return null;
    }
  },

  removeMember: async (groupId, userId) => {
    try {
      const res = await axiosInstance.delete(`/groups/${groupId}/members/${userId}`);
      const updatedGroup = res.data.group;
      set((state) => ({
        groups: state.groups.map((group) => (group._id === updatedGroup._id ? updatedGroup : group)),
        selectedGroup: state.selectedGroup?._id === updatedGroup._id ? updatedGroup : state.selectedGroup,
      }));
      toast.success("Member removed successfully");
      return updatedGroup;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove member");
      return null;
    }
  },

  leaveGroup: async (groupId) => {
    try {
      await axiosInstance.post(`/groups/${groupId}/leave`);
      get().leaveGroupRoom(groupId);
      set((state) => ({
        groups: state.groups.filter((group) => group._id !== groupId),
        selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
        groupMessages: state.selectedGroup?._id === groupId ? [] : state.groupMessages,
      }));
      toast.success("You left the group");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to leave group");
      return false;
    }
  },

  transferAdmin: async (groupId, userId) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/transfer-admin`, { userId });
      const updatedGroup = res.data.group;
      set((state) => ({
        groups: state.groups.map((group) => (group._id === updatedGroup._id ? updatedGroup : group)),
        selectedGroup: state.selectedGroup?._id === updatedGroup._id ? updatedGroup : state.selectedGroup,
      }));
      toast.success("Admin role transferred");
      return updatedGroup;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to transfer admin role");
      return null;
    }
  },

  sendGroupMessage: async (groupId, payload) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/messages`, payload);
      const message = res.data;
      const socket = userAuthStore.getState().socket;

      if (!socket?.connected) {
        set((state) => ({ groupMessages: [...state.groupMessages, message] }));
      }

      return message;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
      return null;
    }
  },

  markGroupMessagesSeen: async (groupId) => {
    if (!groupId) return;
    try {
      await axiosInstance.patch(`/groups/${groupId}/mark-seen`);
    } catch {
      // ignore
    }
  },

  clearGroupUnread: (groupId) => {
    set((state) => ({
      groupUnreadCounts: { ...state.groupUnreadCounts, [groupId]: 0 },
    }));
  },

  subscribeToGroupMessages: () => {
    const socket = userAuthStore.getState().socket;
    if (!socket) return;

    socket.on("groupMessage", (message) => {
      set((state) => {
        if (state.selectedGroup?._id === message.groupId?.toString()) {
          return { groupMessages: [...state.groupMessages, message] };
        }

        const nextCount = (state.groupUnreadCounts[message.groupId?.toString()] || 0) + 1;
        return {
          groupUnreadCounts: {
            ...state.groupUnreadCounts,
            [message.groupId?.toString()]: nextCount,
          },
        };
      });
    });

    socket.on("groupTyping", ({ groupId, user, isTyping }) => {
      if (!groupId || !user) return;
      set((state) => {
        const current = state.typingUsers.filter((entry) => entry.groupId !== groupId || entry.user._id !== user._id);
        if (isTyping) {
          return { typingUsers: [...current, { groupId, user }] };
        }
        return { typingUsers: current };
      });
    });

    socket.on("unreadCount", ({ conversationId, count }) => {
      set((state) => ({
        groupUnreadCounts: {
          ...state.groupUnreadCounts,
          [conversationId]: count,
        },
      }));
    });

    socket.on("groupDeleted", ({ groupId }) => {
      set((state) => ({
        groups: state.groups.filter((group) => group._id !== groupId),
        selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
        groupMessages: state.selectedGroup?._id === groupId ? [] : state.groupMessages,
      }));
    });

    socket.on("groupUserJoined", ({ groupId, members }) => {
      set((state) => ({
        groups: state.groups.map((group) => (group._id === groupId ? { ...group, members: [...group.members, ...members] } : group)),
      }));
    });

    socket.on("groupUserLeft", ({ groupId, userId }) => {
      set((state) => ({
        groups: state.groups.map((group) => (group._id === groupId ? { ...group, members: group.members.filter((member) => member._id !== userId) } : group)),
      }));
    });
  },

  unsubscribeFromGroupMessages: () => {
    const socket = userAuthStore.getState().socket;
    if (!socket) return;
    socket.off("groupMessage");
    socket.off("groupTyping");
    socket.off("unreadCount");
    socket.off("groupDeleted");
    socket.off("groupUserJoined");
    socket.off("groupUserLeft");
  },
}));
