import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GripVertical, Hash, MessageCircle, Users } from "lucide-react";

interface DraggableMemberProps {
    id: string;
    name: string;
    avatars: string[];
    roomType?: string;
}

function RoomTypeIcon({ roomType }: { roomType?: string }) {
    if (roomType === "d") {
        return <MessageCircle className="h-3.5 w-3.5 text-card-light-foreground/85" />;
    }

    if (roomType === "p") {
        return <Users className="h-3.5 w-3.5 text-card-light-foreground/85" />;
    }

    if (roomType === "c") {
        return <Hash className="h-3.5 w-3.5 text-card-light-foreground/85" />;
    }

    return null;
}

export function DraggableMember({ id, name, avatars, roomType }: DraggableMemberProps) {
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
            className="flex min-w-0 items-center gap-3 rounded-lg bg-card-light/50 p-2 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
        >
            <GripVertical className="h-4 w-4 shrink-0 text-card-light-foreground/40" />
            <div className="flex shrink-0 -space-x-2">
                {avatars.slice(0, 2).map((avatar, i) => (
                    <Avatar key={i} className="h-10 w-10 border-2 border-card-light">
                        <AvatarImage src={avatar} />
                        <AvatarFallback seed={name}>{name[0]}</AvatarFallback>
                    </Avatar>
                ))}
            </div>
            <div className="-ml-1 shrink-0 rounded-full bg-card-light/90 px-1.5 py-1">
                <RoomTypeIcon roomType={roomType} />
            </div>
            <span className="min-w-0 flex-1 truncate text-sm text-card-light-foreground">
                {name}
            </span>
        </div>
    );
}

export { RoomTypeIcon };
