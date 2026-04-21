import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DatePicker } from "@/components/ui/date-picker";
import { StatCard } from "@/components/ui/stat-card";
import { Calendar } from "lucide-react";
import { useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    PieChart,
    Pie,
    Cell,
} from "recharts";

const lineData = [
    { name: "Item 1", red: 10, yellow: 15, green: 20 },
    { name: "Item 2", red: 25, yellow: 30, green: 35 },
    { name: "Item 3", red: 30, yellow: 35, green: 45 },
    { name: "Item 4", red: 35, yellow: 38, green: 42 },
    { name: "Item 5", red: 40, yellow: 42, green: 48 },
];

const timeData = [
    { name: "Item 1", value: 20 },
    { name: "Item 2", value: 30 },
    { name: "Item 3", value: 35 },
    { name: "Item 4", value: 42 },
    { name: "Item 5", value: 50 },
];

// Pie chart data for each stat card
const aiMessagesData = [
    { name: "Sent", value: 65 },
    { name: "Received", value: 35 },
];

const approvalsData = [
    { name: "Approved", value: 78 },
    { name: "Pending", value: 22 },
];

const todosData = [
    { name: "Completed", value: 45 },
    { name: "In Progress", value: 30 },
    { name: "New", value: 25 },
];

const timeSavedData = [
    { name: "Automated", value: 70 },
    { name: "Manual", value: 30 },
];

const COLORS = {
    blue: ["hsl(var(--chart-blue))", "hsl(var(--chart-blue) / 0.4)"],
    green: ["hsl(var(--chart-green))", "hsl(var(--chart-green) / 0.4)"],
    yellow: ["hsl(var(--chart-yellow))", "hsl(var(--chart-yellow) / 0.5)", "hsl(var(--chart-yellow) / 0.3)"],
    orange: ["hsl(var(--chart-orange))", "hsl(var(--chart-orange) / 0.4)"],
};

interface MiniPieChartProps {
    data: { name: string; value: number }[];
    colors: string[];
}

const MiniPieChart = ({ data, colors }: MiniPieChartProps) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
        <ResponsiveContainer width={80} height={80}>
            <PieChart>
                <Tooltip
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            const item = payload[0].payload;
                            const percent = ((item.value / total) * 100).toFixed(0);
                            return (
                                <div className="bg-card border border-border rounded-lg px-2 py-1 shadow-lg text-xs">
                                    <p className="font-medium text-foreground">{item.name}</p>
                                    <p className="text-muted-foreground">{item.value} ({percent}%)</p>
                                </div>
                            );
                        }
                        return null;
                    }}
                />
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={35}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                    animationBegin={0}
                    animationDuration={400}
                >
                    {data.map((_, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={colors[index % colors.length]}
                            className="transition-all duration-200 hover:opacity-80"
                            style={{ cursor: 'pointer' }}
                        />
                    ))}
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    );
};
const statCards = [
    {
        chart: <MiniPieChart data={aiMessagesData} colors={COLORS.blue} />,
        label: "amount of AI messages",
        bgColor: "bg-chart-blue/20",
    },
    {
        chart: <MiniPieChart data={approvalsData} colors={COLORS.green} />,
        label: "Review Approvals",
        bgColor: "bg-chart-green/20",
    },
    {
        chart: <MiniPieChart data={todosData} colors={COLORS.yellow} />,
        label: "New Todo's",
        bgColor: "bg-chart-yellow/20",
    },
    {
        chart: <MiniPieChart data={timeSavedData} colors={COLORS.orange} />,
        label: "Time Saved!",
        bgColor: "bg-chart-orange/20",
    },
];

export default function HistoryStatistics() {
    const [startDate, setStartDate] = useState<Date>(new Date(2030, 6, 25));
    const [endDate, setEndDate] = useState<Date>(new Date(2030, 6, 29));

    return (
        <DashboardLayout title="History Statistics" subtitle="66 Chats Found">
            {/* Date Range */}
            <div className="flex items-center gap-3 mb-8 light-card rounded-full px-4 py-2 w-fit">
                <DatePicker value={startDate} onChange={(date) => date && setStartDate(date)} />
                <span className="text-card-light-foreground/60">To</span>
                <DatePicker value={endDate} onChange={(date) => date && setEndDate(date)} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Multi-line Chart */}
                <div className="glass-card rounded-2xl p-6 animate-fade-in">
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Red vs. Yellow vs. Green</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={lineData}>
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
                            <Line type="monotone" dataKey="red" stroke="hsl(var(--chart-red))" strokeWidth={2} />
                            <Line type="monotone" dataKey="yellow" stroke="hsl(var(--chart-yellow))" strokeWidth={2} />
                            <Line type="monotone" dataKey="green" stroke="hsl(var(--chart-green))" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Time of Day Chart */}
                <div className="glass-card rounded-2xl p-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">most active time of the day</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={timeData}>
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
                            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((card, index) => (
                    <StatCard
                        key={index}
                        icon={card.chart}
                        label={card.label}
                        iconBgColor={card.bgColor}
                    />
                ))}
            </div>
        </DashboardLayout>
    );
}
