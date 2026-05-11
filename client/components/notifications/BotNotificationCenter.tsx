import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, Edit3, Send, X } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface BotNotificationItem {
    id: string;
    roomId: string;
    roomType?: string;
    preferenceColor: "red" | "yellow" | "green";
    kind: "approval" | "info";
    senderName?: string;
    senderUsername?: string;
    incomingText: string;
    suggestedReply?: string;
    createdAt?: string;
}

interface BotNotificationsResponse {
    notifications: BotNotificationItem[];
}

const colorAccentClass: Record<BotNotificationItem["preferenceColor"], string> = {
    green: "border-l-chart-green",
    yellow: "border-l-chart-yellow",
    red: "border-l-chart-red",
};

export function BotNotificationCenter() {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<BotNotificationItem[]>([]);
    const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);
    const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const seenNotificationIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!isAuthenticated || typeof window === "undefined" || !("Notification" in window)) {
            return;
        }

        if (window.Notification.permission === "default") {
            void window.Notification.requestPermission();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) {
            setNotifications([]);
            setEditingNotificationId(null);
            setDraftReplies({});
            return;
        }

        const eventSource = new window.EventSource("/users/me/bot-notifications/stream", {
            withCredentials: true,
        });

        eventSource.addEventListener("notifications", (event) => {
            const payload = JSON.parse((event as MessageEvent<string>).data) as BotNotificationsResponse;
            const nextNotifications = payload.notifications ?? [];

            setNotifications(nextNotifications);
            setDraftReplies((prev) => {
                const nextDrafts = { ...prev };
                for (const notification of nextNotifications) {
                    if (notification.kind === "approval" && nextDrafts[notification.id] === undefined) {
                        nextDrafts[notification.id] = notification.suggestedReply ?? "";
                    }
                }
                return nextDrafts;
            });

            for (const notification of nextNotifications) {
                if (!seenNotificationIds.current.has(notification.id)) {
                    seenNotificationIds.current.add(notification.id);
                    thisWindowNotification(notification, () => {
                        window.focus();
                        setEditingNotificationId(
                            notification.kind === "approval" ? notification.id : null
                        );
                    });
                }
            }
        });

        eventSource.onerror = () => {
            if (eventSource.readyState === window.EventSource.CLOSED) {
                toast({
                    title: "Notification stream disconnected",
                    description: "The app will reconnect when the server is available again.",
                    variant: "destructive",
                });
            }
        };

        return () => {
            eventSource.close();
        };
    }, [isAuthenticated]);

    const visibleNotifications = useMemo(
        () => notifications.slice().sort((left, right) => {
            const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
            const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
            return rightTime - leftTime;
        }),
        [notifications]
    );

    const toggleExpandedSection = (key: string) => {
        setExpandedSections((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const dismissNotification = async (notificationId: string) => {
        try {
            const response = await fetch(
                `/users/me/bot-notifications/${encodeURIComponent(notificationId)}/dismiss`,
                {
                    method: "POST",
                    credentials: "include",
                }
            );
            const payload = (await response.json()) as { message?: string };
            if (!response.ok) {
                throw new Error(payload.message ?? "Failed to dismiss notification");
            }

            setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
            setEditingNotificationId((prev) => (prev === notificationId ? null : prev));
        } catch (error) {
            toast({
                title: "Failed to dismiss notification",
                description:
                    error instanceof Error ? error.message : "Failed to dismiss notification",
                variant: "destructive",
            });
        }
    };

    const approveNotification = async (notificationId: string) => {
        const replyText = draftReplies[notificationId]?.trim();
        if (!replyText) {
            toast({
                title: "Reply is required",
                description: "Enter or keep a reply before sending it.",
                variant: "destructive",
            });
            return;
        }

        try {
            const response = await fetch(
                `/users/me/bot-notifications/${encodeURIComponent(notificationId)}/approve`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ replyText }),
                }
            );

            const payload = (await response.json()) as { message?: string };
            if (!response.ok) {
                throw new Error(payload.message ?? "Failed to approve notification");
            }

            setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
            setEditingNotificationId((prev) => (prev === notificationId ? null : prev));
            toast({
                title: "Reply sent",
                description: "The approved message was sent to Rocket.Chat.",
            });
        } catch (error) {
            toast({
                title: "Failed to send reply",
                description: error instanceof Error ? error.message : "Failed to send reply",
                variant: "destructive",
            });
        }
    };

    if (!isAuthenticated || visibleNotifications.length === 0) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
            {visibleNotifications.map((notification) => {
                const isEditing = editingNotificationId === notification.id;
                return (
                    <div
                        key={notification.id}
                        className={`pointer-events-auto rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur-sm border-l-4 ${colorAccentClass[notification.preferenceColor]}`}
                    >
                        <div className="mb-3 flex items-start gap-3">
                            <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                                <Bell className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">
                                    {notification.senderName ?? notification.senderUsername ?? "Rocket.Chat"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {notification.kind === "approval"
                                        ? "Approval required before sending a reply"
                                        : "Informational alert from a red subscription"}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void dismissNotification(notification.id)}
                                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="rounded-xl bg-muted/50 p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Incoming message</p>
                            <ExpandableText
                                text={notification.incomingText}
                                expanded={Boolean(expandedSections[`${notification.id}:incoming`])}
                                onToggle={() => toggleExpandedSection(`${notification.id}:incoming`)}
                            />
                        </div>

                        {notification.suggestedReply ? (
                            <div className="mt-3 rounded-xl bg-primary/5 p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                    Suggested reply
                                </p>
                                <ExpandableText
                                    text={
                                        draftReplies[notification.id] ??
                                        notification.suggestedReply ??
                                        ""
                                    }
                                    expanded={Boolean(expandedSections[`${notification.id}:reply`])}
                                    onToggle={() => toggleExpandedSection(`${notification.id}:reply`)}
                                />
                            </div>
                        ) : null}

                        {notification.kind === "approval" && (
                            <div className="mt-3 space-y-3">
                                {isEditing ? (
                                    <textarea
                                        value={draftReplies[notification.id] ?? ""}
                                        onChange={(event) =>
                                            setDraftReplies((prev) => ({
                                                ...prev,
                                                [notification.id]: event.target.value,
                                            }))
                                        }
                                        className="min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    />
                                ) : null}

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => void approveNotification(notification.id)}
                                    >
                                        <Check className="h-4 w-4" />
                                        Send
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            setEditingNotificationId((prev) =>
                                                prev === notification.id ? null : notification.id
                                            )
                                        }
                                    >
                                        {isEditing ? <Send className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                                        {isEditing ? "Close editor" : "Edit reply"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ExpandableText({
    text,
    expanded,
    onToggle,
}: {
    text: string;
    expanded: boolean;
    onToggle: () => void;
}) {
    const isLong = text.length > 180 || text.split(/\r?\n/).length > 4;

    return (
        <div className="mt-1">
            <p
                className={
                    expanded
                        ? "whitespace-pre-wrap break-words text-sm text-foreground"
                        : "max-h-[4.5rem] overflow-hidden text-ellipsis whitespace-pre-wrap break-words text-sm text-foreground"
                }
            >
                {text}
            </p>
            {isLong && (
                <button
                    type="button"
                    onClick={onToggle}
                    className="mt-2 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                    {expanded ? "Read less" : "Read more"}
                </button>
            )}
        </div>
    );
}

function thisWindowNotification(notification: BotNotificationItem, onClick: () => void) {
    if (typeof window === "undefined" || !("Notification" in window)) {
        return;
    }

    if (window.Notification.permission !== "granted") {
        return;
    }

    const browserNotification = new window.Notification(
        notification.senderName ?? notification.senderUsername ?? "Rocket.Chat",
        {
            body:
                notification.suggestedReply
                    ? `${notification.incomingText}\nSuggested reply available`
                    : notification.incomingText,
            tag: notification.id,
        }
    );

    browserNotification.onclick = () => {
        onClick();
        browserNotification.close();
    };
}
