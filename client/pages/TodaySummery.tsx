import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ChatGroup } from "@/components/chat/ChatGroup";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
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
    },
    {
        id: 3,
        name: "Family and Girl friend",
        avatars: [
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
        ],
        preview: "sent them that you love them❤️",
    },
];

const tabs = ["All Chats", "Pending", "Completed"];

export default function TodaySummary() {
    const [activeTab, setActiveTab] = useState("All Chats");
    const [activeChat, setActiveChat] = useState(2);
    const [startTime, setStartTime] = useState("15:00");
    const [endTime, setEndTime] = useState("20:30");

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
                {/* Chart Section */}
                <div className="lg:col-span-2 glass-card rounded-2xl p-6 animate-fade-in">
                    <ResponsiveContainer width="100%" height={300}>
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

                {/* Chat Groups */}
                <div className="space-y-3">
                    {chatGroups.map((group) => (
                        <ChatGroup
                            key={group.id}
                            name={group.name}
                            avatars={group.avatars}
                            preview={group.preview}
                            isActive={activeChat === group.id}
                            onClick={() => setActiveChat(group.id)}
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

            <div className="mt-6 glass-card rounded-2xl p-6 animate-fade-in">
                <div className="flex items-start gap-4">
                    <div className="w-1 h-full bg-primary rounded-full" />
                    <div className="text-foreground">
                        <p className="mb-4">
                            Lorem ipsum is standard placeholder text used in publishing and design to show how a
                            layout looks with text, without distracting from the visual design, because it's nonsensical,
                            jumbled Latin derived from Cicero's works, used by printers since the 1500s and
                        </p>
                        <h4 className="font-semibold mb-2">Key characteristics</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li>Purpose: To fill space in a design mockup to demonstrate typography and layout.</li>
                            <li>Origin: A scrambled Latin text from Cicero's De finibus bonorum et malorum, meaning "pain itself".</li>
                        </ul>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
