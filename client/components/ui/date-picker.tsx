import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calender";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
    value?: Date;
    onChange?: (date: Date | undefined) => void;
    className?: string;
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
    const [open, setOpen] = React.useState(false);

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
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <span>{value ? format(value, "d MMMM yyyy") : "Pick a date"}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover border-border z-50" align="start">
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={(date) => {
                        onChange?.(date);
                        setOpen(false);
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                />
            </PopoverContent>
        </Popover>
    );
}
