import { useEffect, useRef } from "react";
import { MessageSquare, Sparkles, Bot, Loader2 } from "lucide-react";
import { makeStyles } from "../../pages/TodaySummery.styles";

interface TodaySummaryDetailsProps {
    activeChatId: string | null;
    isLoadingSubscriptions: boolean;
    isLoadingMessages: boolean;
    sortedMessages: any[];
    isLoadingSuggestion: boolean;
    suggestion: string | null;
    user: any;
    myRocketUserId?: string;
    onSendSuggestion: (text: string) => Promise<void>;
    isSendingSuggestion: boolean;
    roomSummary: string | null;
    isLoadingSummary: boolean;
}

export function TodaySummaryDetails({
    activeChatId,
    isLoadingSubscriptions,
    isLoadingMessages,
    sortedMessages,
    isLoadingSuggestion,
    suggestion,
    user,
    myRocketUserId,
    onSendSuggestion,
    isSendingSuggestion,
    roomSummary,
    isLoadingSummary
}: TodaySummaryDetailsProps) {
    const styles = makeStyles();
    const listRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        if (!isLoadingMessages) {
            scrollToBottom();
        }
    }, [sortedMessages, isLoadingMessages, activeChatId]);

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
            {/* Left: Recent Messages */}
            <div className={styles.messagesSection}>
                <h3 className={styles.sectionTitle}>
                    <MessageSquare className="w-5 h-5 text-primary" />
                    Recent Messages
                </h3>
                <div className={styles.messagesList} ref={listRef}>
                    {isLoadingMessages ? (
                        <div className="flex justify-center items-center h-32">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : sortedMessages.length > 0 ? (
                        sortedMessages.map((msg: any) => {
                            const isMe = msg.payload?.u?._id === myRocketUserId;
                            const senderName = msg.payload?.u?.username || msg.payload?.u?.name || "Unknown";
                            const content = msg.payload?.msg || "";
                            const date = new Date(msg.payload?.ts?.$date || msg.payload?.ts);
                            const timestamp = isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return (
                                <div key={msg.messageId || msg._id} className={styles.messageWrapper(isMe)}>
                                    <div className={styles.messageBubble(isMe)}>
                                        {!isMe && <span className={styles.messageSender}>{senderName}</span>}
                                        <p>{content}</p>
                                        <span className={styles.messageTime}>{timestamp}</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center text-muted-foreground mt-4 text-sm">
                            No recent messages in this chat.
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Summary & Suggestions */}
            <div className={styles.sidebarSection}>
                {/* Summary Card */}
                <div className={styles.summaryCard}>
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <h4 className={styles.summaryHeader}>
                        <Bot className="w-4 h-4" />
                        AI Summary
                    </h4>
                    <p className={styles.summaryText}>
                        {isLoadingSummary ? (
                            <span className="flex items-center gap-2 italic text-muted-foreground">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Generating summary...
                            </span>
                        ) : roomSummary ? (
                            roomSummary
                        ) : (
                            "No summary available for this chat yet. The background worker will generate one soon."
                        )}
                    </p>
                </div>

                {/* Suggestions */}
                <div className={styles.suggestionsContainer}>
                    <h4 className={styles.suggestionTitle}>
                        <Sparkles className="w-4 h-4 text-yellow-500" />
                        Auto-Reply Suggestions
                    </h4>
                    {isLoadingSuggestion ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-2" />
                    ) : suggestion ? (
                        <div className={styles.suggestionChips}>
                            <button 
                                className={styles.suggestionChip}
                                onClick={() => onSendSuggestion(suggestion)}
                                disabled={isSendingSuggestion}
                            >
                                {isSendingSuggestion ? (
                                    <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                                ) : null}
                                {suggestion}
                            </button>
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground">
                            No suggestions available right now.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
