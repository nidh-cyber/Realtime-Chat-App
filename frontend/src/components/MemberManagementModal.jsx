import { useMemo, useState } from "react";
import { X, UserPlus, Shield, Trash2, ArrowRightLeft } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { userAuthStore } from "../store/userAuthStore";
import { useGroupStore } from "../store/useGroupStore";

const MemberManagementModal = ({ group, isOpen, onClose }) => {
  const { users } = useChatStore();
  const { authUser } = userAuthStore();
  const { addMembers, removeMember, transferAdmin } = useGroupStore();
  const [selectedMembers, setSelectedMembers] = useState([]);

  const availableUsers = useMemo(() => {
    const currentIds = (group?.members || []).map((member) => member._id || member);
    return users.filter((user) => user._id !== authUser?._id && !currentIds.includes(user._id));
  }, [authUser?._id, group?.members, users]);

  const isAdmin = (group?.admins || []).some((admin) => (admin._id || admin) === authUser?._id);

  const toggleMember = (userId) => {
    setSelectedMembers((current) =>
      current.includes(userId) ? current.filter((member) => member !== userId) : [...current, userId]
    );
  };

  const handleAddMembers = async () => {
    if (!selectedMembers.length || !group?._id) return;
    await addMembers(group._id, selectedMembers);
    setSelectedMembers([]);
  };

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-base-100 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Manage members</h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 space-y-3">
          <div className="text-sm font-medium">Current members</div>
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-base-300 p-3">
            {(group.members || []).map((member) => {
              const memberId = member._id || member;
              const isGroupAdmin = (group.admins || []).some((admin) => (admin._id || admin) === memberId);
              return (
                <div key={memberId} className="flex items-center justify-between rounded-lg p-2 hover:bg-base-200">
                  <div className="flex items-center gap-3">
                    <img src={member.profilePic || "/avatar.png"} alt={member.fullName} className="h-8 w-8 rounded-full object-cover" />
                    <div>
                      <div className="font-medium">{member.fullName}</div>
                      {isGroupAdmin && <div className="text-xs text-amber-500">Admin</div>}
                    </div>
                  </div>
                  {isAdmin && memberId !== authUser?._id && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => transferAdmin(group._id, memberId)}
                      >
                        <ArrowRightLeft size={14} />
                      </button>
                      <button type="button" className="btn btn-xs btn-ghost" onClick={() => removeMember(group._id, memberId)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Add members</div>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-base-300 p-3">
              {availableUsers.map((user) => (
                <label key={user._id} className="flex items-center justify-between rounded-lg p-2 hover:bg-base-200">
                  <div className="flex items-center gap-3">
                    <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="h-8 w-8 rounded-full object-cover" />
                    <span>{user.fullName}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedMembers.includes(user._id)}
                    onChange={() => toggleMember(user._id)}
                  />
                </label>
              ))}
              {!availableUsers.length && <div className="text-sm text-zinc-500">All contacts are already members.</div>}
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn btn-primary" onClick={handleAddMembers}>
                <UserPlus size={16} />
                Add selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberManagementModal;
