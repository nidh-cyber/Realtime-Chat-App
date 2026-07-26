import { useEffect, useMemo, useState } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { userAuthStore } from "../store/userAuthStore";
import { useGroupStore } from "../store/useGroupStore";

const CreateGroupModal = ({ isOpen, onClose }) => {
  const [name, setName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [validationError, setValidationError] = useState("");
  const { users, getUsers } = useChatStore();
  const { authUser } = userAuthStore();
  const { createGroup } = useGroupStore();

  useEffect(() => {
    if (isOpen && users.length === 0) {
      getUsers();
    }
  }, [getUsers, isOpen, users.length]);

  const availableUsers = useMemo(
    () => users.filter((user) => user._id !== authUser?._id),
    [authUser?._id, users]
  );

  const toggleMember = (userId) => {
    setSelectedMembers((current) =>
      current.includes(userId) ? current.filter((member) => member !== userId) : [...current, userId]
    );
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setValidationError("Please enter a group name.");
      return;
    }

    if (selectedMembers.length < 1) {
      setValidationError("Please select at least one member.");
      return;
    }

    setValidationError("");

    const group = await createGroup({
      name: name.trim(),
      avatar: avatarPreview,
      members: selectedMembers,
    });

    if (group) {
      setName("");
      setAvatarPreview("");
      setSelectedMembers([]);
      setValidationError("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-base-100 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create group</h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border border-dashed border-base-300 bg-base-200">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Preview" className="h-full w-full rounded-full object-cover" />
              ) : (
                <ImageIcon size={24} />
              )}
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
            <div className="flex-1">
              <label className="mb-1 block text-sm">Group name</label>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (validationError) setValidationError("");
                }}
                className="input input-bordered w-full"
                placeholder="Weekend plans"
              />
            </div>
          </div>

          {validationError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
              {validationError}
            </div>
          )}

          <div>
            <div className="mb-2 text-sm font-medium">Add members</div>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-base-300 p-3">
              {availableUsers.map((user) => (
                <label key={user._id} className="flex items-center justify-between gap-3 rounded-lg p-2 hover:bg-base-200">
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
              {!availableUsers.length && <div className="text-sm text-zinc-500">No contacts available yet.</div>}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
