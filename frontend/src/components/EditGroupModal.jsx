import { useEffect, useState } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { useGroupStore } from "../store/useGroupStore";

const EditGroupModal = ({ group, isOpen, onClose }) => {
  const [name, setName] = useState(group?.name || "");
  const [avatarPreview, setAvatarPreview] = useState(group?.avatar || "");
  const { updateGroup } = useGroupStore();

  useEffect(() => {
    setName(group?.name || "");
    setAvatarPreview(group?.avatar || "");
  }, [group]);

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!group?._id) return;
    const updated = await updateGroup(group._id, { name: name.trim(), avatar: avatarPreview });
    if (updated) onClose();
  };

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-base-100 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit group</h3>
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
                onChange={(event) => setName(event.target.value)}
                className="input input-bordered w-full"
                placeholder="Group name"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditGroupModal;
