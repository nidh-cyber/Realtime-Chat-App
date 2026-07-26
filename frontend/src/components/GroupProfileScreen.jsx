import { Edit3, LogOut, Trash2, Users } from "lucide-react";
import { userAuthStore } from "../store/userAuthStore";
import { useGroupStore } from "../store/useGroupStore";

const GroupProfileScreen = ({ group, onEdit, onManageMembers }) => {
  const { authUser } = userAuthStore();
  const { leaveGroup, deleteGroup } = useGroupStore();

  const isAdmin = (group?.admins || []).some((admin) => (admin._id || admin) === authUser?._id);

  const handleLeave = async () => {
    await leaveGroup(group._id);
  };

  const handleDelete = async () => {
    await deleteGroup(group._id);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-base-100 p-4">
      <div className="rounded-2xl bg-base-200 p-4 text-center">
        <img src={group?.avatar || "/avatar.png"} alt={group?.name} className="mx-auto mb-3 h-20 w-20 rounded-full object-cover" />
        <h3 className="text-lg font-semibold">{group?.name}</h3>
        <p className="text-sm text-zinc-500">{group?.members?.length || 0} members</p>
      </div>

      <div className="rounded-2xl border border-base-300 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} />
            <span className="font-medium">Members</span>
          </div>
          {isAdmin && (
            <button type="button" onClick={onManageMembers} className="btn btn-xs btn-ghost">
              Manage
            </button>
          )}
        </div>
        <div className="space-y-2">
          {(group?.members || []).map((member) => {
            const memberId = member._id || member;
            const isGroupAdmin = (group?.admins || []).some((admin) => (admin._id || admin) === memberId);
            return (
              <div key={memberId} className="flex items-center justify-between rounded-lg p-2 hover:bg-base-200">
                <div className="flex items-center gap-3">
                  <img src={member.profilePic || "/avatar.png"} alt={member.fullName} className="h-8 w-8 rounded-full object-cover" />
                  <div>
                    <div className="text-sm font-medium">{member.fullName}</div>
                    {isGroupAdmin && <div className="text-xs text-amber-500">Admin</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {isAdmin && (
          <button type="button" onClick={onEdit} className="btn btn-outline btn-sm w-full justify-start">
            <Edit3 size={16} />
            Rename or update avatar
          </button>
        )}
        <button type="button" onClick={handleLeave} className="btn btn-outline btn-sm w-full justify-start">
          <LogOut size={16} />
          Leave group
        </button>
        {isAdmin && (
          <button type="button" onClick={handleDelete} className="btn btn-error btn-sm w-full justify-start">
            <Trash2 size={16} />
            Delete group
          </button>
        )}
      </div>
    </div>
  );
};

export default GroupProfileScreen;
