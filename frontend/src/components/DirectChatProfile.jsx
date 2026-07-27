import { Circle, Mail, UserRound } from "lucide-react";
import { userAuthStore } from "../store/userAuthStore";

const DirectChatProfile = ({ user }) => {
  const { onlineUsers } = userAuthStore();
  const isOnline = onlineUsers.includes(user?._id);

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto bg-base-100 p-4">
      <section className="rounded-2xl bg-base-200 p-6 text-center">
        <div className="relative mx-auto mb-3 w-fit">
          <img
            src={user?.profilePic || "/avatar.png"}
            alt={user?.fullName}
            className="h-20 w-20 rounded-full object-cover"
          />
          <span
            className={`absolute bottom-1 right-0 h-4 w-4 rounded-full border-2 border-base-200 ${isOnline ? "bg-success" : "bg-base-300"}`}
            aria-label={isOnline ? "Online" : "Offline"}
          />
        </div>
        <h3 className="text-lg font-semibold">{user?.fullName}</h3>
        <p className="text-sm text-zinc-500">{isOnline ? "Online" : "Offline"}</p>
      </section>

      <section className="rounded-2xl border border-base-300 p-4">
        <div className="mb-3 flex items-center gap-2 font-medium">
          <UserRound size={18} />
          Contact info
        </div>
        <div className="flex items-center gap-3 rounded-lg p-2">
          <Mail size={16} className="text-zinc-500" />
          <span className="min-w-0 truncate text-sm">{user?.email || "No email available"}</span>
        </div>
        <div className="mt-2 flex items-center gap-3 rounded-lg p-2 text-sm text-zinc-500">
          <Circle size={10} className={isOnline ? "fill-success text-success" : "fill-zinc-500 text-zinc-500"} />
          {isOnline ? "Active now" : "Currently offline"}
        </div>
      </section>
    </aside>
  );
};

export default DirectChatProfile;
