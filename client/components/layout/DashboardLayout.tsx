import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface DashboardLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
    return (
        <div className="bg-background">
            <main className="p-8">
                <header className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <span className="w-1 h-8 bg-primary rounded-full" />
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-sm text-muted-foreground mt-1 ml-3">{subtitle}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search..."
                                className="w-64 pl-10 bg-card border-border"
                            />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">αX</span>
                        </div>
                    </div>
                </header>

                {children}
            </main>
        </div>
    );
}
