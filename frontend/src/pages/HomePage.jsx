import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import GroupChatScreen from "../components/GroupChatScreen";
import GroupProfileScreen from "../components/GroupProfileScreen";
import EditGroupModal from "../components/EditGroupModal";
import MemberManagementModal from "../components/MemberManagementModal";

const HomePage = () => {
  const { selectedUser } = useChatStore();
  const { selectedGroup } = useGroupStore();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  const showGroupView = Boolean(selectedGroup);

  return (
    <div className="h-screen bg-base-200">
      <div className="flex items-center justify-center px-4 pt-20">
        <div className="h-[calc(100vh-8rem)] w-full max-w-6xl rounded-lg bg-base-100 shadow-cl">
          <div className="flex h-full overflow-hidden rounded-lg">
            <Sidebar />

            {!selectedUser && !selectedGroup ? (
              <NoChatSelected />
            ) : (
              <div className="flex flex-1 overflow-hidden">
                <div className="flex-1">
                  {showGroupView ? <GroupChatScreen group={selectedGroup} /> : <ChatContainer />}
                </div>
                {showGroupView && (
                  <div className="hidden w-80 border-l border-base-300 lg:block">
                    <GroupProfileScreen
                      group={selectedGroup}
                      onEdit={() => setIsEditOpen(true)}
                      onManageMembers={() => setIsMembersOpen(true)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <EditGroupModal group={selectedGroup} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} />
      <MemberManagementModal group={selectedGroup} isOpen={isMembersOpen} onClose={() => setIsMembersOpen(false)} />
    </div>
  );
};
export default HomePage;