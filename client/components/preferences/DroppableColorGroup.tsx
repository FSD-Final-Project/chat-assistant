import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { DraggableMember } from "./DraggableMembers";

type ColorType = "red" | "yellow" | "green";

export interface GroupMember {
    id: string;
    name: string;
    avatars: string[];
}

interface DroppableColorGroupProps {
    color: ColorType;
    members: GroupMember[];
}

const colorConfig = {
    red: {
        title: "RED",
        titleColor: "text-chart-red",
        borderColor: "border-t-chart-red",
    },
    yellow: {
        title: "Yellow",
        titleColor: "text-chart-yellow",
        borderColor: "border-t-chart-yellow",
    },
    green: {
        title: "Green",
        titleColor: "text-chart-green",
        borderColor: "border-t-chart-green",
    },
};

export function DroppableColorGroup({ color, members }: DroppableColorGroupProps) {
    const config = colorConfig[color];
    const { setNodeRef, isOver } = useDroppable({ id: color });

    return (
        <div
            className={cn(
                "light-card rounded-xl overflow-hidden animate-fade-in transition-all duration-200",
                `border-t-4 ${config.borderColor}`,
                isOver && "ring-2 ring-primary/50 scale-[1.02]"
            )}
        >
            <div className="p-4">
                <h3 className={cn("text-xl font-bold mb-4 text-center", config.titleColor)}>
                    {config.title}
                </h3>
                <div
                    ref={setNodeRef}
                    className={cn(
                        "space-y-3 min-h-[100px] rounded-lg p-2 transition-colors",
                        isOver && "bg-primary/10"
                    )}
                >
                    <SortableContext
                        items={members.map((m) => m.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {members.map((member) => (
                            <DraggableMember
                                key={member.id}
                                id={member.id}
                                name={member.name}
                                avatars={member.avatars}
                            />
                        ))}
                    </SortableContext>
                    {members.length === 0 && (
                        <div className="text-center text-card-light-foreground/40 py-4 text-sm">
                            Drop members here
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
