import { ReactNode } from "react";
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
            <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 xl:px-10">
                <header className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
                            <span className="h-7 w-1 rounded-full bg-primary sm:h-8" />
                            {title}
                        </h1>
                        {subtitle && <p className="ml-3 mt-1 text-sm text-muted-foreground">{subtitle}</p>}
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:justify-end">
                        <div className="relative w-full sm:flex-1 lg:w-64 lg:flex-none">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input placeholder="Search..." className="w-full bg-card pl-10" />
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-gradient-to-br from-primary via-purple-500 to-pink-500 sm:self-auto">
                            <span className="text-xs font-bold text-white">-/+X</span>
                        </div>
                    </div>
                </header>

                {children}
            </main>
        </div>
    );
}
