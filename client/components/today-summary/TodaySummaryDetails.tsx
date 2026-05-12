import { MessageSquare, Bot, Loader2 } from "lucide-react";
import { useTodaySummaryStyles } from "../../pages/TodaySummery.styles";

interface TodaySummaryDetailsProps {
    activeChatId: string | null;
    isLoadingSubscriptions: boolean;
}

export function TodaySummaryDetails({
    activeChatId,
    isLoadingSubscriptions,
}: TodaySummaryDetailsProps) {
    const styles = useTodaySummaryStyles();

    if (!activeChatId) {
        return (
            <div className={styles.emptyState}>
                {isLoadingSubscriptions ? (
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                ) : (
                    <MessageSquare className="w-8 h-8 opacity-20" />
                )}
                <p>{isLoadingSubscriptions ? "Loading chats..." : "Select a chat to view details"}</p>
            </div>
        );
    }

    return (
        <div className={styles.detailsContainer}>
            <div className={styles.summaryCard}>
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <h4 className={styles.summaryHeader}>
                    <Bot className="w-4 h-4" />
                    AI Summary
                    <span className={styles.developmentBadge}>Under development</span>
                </h4>
                <p className={styles.summaryText}>
                    This is a simulated AI summary. The backend does not currently have a summarization endpoint for the entire room, but if it did, the summary would appear here based on the latest context.
                </p>
            </div>
        </div>
    );
}
