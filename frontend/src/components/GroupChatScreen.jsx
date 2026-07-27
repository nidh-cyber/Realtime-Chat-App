import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, MoreVertical, Search, Send, X } from "lucide-react";
import { formatMessageTime } from "../lib/utils";
import { userAuthStore } from "../store/userAuthStore";
import { useGroupStore } from "../store/useGroupStore";

const GroupChatScreen = ({ group }) => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { authUser } = userAuthStore();
  const { groupMessages, typingUsers, fetchGroupDetails, sendGroupMessage, subscribeToGroupMessages, unsubscribeFromGroupMessages } = useGroupStore();
  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const emitTyping = useCallback((isTyping) => {
    const socket = userAuthStore.getState().socket;
    if (socket && group?._id) {
      socket.emit("groupTyping", { groupId: group._id, user: authUser, isTyping });
    }
  }, [authUser, group?._id]);

  const stopTyping = useCallback(() => {
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;

    if (isTypingRef.current) {
      emitTyping(false);
      isTypingRef.current = false;
    }
  }, [emitTyping]);

  const handleTextChange = (event) => {
    const nextText = event.target.value;
    setText(nextText);

    if (!nextText.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      emitTyping(true);
      isTypingRef.current = true;
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 800);
  };

  useEffect(() => {
    if (!group?._id) return;
    fetchGroupDetails(group._id);
    subscribeToGroupMessages();

    return () => unsubscribeFromGroupMessages();
  }, [fetchGroupDetails, group?._id, subscribeToGroupMessages, unsubscribeFromGroupMessages]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [groupMessages]);

  useEffect(() => {
    return stopTyping;
  }, [stopTyping]);

  const typingLabel = useMemo(() => {
    const activeUsers = typingUsers.filter((entry) => entry.groupId === group?._id).map((entry) => entry.user?.fullName || "Someone");
    if (!activeUsers.length) return "";
    return `${activeUsers.join(", ")} typing...`;
  }, [group?._id, typingUsers]);

  const filteredMessages = messageSearch.trim()
    ? groupMessages.filter((message) => (message.message || "").toLowerCase().includes(messageSearch.trim().toLowerCase()))
    : groupMessages;

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!text.trim() && !imagePreview) return;
    stopTyping();
    const message = await sendGroupMessage(group._id, { message: text.trim(), image: imagePreview });
    if (message) {
      setText("");
      setImagePreview("");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={group?.avatar || "/avatar.png"} alt={group?.name} className="h-10 w-10 rounded-full object-cover" />
          <div>
            <div className="font-medium">{group?.name}</div>
            <div className="text-xs text-zinc-500">{group?.members?.length || 0} members</div>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="rounded-full p-2 text-zinc-500 transition hover:bg-base-200"
            aria-label="Group chat options"
          >
            <MoreVertical size={20} />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-base-300 bg-base-100 p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen((open) => !open);
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-base-200"
              >
                <Search size={16} />
                {isSearchOpen ? "Hide search" : "Search messages"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isSearchOpen && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-base-300 bg-base-200 px-3 py-2">
            <Search size={16} className="text-zinc-400" />
            <input
              value={messageSearch}
              onChange={(event) => setMessageSearch(event.target.value)}
              placeholder="Search this group"
              className="w-full bg-transparent text-sm outline-none"
              autoFocus
            />
          </div>
        )}

        {filteredMessages.map((message) => {
          const isMine = message.senderId?.toString() === authUser?._id || message.sender?.toString() === authUser?._id;
          return (
            <div key={message._id} className={`mb-3 flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMine ? "bg-primary text-primary-content" : "bg-base-200"}`}>
                {!isMine && <div className="mb-1 text-xs font-medium opacity-70">{message.sender?.fullName || "Group member"}</div>}
                {message.image && <img src={message.image} alt="Attachment" className="mb-2 max-w-full rounded-lg" />}
                {message.message && <div>{message.message}</div>}
                <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
                  <span>{formatMessageTime(message.createdAt)}</span>
                  {isMine && <span>• Seen by {message.seenBy?.length || 0}</span>}
                </div>
              </div>
            </div>
          );
        })}

        {messageSearch.trim() && filteredMessages.length === 0 && (
          <div className="py-6 text-center text-sm text-zinc-500">No messages matched your search.</div>
        )}
        <div ref={messageEndRef} />
      </div>

      {typingLabel && <div className="px-4 pb-1 text-sm text-zinc-500">{typingLabel}</div>}

      <form onSubmit={handleSend} className="border-t border-base-300 p-4">
        {imagePreview && (
          <div className="mb-3 flex items-center gap-2">
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="h-20 w-20 rounded-lg object-cover" />
              <button type="button" onClick={() => setImagePreview("")} className="absolute -right-2 -top-2 rounded-full bg-base-300 p-1">
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={handleTextChange}
            onBlur={stopTyping}
            className="input input-bordered flex-1"
            placeholder="Write a message"
          />
          <input type="file" accept="image/*" id="group-upload" className="hidden" onChange={handleImageChange} />
          <label htmlFor="group-upload" className="btn btn-ghost btn-circle">
            <ImageIcon size={18} />
          </label>
          <button type="submit" className="btn btn-primary btn-circle">
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default GroupChatScreen;
