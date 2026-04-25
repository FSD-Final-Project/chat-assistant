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
                "light-card flex flex-col items-center rounded-2xl p-4 animate-scale-in transition-transform hover:scale-[1.02] sm:p-5",
                className
            )}
            style={style}
        >
            <h2 className="mb-3 text-3xl font-bold text-primary sm:text-4xl">{messageCount}</h2>
            {description && (
                <div className="mb-3 w-full text-left text-[11px] text-card-light-foreground/70 sm:text-xs">
                    <p className="mb-1 font-medium">Key characteristics</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li className="truncate">{description}</li>
                    </ul>
                </div>
            )}
            <Avatar className="h-16 w-16 border-4 border-primary/20 sm:h-20 sm:w-20">
                <AvatarImage src={avatar} className="object-cover" />
                <AvatarFallback className="text-lg sm:text-xl">{name[0]}</AvatarFallback>
            </Avatar>
            <p className="mt-3 text-center text-xs font-medium text-card-light-foreground sm:text-sm">
                {name} - {messageCount} messages
            </p>
        </div>
    );
}
