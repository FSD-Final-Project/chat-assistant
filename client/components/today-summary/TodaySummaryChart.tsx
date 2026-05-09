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

interface TodaySummaryChartProps {
    data: any[];
}

export function TodaySummaryChart({ data }: TodaySummaryChartProps) {
    return (
        <div className="mt-6 glass-card rounded-2xl p-6 animate-fade-in w-full">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-foreground">
                Activity Dashboard
            </h3>
            <ResponsiveContainer width="100%" height={270}>
                <LineChart data={data}>
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
    );
}
