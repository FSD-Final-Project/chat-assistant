import { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AppLogo } from "./AppLogo";

interface DashboardLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
}

export function DashboardLayout({
    children,
    title,
    subtitle,
    searchValue,
    onSearchChange,
    searchPlaceholder = "Search...",
}: DashboardLayoutProps) {
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
                            <Input
                                placeholder={searchPlaceholder}
                                value={searchValue ?? ""}
                                onChange={(event) => onSearchChange?.(event.target.value)}
                                className="w-full bg-card pl-10"
                            />
                        </div>
                        <AppLogo className="h-10 w-10 shrink-0 self-end sm:self-auto [&>span]:text-xs" />
                    </div>
                </header>

                {children}
            </main>
        </div>
    );
}
