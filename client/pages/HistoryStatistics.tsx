import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DatePicker } from "@/components/ui/date-picker";
import { StatCard } from "@/components/ui/stat-card";
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
import { useHistoryStats } from "@/hooks/useHistoryStats";

const COLORS = {
    blue: ["hsl(var(--chart-blue))", "hsl(var(--chart-blue) / 0.4)"],
    green: ["hsl(var(--chart-green))", "hsl(var(--chart-green) / 0.4)"],
    yellow: ["hsl(var(--chart-yellow))", "hsl(var(--chart-yellow) / 0.5)"],
    orange: ["hsl(var(--chart-orange))", "hsl(var(--chart-orange) / 0.4)"],
    muted: ["hsl(var(--muted-foreground) / 0.3)"],
};

interface MiniPieChartProps {
    data: { name: string; value: number }[];
    colors: string[];
}

interface ChartTooltipProps {
    active?: boolean;
    payload?: Array<{
        name?: string;
        value?: number;
        color?: string;
        payload?: { label?: string };
    }>;
}

const MessagesTooltip = ({ active, payload }: ChartTooltipProps) => {
    if (!active || !payload?.length) return null;

    const label = payload[0]?.payload?.label ?? "Unknown";

    return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
            <p className="font-semibold text-foreground mb-1">Time: {label}</p>
            {payload.map((item) => (
                <p key={item.name} className="text-muted-foreground">
                    <span style={{ color: item.color }}>{item.name}</span>: {item.value ?? 0} messages
                </p>
            ))}
        </div>
    );
};

const MiniPieChart = ({ data, colors }: MiniPieChartProps) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const displayData = total === 0 ? [{ name: "No data", value: 1 }] : data;
    const displayColors = total === 0 ? COLORS.muted : colors;

    return (
        <ResponsiveContainer width={80} height={80}>
            <PieChart>
                <Tooltip
                    content={({ active, payload }) => {
                        if (!active || !payload?.length || total === 0) return null;
                        const item = payload[0].payload;
                        const percent = ((item.value / total) * 100).toFixed(0);
                        return (
                            <div className="bg-card border border-border rounded-lg px-2 py-1 shadow-lg text-xs">
                                <p className="font-medium text-foreground">{item.name}</p>
                                <p className="text-muted-foreground">{item.value} ({percent}%)</p>
                            </div>
                        );
                    }}
                />
                <Pie
                    data={displayData}
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
                    {displayData.map((_, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={displayColors[index % displayColors.length]}
                            className="transition-all duration-200 hover:opacity-80"
                            style={{ cursor: "pointer" }}
                        />
                    ))}
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    );
};

function formatTimeSaved(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    if (mins === 0) return "0m";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export default function HistoryStatistics() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [startDate, setStartDate] = useState<Date>(thirtyDaysAgo);
    const [endDate, setEndDate] = useState<Date>(today);

    const { data, loading, error } = useHistoryStats(startDate, endDate);
    const hasPreferenceData = (data?.lineChartData ?? []).some(
        (item) => item.red > 0 || item.yellow > 0 || item.green > 0,
    );
    const hasTimeData = (data?.timeOfDayData ?? []).some((item) => item.value > 0);

    const aiMessagesData = [
        { name: "Auto", value: data?.aiMessages.auto ?? 0 },
        { name: "Reviewed", value: data?.aiMessages.manual ?? 0 },
    ];

    const approvalsData = [
        { name: "Approved", value: data?.reviewApprovals.approved ?? 0 },
        { name: "Pending", value: Math.max(0, (data?.reviewApprovals.total ?? 0) - (data?.reviewApprovals.approved ?? 0)) },
    ];

    const todosData = [{ name: "N/A", value: 1 }];

    const timeSavedData = [
        { name: "Auto", value: data?.aiMessages.auto ?? 0 },
        { name: "Manual", value: data?.aiMessages.manual ?? 0 },
    ];

    const timeSavedLabel = `Time Saved! ${formatTimeSaved(data?.timeSavedSeconds ?? 0)}`;
    const totalChats = data?.totalChats ?? 0;
    const subtitle = `${totalChats} chat${totalChats === 1 ? "" : "s"} found`;
    const formatChartLabel = (value: string) =>
        data?.lineChartData.find((item) => item.time === value)?.label ??
        data?.timeOfDayData.find((item) => item.time === value)?.label ??
        value;

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
            label: timeSavedLabel,
            bgColor: "bg-chart-orange/20",
        },
    ];

    return (
        <DashboardLayout title="History Statistics" subtitle={subtitle}>
            {/* Date Range */}
            <div className="flex items-center gap-3 mb-8 light-card rounded-full px-4 py-2 w-fit">
                <DatePicker value={startDate} onChange={(date) => date && setStartDate(date)} />
                <span className="text-card-light-foreground/60">To</span>
                <DatePicker value={endDate} onChange={(date) => date && setEndDate(date)} />
            </div>

            {/* Charts Row */}
            <div
                className={`grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 transition-opacity duration-300 ${loading ? "opacity-40 pointer-events-none" : ""}`}
            >
                {/* Multi-line Chart */}
                <div className="glass-card rounded-2xl p-6 animate-fade-in">
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Messages by preference</h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={data?.lineChartData ?? []} margin={{ top: 8, right: 16, left: 8, bottom: 36 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="time"
                                stroke="hsl(var(--muted-foreground))"
                                tickFormatter={formatChartLabel}
                                interval="preserveStartEnd"
                                height={52}
                                minTickGap={12}
                                tickMargin={10}
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                allowDecimals={false}
                                label={{ value: "Messages", angle: -90, position: "insideLeft" }}
                            />
                            <Tooltip content={<MessagesTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey="red" stroke="hsl(var(--chart-red))" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="yellow" stroke="hsl(var(--chart-yellow))" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="green" stroke="hsl(var(--chart-green))" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                    {!loading && !error && !hasPreferenceData && (
                        <p className="mt-2 text-sm text-muted-foreground">No messages found in this time range.</p>
                    )}
                </div>

                {/* Time of Day Chart */}
                <div className="glass-card rounded-2xl p-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Messages over selected time</h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={data?.timeOfDayData ?? []} margin={{ top: 8, right: 16, left: 8, bottom: 36 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="time"
                                stroke="hsl(var(--muted-foreground))"
                                tickFormatter={formatChartLabel}
                                interval="preserveStartEnd"
                                height={52}
                                minTickGap={12}
                                tickMargin={10}
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                allowDecimals={false}
                                label={{ value: "Messages", angle: -90, position: "insideLeft" }}
                            />
                            <Tooltip content={<MessagesTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                    {!loading && !error && !hasTimeData && (
                        <p className="mt-2 text-sm text-muted-foreground">No messages found in this time range.</p>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-8 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* Stat Cards */}
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-6 transition-opacity duration-300 ${loading ? "opacity-40" : ""}`}>
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
