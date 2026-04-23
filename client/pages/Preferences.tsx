import { useEffect, useState } from "react";
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
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeOriginColor, setActiveOriginColor] = useState<ColorType | null>(null);
    const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(true);

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
        let isMounted = true;

        const loadSubscriptions = async () => {
            try {
                const response = await fetch("/users/me/rocket-subscriptions", {
                    credentials: "include",
                });

                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.message ?? "Failed to load Rocket subscriptions");
                }

                if (!isMounted) return;

                const nextGroups: ColorGroups = { red: [], yellow: [], green: [] };
                for (const subscription of payload.subscriptions as RocketSubscriptionResponseItem[]) {
                    const member = mapSubscriptionToMember(subscription);
                    const color = isColorType(subscription.preferenceColor)
                        ? subscription.preferenceColor
                        : "yellow";
                    nextGroups[color].push(member);
                }

                setGroups(nextGroups);
            } catch (error) {
                if (!isMounted) return;

                const description =
                    error instanceof Error ? error.message : "Failed to load Rocket subscriptions";
                toast({
                    title: "Failed to load subscriptions",
                    description,
                    variant: "destructive",
                });
            } finally {
                if (isMounted) {
                    setIsLoadingSubscriptions(false);
                }
            }
        };

        void loadSubscriptions();

        return () => {
            isMounted = false;
        };
    }, []);

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

    return (
        <DashboardLayout
            title="Preferences"
            subtitle={
                isLoadingSubscriptions
                    ? "Loading subscriptions..."
                    : `${groups.yellow.length} subscription${groups.yellow.length === 1 ? "" : "s"} found`
            }
        >
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                {/* Color Group Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <DroppableColorGroup color="red" members={groups.red} />
                    <DroppableColorGroup color="yellow" members={groups.yellow} />
                    <DroppableColorGroup color="green" members={groups.green} />
                </div>

                <DragOverlay>
                    {activeMember && (
                        <div className="flex items-center gap-3 bg-card-light rounded-lg p-2 shadow-lg">
                            <div className="flex -space-x-2">
                                {activeMember.avatars.slice(0, 2).map((avatar, i) => (
                                    <Avatar key={i} className="h-10 w-10 border-2 border-card-light">
                                        <AvatarImage src={avatar} />
                                        <AvatarFallback>{activeMember.name[0]}</AvatarFallback>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bot Activate Time */}
                <div className="light-card rounded-2xl p-6 animate-fade-in">
                    <h3 className="text-lg font-bold text-card-light-foreground mb-6 text-center">
                        Bot Activate Time
                    </h3>

                    <div className="space-y-4">
                        {/* Time Range */}
                        <div className="flex items-center justify-center gap-3 bg-card-light/50 rounded-full px-4 py-2">
                            <TimePicker value={startTime} onChange={setStartTime} />
                            <span className="text-card-light-foreground/60">To</span>
                            <TimePicker value={endTime} onChange={setEndTime} />
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center justify-center gap-3 bg-primary/10 rounded-full px-4 py-2">
                            <DatePicker value={startDate} onChange={setStartDate} />
                            <span className="text-card-light-foreground/60">To</span>
                            <DatePicker value={endDate} onChange={setEndDate} />
                        </div>
                    </div>
                </div>

                {/* Bot Preferences */}
                <div className="light-card rounded-2xl p-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
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
