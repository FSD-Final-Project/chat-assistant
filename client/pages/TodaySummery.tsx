import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TimePicker } from "@/components/ui/time-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";

import { TodaySummaryTabs } from "@/components/today-summary/TodaySummaryTabs";
import { TodaySummaryChatSidebar } from "@/components/today-summary/TodaySummaryChatSidebar";
import { TodaySummaryDetails } from "@/components/today-summary/TodaySummaryDetails";
import { TodaySummaryChart } from "@/components/today-summary/TodaySummaryChart";

const chartData = [
    { name: "Item 1", green: 20, yellow: 15, red: 10 },
    { name: "Item 2", green: 35, yellow: 28, red: 25 },
    { name: "Item 3", green: 40, yellow: 35, red: 30 },
    { name: "Item 4", green: 38, yellow: 40, red: 35 },
    { name: "Item 5", green: 45, yellow: 42, red: 40 },
];

const tabs = ["All Chats", "Pending", "Completed"];

export default function TodaySummary() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("All Chats");
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [startTime, setStartTime] = useState("15:00");
    const [endTime, setEndTime] = useState("20:30");

    // Fetch Subscriptions
    const { data: subscriptionsData, isLoading: isLoadingSubscriptions } = useQuery({
        queryKey: ["rocket-subscriptions"],
        queryFn: async () => {
            const res = await fetch("/users/me/rocket-subscriptions");
            if (!res.ok) throw new Error("Failed to fetch subscriptions");
            return res.json();
        }
    });

    const subscriptions = subscriptionsData?.subscriptions || [];

    // Set first chat as active initially
    useEffect(() => {
        if (subscriptions.length > 0 && !activeChatId) {
            setActiveChatId(subscriptions[0].roomId);
        }
    }, [subscriptions, activeChatId]);

    // Fetch Messages for Active Chat
    const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
        queryKey: ["rocket-messages", activeChatId],
        queryFn: async () => {
            if (!activeChatId) return { messages: [] };
            const res = await fetch(`/users/me/rocket-rooms/${activeChatId}/messages`);
            if (!res.ok) throw new Error("Failed to fetch messages");
            return res.json();
        },
        enabled: !!activeChatId
    });

    const recentMessages = messagesData?.messages || [];
    
    // Sort messages so the oldest is first, newest is at the bottom
    const sortedMessages = [...recentMessages].reverse();
    const lastMessage = sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1] : null;
    const lastMessageText = lastMessage ? String(lastMessage.payload?.msg || "") : "";
    const lastMessageId = lastMessage ? (lastMessage.messageId || lastMessage._id) : null;
    const lastMessageSenderId = lastMessage?.payload?.u?._id;
    const isLastMessageFromMe = !!lastMessageSenderId && lastMessageSenderId === subscriptionsData?.myRocketUserId;

    // Fetch Auto-Reply Suggestion
    const { data: suggestionData, isLoading: isLoadingSuggestion } = useQuery({
        queryKey: ["rocket-suggestion", activeChatId, lastMessageText],
        queryFn: async () => {
            if (!activeChatId || !lastMessageText || isLastMessageFromMe) return null;
            const res = await fetch(`/users/me/rocket-rooms/${activeChatId}/auto-reply-suggestion`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageText: lastMessageText, messageId: lastMessageId })
            });
            if (!res.ok) throw new Error("Failed to fetch suggestion");
            return res.json();
        },
        enabled: !!activeChatId && !!lastMessageText && !isLastMessageFromMe
    });

    const suggestion = suggestionData?.suggestion || null;

    // Post Message Mutation
    const postMessageMutation = useMutation({
        mutationFn: async (text: string) => {
            if (!activeChatId) return null;
            const res = await fetch(`/users/me/rocket-rooms/${activeChatId}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });
            if (!res.ok) throw new Error("Failed to post message");
            return res.json();
        },
        onSuccess: () => {
            // Invalidate messages and suggestion (since context changed)
            queryClient.invalidateQueries({ queryKey: ["rocket-messages", activeChatId] });
            queryClient.invalidateQueries({ queryKey: ["rocket-suggestion", activeChatId] });
        }
    });

    const handleSendSuggestion = async (text: string) => {
        await postMessageMutation.mutateAsync(text);
    };

    // Formatted Chat Groups
    const formattedChatGroups = subscriptions.map((sub: any) => {
        const name = sub.payload?.name || sub.payload?.fname || "Unknown Chat";
        return {
            id: sub.roomId,
            name,
            avatars: [sub.avatarUrl],
            preview: sub.payload?.lastMessage?.msg || "No recent messages",
        };
    });

    return (
        <DashboardLayout title="Today Summary" subtitle={`${subscriptions.length} Chats Found`}>
            {/* Tabs */}
            <TodaySummaryTabs 
                tabs={tabs} 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Detailed View */}
                <TodaySummaryDetails 
                    activeChatId={activeChatId}
                    isLoadingSubscriptions={isLoadingSubscriptions}
                    isLoadingMessages={isLoadingMessages}
                    sortedMessages={sortedMessages}
                    isLoadingSuggestion={isLoadingSuggestion}
                    suggestion={suggestion}
                    user={user}
                    onSendSuggestion={handleSendSuggestion}
                    isSendingSuggestion={postMessageMutation.isPending}
                />

                {/* Chat Groups */}
                <TodaySummaryChatSidebar 
                    formattedChatGroups={formattedChatGroups}
                    activeChatId={activeChatId}
                    onChatSelect={setActiveChatId}
                />
            </div>

            {/* Time Range */}
            <div className="flex items-center gap-3 mt-6 light-card rounded-full px-4 py-2 w-fit">
                <TimePicker value={startTime} onChange={(time) => setStartTime(time)} />
                <span className="text-muted-foreground">To</span>
                <TimePicker value={endTime} onChange={(time) => setEndTime(time)} />
            </div>

            {/* Dashboard Chart Below */}
            <TodaySummaryChart data={chartData} />
        </DashboardLayout>
    );
}
