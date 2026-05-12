import { ChatGroup } from "@/components/chat/ChatGroup";

interface FormattedChatGroup {
    id: string;
    name: string;
    avatars: string[];
    preview: string;
}

interface TodaySummaryChatSidebarProps {
    formattedChatGroups: FormattedChatGroup[];
    activeChatId: string | null;
    onChatSelect: (id: string) => void;
}

export function TodaySummaryChatSidebar({ 
    formattedChatGroups, 
    activeChatId, 
    onChatSelect 
}: TodaySummaryChatSidebarProps) {
    return (
        <div className="h-[280px] space-y-3 overflow-y-auto pr-2 lg:h-[320px]">
            {formattedChatGroups.map((group) => (
                <ChatGroup
                    key={group.id}
                    name={group.name}
                    avatars={group.avatars}
                    preview={group.preview}
                    isActive={activeChatId === group.id}
                    onClick={() => onChatSelect(group.id)}
                />
            ))}
        </div>
    );
}
