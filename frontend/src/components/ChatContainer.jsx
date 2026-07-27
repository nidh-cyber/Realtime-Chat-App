import { Search } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { userAuthStore } from "../store/userAuthStore";
import { formatMessageTime } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = userAuthStore();
  const [messageSearch, setMessageSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const messageEndRef = useRef(null);

  useEffect(() => {
    getMessages(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const filteredMessages = messageSearch.trim()
    ? messages.filter((message) => (message.text || message.message || "").toLowerCase().includes(messageSearch.trim().toLowerCase()))
    : messages;

  if (isMessagesLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <ChatHeader isSearchOpen={isSearchOpen} onToggleSearch={() => setIsSearchOpen((open) => !open)} />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ChatHeader isSearchOpen={isSearchOpen} onToggleSearch={() => setIsSearchOpen((open) => !open)} />

      <div className="flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          {isSearchOpen && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-base-300 bg-base-200 px-3 py-2">
              <Search size={16} className="text-zinc-400" />
              <input
                value={messageSearch}
                onChange={(event) => setMessageSearch(event.target.value)}
                placeholder="Search this conversation"
                className="w-full bg-transparent text-sm outline-none"
                autoFocus
              />
            </div>
          )}

          <div className="space-y-4">
            {filteredMessages.map((message) => (
              <div
              key={message._id}
              className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
              ref={messageEndRef}
            >
              <div className=" chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img
                    src={
                      message.senderId === authUser._id
                        ? authUser.profilePic || "/avatar.png"
                        : selectedUser.profilePic || "/avatar.png"
                    }
                    alt="profile pic"
                  />
                </div>
              </div>
              <div className="chat-header mb-1">
                <time className="text-xs opacity-50 ml-1">
                  {formatMessageTime(message.createdAt)}
                </time>
              </div>
              <div className="chat-bubble flex flex-col">
                {message.image && (
                  <img
                    src={message.image}
                    alt="Attachment"
                    className="sm:max-w-[200px] rounded-md mb-2"
                  />
                )}
                {message.text && <p>{message.text}</p>}
              </div>
            </div>
          ))}
          </div>
        </div>

        {messageSearch.trim() && filteredMessages.length === 0 && (
          <div className="py-6 text-center text-sm text-zinc-500">No messages matched your search.</div>
        )}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
