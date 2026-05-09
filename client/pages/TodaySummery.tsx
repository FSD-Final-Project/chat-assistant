import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ChatGroup } from "@/components/chat/ChatGroup";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { MessageSquare, Sparkles, Bot } from "lucide-react";
import { makeStyles } from "./TodaySummery.styles";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

const chartData = [
    { name: "Item 1", green: 20, yellow: 15, red: 10 },
    { name: "Item 2", green: 35, yellow: 28, red: 25 },
    { name: "Item 3", green: 40, yellow: 35, red: 30 },
    { name: "Item 4", green: 38, yellow: 40, red: 35 },
    { name: "Item 5", green: 45, yellow: 42, red: 40 },
];


const chatGroups = [
    {
        id: 1,
        name: "The Bosses",
        avatars: [
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
        ],
        preview: "they needed you to finish one task, add to your TODO",
        summary: "Your managers are requesting an update on the Q3 quarterly report and need you to complete the final review task before the end of the day.",
        recentMessages: [
            { id: 101, sender: "Alice (Boss)", content: "Hey, how is the Q3 report coming along?", timestamp: "09:15 AM", isMe: false },
            { id: 102, sender: "Bob (Boss)", content: "We need that final review done today, please add it to your TODO.", timestamp: "09:30 AM", isMe: false },
            { id: 103, sender: "You", content: "I'll get it done right after lunch.", timestamp: "10:00 AM", isMe: true }
        ],
        suggestions: ["I'm working on the review now.", "It will be ready in an hour.", "Can we extend the deadline to tomorrow?"]
    },
    {
        id: 2,
        name: "Bar, Ethan And Shalev",
        avatars: [
            "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop",
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop",
            "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop",
        ],
        preview: "they just said hey today and asked for bla so I repl...",
        summary: "The team is discussing the new UI components. Ethan asked for the updated design files, and Bar wants to schedule a sync tomorrow.",
        recentMessages: [
            { id: 201, sender: "Ethan", content: "Hey, do we have the updated design files for the new dashboard?", timestamp: "11:00 AM", isMe: false },
            { id: 202, sender: "Bar", content: "I don't have them yet. Let's sync tomorrow to align.", timestamp: "11:05 AM", isMe: false },
            { id: 203, sender: "You", content: "I'll upload the files in a bit. What time tomorrow works?", timestamp: "11:15 AM", isMe: true },
            { id: 204, sender: "Shalev", content: "After 2 PM is best for me.", timestamp: "11:20 AM", isMe: false }
        ],
        suggestions: ["Sure, let's meet at 2:30 PM.", "I have uploaded the files to Drive.", "I can't make it tomorrow, how about Thursday?"]
    },
    {
        id: 3,
        name: "Family and Girl friend",
        avatars: [
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
        ],
        preview: "sent them that you love them❤️",
        summary: "Just casual check-ins. You sent some love and they are asking about dinner plans for tonight.",
        recentMessages: [
            { id: 301, sender: "Mom", content: "How is work going today sweetie?", timestamp: "12:30 PM", isMe: false },
            { id: 302, sender: "You", content: "It's going well! Love you guys ❤️", timestamp: "12:45 PM", isMe: true },
            { id: 303, sender: "Girlfriend", content: "Love you too! What are we doing for dinner tonight?", timestamp: "01:10 PM", isMe: false }
        ],
        suggestions: ["Let's order sushi tonight!", "I can cook pasta when I get home.", "Want to go out to that new place?"]
    },
];

const tabs = ["All Chats", "Pending", "Completed"];

export default function TodaySummary() {
    const [activeTab, setActiveTab] = useState("All Chats");
    const [activeChatId, setActiveChatId] = useState(2);
    const [startTime, setStartTime] = useState("15:00");
    const [endTime, setEndTime] = useState("20:30");
    const styles = makeStyles();

    const activeChat = chatGroups.find(c => c.id === activeChatId);

    return (
        <DashboardLayout title="Today Summary" subtitle="16 Chats Found">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 w-fit">
                {tabs.map((tab) => (
                    <Button
                        key={tab}
                        variant={activeTab === tab ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveTab(tab)}
                        className="rounded-full"
                    >
                        {tab}
                    </Button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Detailed View */}
                {activeChat ? (
                    <div className={styles.detailsContainer}>
                        {/* Left: Recent Messages */}
                        <div className={styles.messagesSection}>
                            <h3 className={styles.sectionTitle}>
                                <MessageSquare className="w-5 h-5 text-primary" />
                                Recent Messages
                            </h3>
                            <div className={styles.messagesList}>
                                {activeChat.recentMessages.map((msg) => (
                                    <div key={msg.id} className={styles.messageWrapper(msg.isMe)}>
                                        <div className={styles.messageBubble(msg.isMe)}>
                                            {!msg.isMe && <span className={styles.messageSender}>{msg.sender}</span>}
                                            <p>{msg.content}</p>
                                            <span className={styles.messageTime}>{msg.timestamp}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Summary & Suggestions */}
                        <div className={styles.sidebarSection}>
                            {/* Summary Card */}
                            <div className={styles.summaryCard}>
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                <h4 className={styles.summaryHeader}>
                                    <Bot className="w-4 h-4" />
                                    AI Summary
                                </h4>
                                <p className={styles.summaryText}>{activeChat.summary}</p>
                            </div>

                            {/* Suggestions */}
                            <div className={styles.suggestionsContainer}>
                                <h4 className={styles.suggestionTitle}>
                                    <Sparkles className="w-4 h-4 text-yellow-500" />
                                    Auto-Reply Suggestions
                                </h4>
                                <div className={styles.suggestionChips}>
                                    {activeChat.suggestions.map((suggestion, idx) => (
                                        <button key={idx} className={styles.suggestionChip}>
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        <MessageSquare className="w-8 h-8 opacity-20" />
                        <p>Select a chat to view details</p>
                    </div>
                )}

                {/* Chat Groups */}
                <div className="space-y-3">
                    {chatGroups.map((group) => (
                        <ChatGroup
                            key={group.id}
                            name={group.name}
                            avatars={group.avatars}
                            preview={group.preview}
                            isActive={activeChatId === group.id}
                            onClick={() => setActiveChatId(group.id)}
                        />
                    ))}
                </div>
            </div>

            {/* Time Range */}
            <div className="flex items-center gap-3 mt-6 light-card rounded-full px-4 py-2 w-fit">
                <TimePicker value={startTime} onChange={(time) => setStartTime(time)} />
                <span className="text-muted-foreground">To</span>
                <TimePicker value={endTime} onChange={(time) => setEndTime(time)} />
            </div>

            {/* Dashboard Chart Below */}
            <div className="mt-6 glass-card rounded-2xl p-6 animate-fade-in w-full">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-foreground">
                    Activity Dashboard
                </h3>
                <ResponsiveContainer width="100%" height={270}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                            contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                            }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="green"
                            stroke="hsl(var(--chart-green))"
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--chart-green))" }}
                        />
                        <Line
                            type="monotone"
                            dataKey="yellow"
                            stroke="hsl(var(--chart-yellow))"
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--chart-yellow))" }}
                        />
                        <Line
                            type="monotone"
                            dataKey="red"
                            stroke="hsl(var(--chart-red))"
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--chart-red))" }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </DashboardLayout>
    );
}
