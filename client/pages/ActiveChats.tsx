import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ActiveChatCard } from "@/components/chat/ActiveChatCard";
import { DatePicker } from "@/components/ui/date-picker";

const activeChats = [
    {
        id: 1,
        name: "Shalev Atlas",
        avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop",
        messageCount: 128,
        description: "Purpose: To fill space in a design mockup to...",
    },
    {
        id: 2,
        name: "Ethan Lerner",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
        messageCount: 225,
        description: "Purpose: To fill space in a design mockup to demonstrate typography and layout.",
    },
    {
        id: 3,
        name: "Family Group",
        avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop",
        messageCount: 416,
        description: "Usage: Standardized by printers, popularized by Letraset sheets (1960s).",
    },
    {
        id: 4,
        name: "Bar Levi",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop",
        messageCount: 503,
        description: "Purpose: To fill space in a design mockup to demonstrate typography and layout.",
    },
];

export default function ActiveChats() {
    const [startDate, setStartDate] = useState<Date>(new Date(2030, 6, 25));
    const [endDate, setEndDate] = useState<Date>(new Date(2030, 6, 29));

    return (
        <DashboardLayout title="Top - Active Chat's" subtitle="4 Chats Found">
            {/* Date Range */}
            <div className="flex items-center gap-3 mb-8 light-card rounded-full px-4 py-2 w-fit">
                <DatePicker value={startDate} onChange={(date) => date && setStartDate(date)} />
                <span className="text-card-light-foreground/60">To</span>
                <DatePicker value={endDate} onChange={(date) => date && setEndDate(date)} />
            </div>

            {/* Cards with staggered layout */}
            <div className="relative flex items-end justify-center gap-4 mt-12 pb-8">
                {activeChats.map((chat, index) => {
                    const heights = [0, 60, 120, 180];
                    return (
                        <ActiveChatCard
                            key={chat.id}
                            name={chat.name}
                            avatar={chat.avatar}
                            messageCount={chat.messageCount}
                            description={chat.description}
                            className="w-64"
                            style={{
                                marginBottom: `${heights[index]}px`,
                                animationDelay: `${index * 100}ms`,
                            }}
                        />
                    );
                })}
            </div>
        </DashboardLayout>
    );
}
