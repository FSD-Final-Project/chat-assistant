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

interface TodaySummaryChartPoint {
    time: string;
    label: string;
    red: number;
    yellow: number;
    green: number;
}

interface TodaySummaryChartProps {
    data: TodaySummaryChartPoint[];
    loading?: boolean;
    error?: string | null;
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

export function TodaySummaryChart({ data, loading = false, error = null }: TodaySummaryChartProps) {
    const hasData = data.some((item) => item.red > 0 || item.yellow > 0 || item.green > 0);
    const formatChartLabel = (value: string) =>
        data.find((item) => item.time === value)?.label ?? value;

    return (
        <div className="mt-6 glass-card rounded-2xl p-6 animate-fade-in w-full">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-foreground">
                Activity Dashboard
            </h3>
            <div className={`transition-opacity duration-300 ${loading ? "opacity-40" : ""}`}>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 36 }}>
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
                    <Line
                        type="monotone"
                        dataKey="red"
                        stroke="hsl(var(--chart-red))"
                        strokeWidth={2}
                        dot={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="yellow"
                        stroke="hsl(var(--chart-yellow))"
                        strokeWidth={2}
                        dot={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="green"
                        stroke="hsl(var(--chart-green))"
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
            </div>
            {error && (
                <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
            {!loading && !error && !hasData && (
                <p className="mt-2 text-sm text-muted-foreground">No messages found today.</p>
            )}
        </div>
    );
}
