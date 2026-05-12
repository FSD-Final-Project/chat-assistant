import { useMemo } from "react";
import { cn } from "@/lib/utils";

export const useTodaySummaryStyles = () => {
    return useMemo(() => ({
        // Detailed View Container
        detailsContainer: cn(
            "glass-card rounded-2xl p-6 animate-fade-in lg:col-span-2",
            "flex flex-col"
        ),
        
        // Messages Section
        messagesSection: cn("flex-1 flex flex-col gap-4 border-r border-border/50 pr-6"),
        sectionTitle: cn("text-lg font-semibold flex items-center gap-2 mb-2 text-foreground"),
        messagesList: cn("flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2"),
        
        // Individual Message
        messageWrapper: (isMe: boolean) => cn(
            "flex w-full",
            isMe ? "justify-end" : "justify-start"
        ),
        messageBubble: (isMe: boolean) => cn(
            "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm relative",
            isMe 
                ? "bg-primary text-primary-foreground rounded-tr-sm" 
                : "bg-muted text-foreground rounded-tl-sm"
        ),
        messageSender: cn("text-[10px] font-medium opacity-70 mb-1 block"),
        messageTime: cn("text-[10px] opacity-60 mt-1 block text-right"),

        // Right Sidebar (Summary & Suggestions)
        sidebarSection: cn("w-full lg:w-[350px] flex flex-col gap-6"),
        
        // Summary Card
        summaryCard: cn(
            "w-full p-5 rounded-xl bg-card border border-border/50",
            "shadow-sm relative overflow-hidden"
        ),
        summaryHeader: cn("text-sm font-semibold text-primary mb-2 flex items-center gap-2"),
        developmentBadge: cn(
            "ml-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5",
            "text-[10px] font-medium uppercase tracking-wide text-primary"
        ),
        summaryText: cn("text-sm text-card-foreground leading-relaxed"),
        
        // Suggestions
        suggestionsContainer: cn("flex flex-col gap-3"),
        suggestionTitle: cn("text-sm font-medium text-muted-foreground flex items-center gap-2"),
        suggestionChips: cn("flex flex-wrap gap-2"),
        suggestionChip: cn(
            "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            "border border-border/50 cursor-pointer hover:shadow-sm"
        ),
        
        // Empty State
        emptyState: cn("lg:col-span-2 glass-card rounded-2xl flex flex-col items-center justify-center text-center p-8 text-muted-foreground gap-3")
    }), []);
};
