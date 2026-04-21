import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TimePicker } from "@/components/ui/time-picker";
import { DatePicker } from "@/components/ui/date-picker";

type ColorType = "red" | "yellow" | "green";

interface ColorGroups {
    red: GroupMember[];
    yellow: GroupMember[];
    green: GroupMember[];
}

const initialGroups: ColorGroups = {
    red: [
        {
            id: "bosses",
            name: "The Bosses",
            avatars: [
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
            ],
        },
    ],
    yellow: [
        {
            id: "family",
            name: "Family",
            avatars: [
                "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
            ],
        },
        {
            id: "girlfriend",
            name: "Girl Friend",
            avatars: [
                "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop",
            ],
        },
        {
            id: "bffs",
            name: "BFF's",
            avatars: [
                "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop",
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop",
            ],
        },
    ],
    green: [
        {
            id: "shalev",
            name: "Shalev Atlas",
            avatars: [
                "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop",
            ],
        },
        {
            id: "bar",
            name: "Bar Levi",
            avatars: [
                "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop",
            ],
        },
    ],
};

export default function Preferences() {
    const [groups, setGroups] = useState<ColorGroups>(initialGroups);
    const [activeId, setActiveId] = useState<string | null>(null);

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
        setActiveId(event.active.id as string);
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
        setActiveId(null);
    };

    const activeMember = getActiveMember();

    return (
        <DashboardLayout title="Preferences" subtitle="16 Chats Found">
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