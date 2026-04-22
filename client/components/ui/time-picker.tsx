import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimePickerProps {
    value?: string;
    onChange?: (time: string) => void;
    className?: string;
}

export function TimePicker({ value = "12:00", onChange, className }: TimePickerProps) {
    const [open, setOpen] = React.useState(false);

    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
    const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

    const [selectedHour, selectedMinute] = value.split(":");

    const handleTimeSelect = (hour: string, minute: string) => {
        onChange?.(`${hour}:${minute}`);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "flex items-center gap-2 text-sm bg-white rounded-full px-3 py-1 h-auto border-border text-card-light-foreground hover:bg-muted",
                        className
                    )}
                >
                    <Clock className="h-4 w-4" />
                    <span>{value}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover border-border z-50" align="start">
                <div className="flex">
                    <ScrollArea className="h-48 w-16 border-r border-border">
                        <div className="p-2">
                            {hours.map((hour) => (
                                <button
                                    key={hour}
                                    onClick={() => handleTimeSelect(hour, selectedMinute)}
                                    className={cn(
                                        "w-full px-2 py-1 text-sm rounded hover:bg-muted text-left",
                                        selectedHour === hour && "bg-primary text-primary-foreground"
                                    )}
                                >
                                    {hour}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                    <ScrollArea className="h-48 w-16">
                        <div className="p-2">
                            {minutes.map((minute) => (
                                <button
                                    key={minute}
                                    onClick={() => {
                                        handleTimeSelect(selectedHour, minute);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "w-full px-2 py-1 text-sm rounded hover:bg-muted text-left",
                                        selectedMinute === minute && "bg-primary text-primary-foreground"
                                    )}
                                >
                                    {minute}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </PopoverContent>
        </Popover>
    );
}