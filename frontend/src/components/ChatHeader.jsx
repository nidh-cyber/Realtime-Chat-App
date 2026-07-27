import { MoreVertical, Search, X } from "lucide-react";
import { useState } from "react";
import { userAuthStore } from "../store/userAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = ({ isSearchOpen, onToggleSearch }) => {
    const { selectedUser, setSelectedUser } = useChatStore();
    const { onlineUsers } = userAuthStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div className="border-b border-base-300 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="avatar">
                        <div className="relative size-12 rounded-full">
                            <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold">{selectedUser.fullName}</h3>
                        <p className="text-sm text-base-content/70">
                            {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen((open) => !open)}
                            className="rounded-full p-2 text-zinc-500 transition hover:bg-base-200"
                            aria-label="Chat options"
                        >
                            <MoreVertical size={20} />
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-base-300 bg-base-100 p-1 shadow-lg">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onToggleSearch();
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
                    <button type="button" onClick={() => setSelectedUser(null)} className="rounded-full p-2 text-zinc-500 transition hover:bg-base-200" aria-label="Close chat">
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatHeader;
