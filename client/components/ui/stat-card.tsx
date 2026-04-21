import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    icon: ReactNode;
    label: string;
    className?: string;
    iconBgColor?: string;
}

export function StatCard({ icon, label, className, iconBgColor = "bg-chart-blue/20" }: StatCardProps) {
    return (
        <div className={cn("light-card rounded-xl p-6 flex flex-col items-center gap-4 animate-fade-in", className)}>
            <div className={cn("w-24 h-24 rounded-full flex items-center justify-center", iconBgColor)}>
                {icon}
            </div>
            <span className="text-sm font-medium text-card-light-foreground text-center">{label}</span>
        </div>
    );
}
