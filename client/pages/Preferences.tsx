import { useCallback, useEffect, useState } from "react";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DroppableColorGroup, GroupMember } from "@/components/preferences/DroppableColorGroup";
import { RoomTypeIcon } from "@/components/preferences/DraggableMembers";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TimePicker } from "@/components/ui/time-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/hooks/use-toast";
import { LoaderCircle } from "lucide-react";

type ColorType = "red" | "yellow" | "green";

interface ColorGroups {
    red: GroupMember[];
    yellow: GroupMember[];
    green: GroupMember[];
}

const initialGroups: ColorGroups = {
    red: [],
    yellow: [],
    green: [],
};

interface RocketSubscriptionResponseItem {
    id: string;
    roomId: string;
    roomType?: string;
    preferenceColor?: ColorType;
    avatarUrl?: string;
    payload?: {
        fname?: string;
        name?: string;
        u?: { username?: string; name?: string };
        [key: string]: unknown;
    };
}

interface RocketSubscriptionsResponse {
    sync?: {
        status?: "pending" | "syncing" | "completed" | "failed";
        startedAt?: string;
        completedAt?: string;
        error?: string;
    };
    subscriptions?: RocketSubscriptionResponseItem[];
}

function mapSubscriptionToMember(subscription: RocketSubscriptionResponseItem): GroupMember {
    const name =
        subscription.payload?.fname ??
        subscription.payload?.u?.name ??
        subscription.payload?.name ??
        subscription.payload?.u?.username ??
        subscription.roomId;

    return {
        id: subscription.id,
        name,
        avatars: subscription.avatarUrl ? [subscription.avatarUrl] : [],
        roomType: subscription.roomType,
    };
}

function isColorType(value: string | undefined): value is ColorType {
    return value === "red" || value === "yellow" || value === "green";
}

