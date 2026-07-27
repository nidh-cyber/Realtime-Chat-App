import { Search } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { userAuthStore } from "../store/userAuthStore";
import { formatMessageTime } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    loadOlderMessages,
    isMessagesLoading,
    isLoadingOlderMessages,
    hasMoreMessages,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = userAuthStore();
  const [messageSearch, setMessageSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const messageListRef = useRef(null);
  const shouldScrollToBottomRef = useRef(true);

  useEffect(() => {
    shouldScrollToBottomRef.current = true;
    getMessages(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useLayoutEffect(() => {
    const messageList = messageListRef.current;
    if (messageList && shouldScrollToBottomRef.current && !isMessagesLoading) {
      messageList.scrollTop = messageList.scrollHeight;
      shouldScrollToBottomRef.current = false;
    }
  }, [messages, isMessagesLoading]);

  const handleScroll = async (event) => {
    const messageList = event.currentTarget;
    const isNearBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 80;
    shouldScrollToBottomRef.current = isNearBottom;

    if (messageSearch.trim() || messageList.scrollTop > 50 || !hasMoreMessages || isLoadingOlderMessages) return;

    const previousHeight = messageList.scrollHeight;
    const previousTop = messageList.scrollTop;
    const loaded = await loadOlderMessages(selectedUser._id);
    if (loaded) {
      requestAnimationFrame(() => {
        const updatedList = messageListRef.current;
        if (updatedList) updatedList.scrollTop = updatedList.scrollHeight - previousHeight + previousTop;
      });
    }
  };

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
        <div ref={messageListRef} onScroll={handleScroll} className="h-full overflow-y-auto p-4">
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
            {isLoadingOlderMessages && <div className="py-2 text-center text-xs text-zinc-500">Loading older messages...</div>}
            {filteredMessages.map((message) => (
              <div
              key={message._id}
              className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
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
