import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GripVertical } from "lucide-react";

interface DraggableMemberProps {
    id: string;
    name: string;
    avatars: string[];
}

export function DraggableMember({ id, name, avatars }: DraggableMemberProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 bg-card-light/50 rounded-lg p-2 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
        >
            <GripVertical className="h-4 w-4 text-card-light-foreground/40" />
            <div className="flex -space-x-2">
                {avatars.slice(0, 2).map((avatar, i) => (
                    <Avatar key={i} className="h-10 w-10 border-2 border-card-light">
                        <AvatarImage src={avatar} />
                        <AvatarFallback>{name[0]}</AvatarFallback>
                    </Avatar>
                ))}
            </div>
            <span className="text-sm text-card-light-foreground">{name}</span>
        </div>
    );
}