export default function Preferences() {
    const [groups, setGroups] = useState<ColorGroups>(initialGroups);
    const [searchValue, setSearchValue] = useState("");
    const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeOriginColor, setActiveOriginColor] = useState<ColorType | null>(null);
    const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(true);
    const [syncStatus, setSyncStatus] = useState<RocketSubscriptionsResponse["sync"]>();

    // Time pickers state
    const [startTime, setStartTime] = useState("15:00");
    const [endTime, setEndTime] = useState("20:30");
    const [startDate, setStartDate] = useState<Date | undefined>(new Date(2030, 6, 25));
    const [endDate, setEndDate] = useState<Date | undefined>(new Date(2030, 6, 29));
    const [answerTime, setAnswerTime] = useState("03:00");

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedSearchValue(searchValue.trim().toLowerCase());
        }, 250);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [searchValue]);

    const loadSubscriptions = useCallback(async (showErrorToast = true) => {
        try {
            const response = await fetch("/users/me/rocket-subscriptions", {
                credentials: "include",
            });

            const payload = (await response.json()) as RocketSubscriptionsResponse & { message?: string };
            if (!response.ok) {
                throw new Error(payload.message ?? "Failed to load Rocket subscriptions");
            }

            const nextGroups: ColorGroups = { red: [], yellow: [], green: [] };
            for (const subscription of payload.subscriptions ?? []) {
                const member = mapSubscriptionToMember(subscription);
                const color = isColorType(subscription.preferenceColor)
                    ? subscription.preferenceColor
                    : "yellow";
                nextGroups[color].push(member);
            }

            setSyncStatus(payload.sync);
            setGroups(nextGroups);
        } catch (error) {
            if (showErrorToast) {
                const description =
                    error instanceof Error ? error.message : "Failed to load Rocket subscriptions";
                toast({
                    title: "Failed to load subscriptions",
                    description,
                    variant: "destructive",
                });
            }
        } finally {
            setIsLoadingSubscriptions(false);
        }
    }, []);

    useEffect(() => {
        void loadSubscriptions();
    }, [loadSubscriptions]);

    const isSyncInProgress = syncStatus?.status === "pending" || syncStatus?.status === "syncing";

    useEffect(() => {
        if (!isSyncInProgress) {
            return;
        }

        const intervalId = window.setInterval(() => {
            void loadSubscriptions(false);
        }, 5000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [isSyncInProgress, loadSubscriptions]);

    const findContainer = (id: string): ColorType | null => {
        if (id in groups) return id as ColorType;

        for (const [color, members] of Object.entries(groups)) {
            if (members.some((m) => m.id === id)) {
                return color as ColorType;
            }
        }
        return null;
    };

    const getActiveMember = (): GroupMember | null => {
        if (!activeId) return null;
        for (const members of Object.values(groups)) {
            const member = members.find((m) => m.id === activeId);
            if (member) return member;
        }
        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        const memberId = event.active.id as string;
        setActiveId(memberId);
        setActiveOriginColor(findContainer(memberId));
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(over.id as string);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        setGroups((prev) => {
            const activeItems = [...prev[activeContainer]];
            const overItems = [...prev[overContainer]];
            const activeIndex = activeItems.findIndex((m) => m.id === active.id);
            const [movedItem] = activeItems.splice(activeIndex, 1);

            return {
                ...prev,
                [activeContainer]: activeItems,
                [overContainer]: [...overItems, movedItem],
            };
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        const previousColor = activeOriginColor;
        setActiveOriginColor(null);

        if (!over) return;

        const activeId = active.id as string;
        const overContainer = findContainer(over.id as string);

        if (!previousColor || !overContainer || previousColor === overContainer) {
            return;
        }

        void persistPreferenceColorChange(activeId, overContainer, previousColor);
    };

    const persistPreferenceColorChange = async (
        subscriptionId: string,
        nextColor: ColorType,
        previousColor: ColorType
    ) => {
        try {
            const response = await fetch(
                `/users/me/rocket-subscriptions/${encodeURIComponent(subscriptionId)}/preference-color`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ preferenceColor: nextColor }),
                }
            );

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message ?? "Failed to save subscription preference");
            }
        } catch (error) {
            setGroups((prev) => {
                const nextGroups: ColorGroups = {
                    red: [...prev.red],
                    yellow: [...prev.yellow],
                    green: [...prev.green],
                };
                const currentIndex = nextGroups[nextColor].findIndex((member) => member.id === subscriptionId);
                if (currentIndex === -1) {
                    return prev;
                }

                const [member] = nextGroups[nextColor].splice(currentIndex, 1);
                nextGroups[previousColor] = [...nextGroups[previousColor], member];
                return nextGroups;
            });

            toast({
                title: "Failed to save subscription preference",
                description:
                    error instanceof Error ? error.message : "Failed to save subscription preference",
                variant: "destructive",
            });
        }
    };

    const activeMember = getActiveMember();
    const filterMembers = (members: GroupMember[]) =>
        debouncedSearchValue
            ? members.filter((member) =>
                  member.name.toLowerCase().includes(debouncedSearchValue)
              )
            : members;

    const filteredGroups: ColorGroups = {
        red: filterMembers(groups.red),
        yellow: filterMembers(groups.yellow),
        green: filterMembers(groups.green),
    };
    const totalVisibleSubscriptions =
        filteredGroups.red.length +
        filteredGroups.yellow.length +
        filteredGroups.green.length;
    const totalSubscriptions =
        groups.red.length + groups.yellow.length + groups.green.length;
    const subtitle = isLoadingSubscriptions
        ? "Loading subscriptions..."
        : debouncedSearchValue
          ? `${totalVisibleSubscriptions} matching subscription${totalVisibleSubscriptions === 1 ? "" : "s"} found`
          : `${totalSubscriptions} subscription${totalSubscriptions === 1 ? "" : "s"} found`;

    return (
        <DashboardLayout
            title="Preferences"
            subtitle={subtitle}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="Search subscriptions..."
        >
            {isSyncInProgress && (
                <div className="mb-6 flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-card-light-foreground">
                    <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-yellow-500" />
                    <span>
                        Rocket.Chat data is still syncing. Preferences may show old subscriptions until the sync completes.
                    </span>
                </div>
            )}

            {syncStatus?.status === "failed" && (
                <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-card-light-foreground">
                    Rocket.Chat sync failed. Preferences may be out of date.
                    {syncStatus.error ? ` ${syncStatus.error}` : ""}
                </div>
            )}

            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                {/* Color Group Cards */}
                <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3 xl:gap-6">
                    <DroppableColorGroup color="red" members={filteredGroups.red} />
                    <DroppableColorGroup color="yellow" members={filteredGroups.yellow} />
                    <DroppableColorGroup color="green" members={filteredGroups.green} />
                </div>

                <DragOverlay>
                    {activeMember && (
                        <div className="flex items-center gap-3 bg-card-light rounded-lg p-2 shadow-lg">
                            <div className="flex -space-x-2">
                                {activeMember.avatars.slice(0, 2).map((avatar, i) => (
                                    <Avatar key={i} className="h-10 w-10 border-2 border-card-light">
                                        <AvatarImage src={avatar} />
                                        <AvatarFallback seed={activeMember.name}>{activeMember.name[0]}</AvatarFallback>
                                    </Avatar>
                                ))}
                            </div>
                            <div className="-ml-1 shrink-0 rounded-full bg-card-light/90 px-1.5 py-1">
                                <RoomTypeIcon roomType={activeMember.roomType} />
                            </div>
                            <span className="text-sm text-card-light-foreground">{activeMember.name}</span>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
                {/* Bot Activate Time */}
                <div className="light-card animate-fade-in rounded-2xl p-4 sm:p-6">
                    <h3 className="text-lg font-bold text-card-light-foreground mb-6 text-center">
                        Bot Activate Time
                    </h3>

                    <div className="space-y-4">
                        {/* Time Range */}
                        <div className="flex flex-col items-stretch justify-center gap-3 rounded-3xl bg-card-light/50 px-4 py-3 sm:flex-row sm:items-center sm:rounded-full sm:py-2">
                            <TimePicker value={startTime} onChange={setStartTime} />
                            <span className="text-center text-card-light-foreground/60">To</span>
                            <TimePicker value={endTime} onChange={setEndTime} />
                        </div>

                        {/* Date Range */}
                        <div className="flex flex-col items-stretch justify-center gap-3 rounded-3xl bg-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:rounded-full sm:py-2">
                            <DatePicker value={startDate} onChange={setStartDate} />
                            <span className="text-center text-card-light-foreground/60">To</span>
                            <DatePicker value={endDate} onChange={setEndDate} />
                        </div>
                    </div>
                </div>

                {/* Bot Preferences */}
                <div className="light-card animate-fade-in rounded-2xl p-4 sm:p-6" style={{ animationDelay: "100ms" }}>
                    <h3 className="text-lg font-bold text-card-light-foreground mb-6 text-center">
                        Bot preferences
                    </h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-card-light-foreground">Use Emoji's:</span>
                            <Switch defaultChecked />
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-card-light-foreground">Use your own slangs:</span>
                            <Switch />
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-card-light-foreground">Answer Time:</span>
                            <TimePicker value={answerTime} onChange={setAnswerTime} />
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
