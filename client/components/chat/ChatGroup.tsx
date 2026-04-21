import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ChatGroupProps {
    name: string;
    avatars: string[];
    preview?: string;
    isActive?: boolean;
    onClick?: () => void;
}

export function ChatGroup({ name, avatars, preview, isActive, onClick }: ChatGroupProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
                isActive
                    ? "bg-primary text-primary-foreground"
                    : "light-card hover:shadow-md"
            )}
        >
            <div className="flex -space-x-2">
                {avatars.slice(0, 3).map((avatar, i) => (
                    <Avatar key={i} className="h-10 w-10 border-2 border-background">
                        <AvatarImage src={avatar} />
                        <AvatarFallback>{name[0]}</AvatarFallback>
                    </Avatar>
                ))}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className={cn(
                    "font-medium truncate",
                    isActive ? "text-primary-foreground" : "text-card-light-foreground"
                )}>
                    {name}
                </h4>
                {preview && (
                    <p className={cn(
                        "text-sm truncate",
                        isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}>
                        {preview}
                    </p>
                )}
            </div>
        </div>
    );
}