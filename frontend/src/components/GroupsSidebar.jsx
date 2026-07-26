import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";
import CreateGroupModal from "./CreateGroupModal";

const GroupsSidebar = () => {
  const { groups, getGroups, selectedGroup, setSelectedGroup, groupUnreadCounts } = useGroupStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    getGroups();
  }, [getGroups]);

  return (
    <div className="mt-4 border-t border-base-300 pt-4">
      <div className="mb-2 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Users size={18} />
          <span className="font-medium">Groups</span>
        </div>
        <button type="button" onClick={() => setIsCreateOpen(true)} className="btn btn-ghost btn-xs">
          <Plus size={14} />
          New
        </button>
      </div>

      <div className="space-y-1 px-2">
        {groups.map((group) => (
          <button
            key={group._id}
            onClick={() => setSelectedGroup(group)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${selectedGroup?._id === group._id ? "bg-base-300" : "hover:bg-base-200"}`}
          >
            <div className="flex items-center gap-3">
              <img src={group.avatar || "/avatar.png"} alt={group.name} className="h-9 w-9 rounded-full object-cover" />
              <div>
                <div className="text-sm font-medium">{group.name}</div>
                <div className="text-xs text-zinc-500">{group.members?.length || 0} members</div>
              </div>
            </div>
            {(groupUnreadCounts[group._id] || 0) > 0 && (
              <span className="badge badge-primary badge-sm">{groupUnreadCounts[group._id]}</span>
            )}
          </button>
        ))}
        {!groups.length && <div className="px-3 py-2 text-sm text-zinc-500">No groups yet.</div>}
      </div>

      <CreateGroupModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};

export default GroupsSidebar;
