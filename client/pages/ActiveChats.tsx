import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ActiveChatCard } from "@/components/chat/ActiveChatCard";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/hooks/use-toast";

interface ActiveChatItem {
    id: string;
    roomId: string;
    roomType?: string;
    name: string;
    messageCount: number;
    summary: string;
    avatarUrl: string;
}

export default function ActiveChats() {
    const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [searchValue, setSearchValue] = useState("");
    const [activeChats, setActiveChats] = useState<ActiveChatItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadActiveChats = async () => {
            setIsLoading(true);

            try {
                const params = new URLSearchParams({
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                    limit: "8",
                });
                const response = await fetch(`/users/me/active-chats?${params.toString()}`, {
                    credentials: "include",
                });

                const payload = (await response.json()) as {
                    chats?: ActiveChatItem[];
                    message?: string;
                };
                if (!response.ok) {
                    throw new Error(payload.message ?? "Failed to load active chats");
                }

                if (!isMounted) return;
                setActiveChats(payload.chats ?? []);
            } catch (error) {
                if (!isMounted) return;

                toast({
                    title: "Failed to load active chats",
                    description:
                        error instanceof Error ? error.message : "Failed to load active chats",
                    variant: "destructive",
                });
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void loadActiveChats();

        return () => {
            isMounted = false;
        };
    }, [startDate, endDate]);

    const filteredChats = useMemo(() => {
        const normalized = searchValue.trim().toLowerCase();
        if (!normalized) {
            return activeChats;
        }

        return activeChats.filter((chat) =>
            chat.name.toLowerCase().includes(normalized) ||
            chat.summary.toLowerCase().includes(normalized)
        );
    }, [activeChats, searchValue]);

    return (
        <DashboardLayout
            title="Top - Active Chat's"
            subtitle={
                isLoading
                    ? "Loading chats..."
                    : `${filteredChats.length} active chat${filteredChats.length === 1 ? "" : "s"} found`
            }
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="Search active chats..."
        >
            {/* Date Range */}
            <div className="mb-8 flex w-fit flex-wrap items-center gap-3 rounded-full light-card px-4 py-2">
                <DatePicker value={startDate} onChange={(date) => date && setStartDate(date)} />
                <span className="text-card-light-foreground/60">To</span>
                <DatePicker value={endDate} onChange={(date) => date && setEndDate(date)} />
            </div>

            {/* Centered wide-card layout */}
            <div className="mx-auto mt-8 flex max-w-[1700px] flex-wrap justify-center gap-5 xl:flex-nowrap xl:items-stretch">
                {filteredChats.map((chat, index) => {
                    return (
                        <ActiveChatCard
                            key={chat.id}
                            name={chat.name}
                            avatar={chat.avatarUrl}
                            messageCount={chat.messageCount}
                            description={chat.summary}
                            className="w-full max-w-[420px] xl:min-w-0 xl:flex-1 xl:basis-0"
                            style={{
                                animationDelay: `${index * 100}ms`,
                            }}
                        />
                    );
                })}
            </div>
            {!isLoading && filteredChats.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                    No active chats matched the selected range.
                </div>
            ) : null}
        </DashboardLayout>
    );
}
