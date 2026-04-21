import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ActiveChatCardProps {
    name: string;
    avatar: string;
    messageCount: number;
    description?: string;
    className?: string;
    style?: React.CSSProperties;
}

export function ActiveChatCard({ name, avatar, messageCount, description, className, style }: ActiveChatCardProps) {
    return (
        <div
            className={cn(
                "light-card rounded-2xl p-6 flex flex-col items-center animate-scale-in transition-transform hover:scale-105",
                className
            )}
            style={style}
        >
            <h2 className="text-5xl font-bold text-primary mb-4">{messageCount}</h2>
            {description && (
                <div className="text-xs text-card-light-foreground/70 mb-4 text-left w-full">
                    <p className="font-medium mb-1">Key characteristics</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li className="truncate">{description}</li>
                    </ul>
                </div>
            )}
            <Avatar className="h-24 w-24 border-4 border-primary/20">
                <AvatarImage src={avatar} className="object-cover" />
                <AvatarFallback className="text-2xl">{name[0]}</AvatarFallback>
            </Avatar>
            <p className="mt-3 text-sm font-medium text-card-light-foreground">
                {name} - {messageCount} messages
            </p>
        </div>
    );
}
