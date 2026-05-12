import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { useHistoryStats } from "@/hooks/useHistoryStats";

import { TodaySummaryTabs } from "@/components/today-summary/TodaySummaryTabs";
import { TodaySummaryChatSidebar } from "@/components/today-summary/TodaySummaryChatSidebar";
import { TodaySummaryDetails } from "@/components/today-summary/TodaySummaryDetails";
import { TodaySummaryChart } from "@/components/today-summary/TodaySummaryChart";

const tabs = ["All Chats", "Pending", "Completed"];

interface RocketSubscription {
    roomId: string;
    avatarUrl: string;
    payload?: {
        name?: string;
        fname?: string;
        lastMessage?: {
            msg?: string;
        };
    };
}

export default function TodaySummary() {
    const [activeTab, setActiveTab] = useState("All Chats");
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const today = useMemo(() => new Date(), []);
    const { data: todayStats, loading: isLoadingTodayStats, error: todayStatsError } = useHistoryStats(today, today);

    // Fetch Subscriptions
    const { data: subscriptionsData, isLoading: isLoadingSubscriptions } = useQuery({
        queryKey: ["rocket-subscriptions"],
        queryFn: async () => {
            const res = await fetch("/users/me/rocket-subscriptions");
            if (!res.ok) throw new Error("Failed to fetch subscriptions");
            return res.json();
        }
    });

    const subscriptions = useMemo<RocketSubscription[]>(
        () => subscriptionsData?.subscriptions || [],
        [subscriptionsData?.subscriptions]
    );

    // Set first chat as active initially
    useEffect(() => {
        if (subscriptions.length > 0 && !activeChatId) {
            setActiveChatId(subscriptions[0].roomId);
        }
    }, [subscriptions, activeChatId]);

    // Formatted Chat Groups
    const formattedChatGroups = subscriptions.map((sub) => {
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
                />

                {/* Chat Groups */}
                <TodaySummaryChatSidebar 
                    formattedChatGroups={formattedChatGroups}
                    activeChatId={activeChatId}
                    onChatSelect={setActiveChatId}
                />
            </div>

            {/* Dashboard Chart Below */}
            <TodaySummaryChart
                data={todayStats?.lineChartData ?? []}
                loading={isLoadingTodayStats}
                error={todayStatsError}
            />
        </DashboardLayout>
    );
}
