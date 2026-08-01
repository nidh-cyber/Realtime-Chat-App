import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { userAuthStore } from "../store/userAuthStore";
import { useGroupStore } from "../store/useGroupStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import GroupsSidebar from "./GroupsSidebar";
import { Search, Users } from "lucide-react";

const Sidebar = () => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    searchMessages,
    searchResults,
    isSearchLoading,
  } = useChatStore();
  const { setSelectedGroup } = useGroupStore();

  const { onlineUsers } = userAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchMessages(searchTerm);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, searchMessages]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  const hasSearch = searchTerm.trim().length > 0;
  const searchUsers = searchResults.users || [];
  const searchChats = searchResults.chats || [];
  const searchMessageResults = searchResults.messages || [];
  const searchGroups = searchResults.groups || [];

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="flex h-full w-20 flex-col border-r border-base-300 transition-all duration-200 lg:w-72">
      <div className="w-full border-b border-base-300 p-5">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="hidden font-medium lg:block">Contacts</span>
        </div>
        <div className="mt-3 hidden items-center gap-2 lg:flex">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
        </div>
      </div>

      <div className="w-full flex-1 overflow-y-auto py-3">
        <div className="mx-3 mb-3 flex items-center gap-2 rounded-xl border border-base-300 bg-base-200 px-3 py-2">
          <Search size={16} className="text-zinc-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users, chats, messages"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        {hasSearch ? (
          <div className="space-y-3 px-3">
            {isSearchLoading && <div className="text-sm text-zinc-500">Searching...</div>}

            {!isSearchLoading && searchUsers.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Users</div>
                {searchUsers.map((user) => (
                  <button
                    key={user._id}
                    onClick={() => {
                      setSelectedUser(user);
                      setSelectedGroup(null);
                    }}
                    className="mb-2 flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-base-300"
                  >
                    <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="size-10 rounded-full object-cover" />
                    <div className="text-left">
                      <div className="text-sm font-medium">{user.fullName}</div>
                      <div className="text-xs text-zinc-400">{user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isSearchLoading && searchChats.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Chats</div>
                {searchChats.map((item) => (
                  <button
                    key={item.type === "group" ? item.group._id : item.user._id}
                    onClick={() => {
                      if (item.type === "group") {
                        setSelectedGroup(item.group);
                        setSelectedUser(null);
                      } else {
                        setSelectedUser(item.user);
                        setSelectedGroup(null);
                      }
                    }}
                    className="mb-2 flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-base-300"
                  >
                    <img src={item.type === "group" ? item.group.avatar || "/avatar.png" : item.user.profilePic || "/avatar.png"} alt={item.type === "group" ? item.group.name : item.user.fullName} className="size-10 rounded-full object-cover" />
                    <div className="text-left">
                      <div className="text-sm font-medium">{item.type === "group" ? item.group.name : item.user.fullName}</div>
                      <div className="text-xs text-zinc-400">{item.type === "group" ? `${item.group.members?.length || 0} members` : item.user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isSearchLoading && searchGroups.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Groups</div>
                {searchGroups.map((group) => (
                  <button
                    key={group._id}
                    onClick={() => {
                      setSelectedGroup(group);
                      setSelectedUser(null);
                    }}
                    className="mb-2 flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-base-300"
                  >
                    <img src={group.avatar || "/avatar.png"} alt={group.name} className="size-10 rounded-full object-cover" />
                    <div className="text-left">
                      <div className="text-sm font-medium">{group.name}</div>
                      <div className="text-xs text-zinc-400">{group.members?.length || 0} members</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isSearchLoading && searchMessageResults.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Messages</div>
                {searchMessageResults.map((message) => (
                  <button
                    key={message._id}
                    onClick={() => {
                      if (message.conversationType === "group" && message.conversationGroup) {
                        setSelectedGroup(message.conversationGroup);
                        setSelectedUser(null);
                      } else if (message.conversationUser) {
                        setSelectedUser(message.conversationUser);
                        setSelectedGroup(null);
                      }
                      setSearchTerm("");
                    }}
                    className="mb-2 flex w-full flex-col rounded-xl border border-base-300 p-2 text-left text-sm text-zinc-400"
                  >
                    <div className="font-medium text-zinc-200">{message.conversationName}</div>
                    <div className="mt-1 line-clamp-2">{message.text || message.message}</div>
                  </button>
                ))}
              </div>
            )}

            {!isSearchLoading && !searchUsers.length && !searchChats.length && !searchGroups.length && !searchMessageResults.length && (
              <div className="py-4 text-center text-zinc-500">No matches found</div>
            )}
          </div>
        ) : (
          <>
            {filteredUsers.map((user) => (
              <button
                key={user._id}
                onClick={() => {
                  setSelectedUser(user);
                  setSelectedGroup(null);
                }}
                className={`flex w-full items-center gap-3 p-3 transition-colors hover:bg-base-300 ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}`}
              >
                <div className="relative mx-auto lg:mx-0">
                  <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="size-12 rounded-full object-cover" />
                  {onlineUsers.includes(user._id) && <span className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 ring-2 ring-zinc-900" />}
                </div>

                <div className="hidden min-w-0 flex-1 text-left lg:block">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-medium">{user.fullName}</div>
                    {user.lastMessageAt && (
                      <span className="text-xs text-zinc-500">{new Date(user.lastMessageAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                    )}
                  </div>
                  <div className="text-sm text-zinc-400">
                    {user.lastMessage ? (
                      <span className="line-clamp-1">{user.lastMessage.text || user.lastMessage.message || "Shared an image"}</span>
                    ) : (
                      onlineUsers.includes(user._id) ? "Online" : "Offline"
                    )}
                  </div>
                </div>
              </button>
            ))}

            {filteredUsers.length === 0 && <div className="py-4 text-center text-zinc-500">No online users</div>}
          </>
        )}
      </div>

      <GroupsSidebar />
    </aside>
  );
};
export default Sidebar;