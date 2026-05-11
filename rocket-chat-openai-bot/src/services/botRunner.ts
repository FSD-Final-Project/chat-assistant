import type { BotActivationPreferences, BotConfig, ManagedSubscription, RocketChatAuth } from "../types/bot.js";
import type { RocketChatMessage } from "../types/rocketchat.js";
import { RocketChatAuthError, RocketChatClient } from "../clients/rocketChatClient.js";
import { RocketChatRealtimeClient } from "../clients/rocketChatRealtimeClient.js";
import { BotState } from "../state/botState.js";
import { sleep } from "../utils/sleep.js";
import { BotContextStore } from "./botContextStore.js";
import { BotNotificationStore } from "./botNotificationStore.js";
import { ReplyService } from "./replyService.js";
import { SubscriptionPreferenceStore } from "./subscriptionPreferenceStore.js";

export class BotRunner {
  private readonly state = new BotState();
  private readonly knownSubscriptionsByRoomId = new Map<string, ManagedSubscription>();
  private refreshSubscriptionsPromise: Promise<ManagedSubscription[]> | null = null;

  constructor(
    private readonly config: BotConfig,
    private readonly auth: RocketChatAuth,
    private readonly rocketChatClient: RocketChatClient,
    private readonly rocketChatRealtimeClient: RocketChatRealtimeClient,
    private readonly replyService: ReplyService,
    private readonly subscriptionPreferenceStore: SubscriptionPreferenceStore,
    private readonly botNotificationStore: BotNotificationStore,
    private readonly botContextStore: BotContextStore,
    private readonly disconnectAuth: () => Promise<void>
  ) {}

  async start(): Promise<void> {
    this.state.userId = this.rocketChatClient.currentUserId;
    console.log(
      `Using Rocket.Chat token auth for '${this.rocketChatClient.identityLabel}' (userId=${this.state.userId})`,
    );

    let settings = await this.subscriptionPreferenceStore.loadManagedSubscriptionSettings(this.auth);
    let subscriptions = settings.subscriptions;
    this.rememberSubscriptions(subscriptions);
    if (subscriptions.length === 0) {
      console.log(
        `[${this.rocketChatClient.identityLabel}] No managed subscriptions found. Listening for new Rocket.Chat subscriptions.`,
      );
    }

    while (true) {
      try {
        await this.rocketChatRealtimeClient.run(
          subscriptions,
          async (subscription, message) => {
            await this.processMessage(subscription, message);
          },
          async () => this.handleSubscriptionsChanged(),
        );
      } catch (error) {
        if (error instanceof RocketChatAuthError) {
          await this.handleAuthError(error);
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[${this.rocketChatClient.identityLabel}] Realtime listener error: ${message}`,
        );
      }

      settings = await this.subscriptionPreferenceStore.loadManagedSubscriptionSettings(this.auth);
      subscriptions = settings.subscriptions;
      this.rememberSubscriptions(subscriptions);
      await sleep(this.config.rcRetryBackoffMs);
    }
  }

  private async handleAuthError(error: RocketChatAuthError): Promise<void> {
    console.error(
      `[${this.rocketChatClient.identityLabel}] Rocket.Chat auth failed (${error.status}). Disconnecting stored integration.`
    );

    try {
      await this.disconnectAuth();
      console.log(
        `[${this.rocketChatClient.identityLabel}] Removed stored Rocket.Chat credentials after auth failure.`
      );
    } catch (disconnectError) {
      const message =
        disconnectError instanceof Error ? disconnectError.message : String(disconnectError);
      console.error(
        `[${this.rocketChatClient.identityLabel}] Failed to remove stored Rocket.Chat credentials: ${message}`
      );
    }
  }

  private async processMessage(
    subscription: ManagedSubscription,
    message: RocketChatMessage,
  ): Promise<void> {
    if (!message._id || this.state.isProcessed(message._id)) {
      return;
    }

    const settings = await this.subscriptionPreferenceStore.loadManagedSubscriptionSettings(this.auth);
    const activeSubscription =
      settings.subscriptions.find((candidate) => candidate.roomId === subscription.roomId) ?? subscription;

    if (!this.shouldRespondToMessage(message) || !this.isWithinActivationPreferences(settings.botActivationPreferences)) {
      this.state.markProcessed(message._id);
      return;
    }

    const incomingText = (message.msg ?? "").trim();
    const senderName = message.u?.username ?? message.u?._id ?? activeSubscription.roomId;
    const shouldCreateNotification = activeSubscription.preferenceColor !== "green";

    try {
      if (shouldCreateNotification) {
        await this.botNotificationStore.createNotification({
          auth: this.auth,
          roomId: activeSubscription.roomId,
          roomType: activeSubscription.roomType,
          subscriptionId: activeSubscription.id,
          messageId: message._id,
          preferenceColor: activeSubscription.preferenceColor,
          kind: activeSubscription.preferenceColor === "yellow" ? "approval" : "info",
          senderName,
          senderUsername: message.u?.username,
          incomingText,
        });
      }

      const contextPayload = await this.botContextStore.loadContextForMessage(
        this.auth,
        activeSubscription.roomId,
        activeSubscription.roomType,
        activeSubscription.id,
        message,
        await this.replyService.embedText(incomingText),
      );

      console.log(
        `[${activeSubscription.roomId}] ${contextPayload.subscription.preferenceColor.toUpperCase()} User: ${incomingText}`,
      );

      const suggestedReply = contextPayload.suggestedReply || "I'm sorry, I couldn't generate a suggestion.";

      if (contextPayload.subscription.preferenceColor === "green") {
        await this.botNotificationStore.postMessage({
          auth: this.auth,
          roomId: activeSubscription.roomId,
          text: suggestedReply,
        });
        
        await this.botNotificationStore.saveSuggestion({
          auth: this.auth,
          roomId: activeSubscription.roomId,
          messageId: message._id,
          suggestion: suggestedReply,
        });
        await this.updateSummary(activeSubscription, message._id, incomingText, suggestedReply, contextPayload.currentSummary?.summary);
        console.log(`[${activeSubscription.roomId}] Bot: ${suggestedReply}`);
      } else {
        await this.updateSummary(activeSubscription, message._id, incomingText, undefined, contextPayload.currentSummary?.summary);
        await this.botNotificationStore.createNotification({
          auth: this.auth,
          roomId: activeSubscription.roomId,
          roomType: activeSubscription.roomType,
          subscriptionId: activeSubscription.id,
          messageId: message._id,
          preferenceColor: contextPayload.subscription.preferenceColor,
          kind:
            contextPayload.subscription.preferenceColor === "yellow" ? "approval" : "info",
          senderName,
          senderUsername: message.u?.username,
          incomingText,
          suggestedReply,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${activeSubscription.roomId}] Failed to handle message: ${errorMessage}`);
      if (activeSubscription.preferenceColor === "green") {
        await this.botNotificationStore.postMessage({
          auth: this.auth,
          roomId: activeSubscription.roomId,
          text: "I hit an internal error while generating a reply. Please try again.",
        });
      }
    } finally {
      this.state.markProcessed(message._id);
    }
  }

  private async updateSummary(
    subscription: ManagedSubscription,
    messageId: string,
    incomingText: string,
    assistantReply: string | undefined,
    currentSummary: string | undefined,
  ): Promise<void> {
    const revisedSummary = await this.replyService.reviseSummary({
      currentSummary,
      incomingText,
      assistantReply,
    });
    const embedding = await this.replyService.embedText(revisedSummary);
    await this.botContextStore.saveSummary({
      auth: this.auth,
      subscription,
      summary: revisedSummary,
      embedding,
      lastMessageId: messageId,
      sourceMessageCount: undefined,
      source: "bot",
    });
  }


  private async handleSubscriptionsChanged(): Promise<ManagedSubscription[]> {
    if (this.refreshSubscriptionsPromise) {
      return this.refreshSubscriptionsPromise;
    }

    this.refreshSubscriptionsPromise = this.refreshSubscriptionsAfterRocketChange()
      .finally(() => {
        this.refreshSubscriptionsPromise = null;
      });

    return this.refreshSubscriptionsPromise;
  }

  private async refreshSubscriptionsAfterRocketChange(): Promise<ManagedSubscription[]> {
    console.log(
      `[${this.rocketChatClient.identityLabel}] Rocket.Chat subscription change detected. Triggering worker sync.`,
    );

    await this.subscriptionPreferenceStore.triggerWorkerSync(this.auth);
    const settings = await this.subscriptionPreferenceStore.loadManagedSubscriptionSettings(this.auth);
    const newSubscriptions = settings.subscriptions.filter(
      (subscription) => !this.knownSubscriptionsByRoomId.has(subscription.roomId),
    );

    this.rememberSubscriptions(settings.subscriptions);

    for (const subscription of newSubscriptions) {
      await this.processRecentMessagesForNewSubscription(subscription);
    }

    return settings.subscriptions;
  }

  private async processRecentMessagesForNewSubscription(subscription: ManagedSubscription): Promise<void> {
    const messages = await this.rocketChatClient.getRoomMessages(
      subscription.roomId,
      subscription.roomType,
      undefined,
      10,
    );

    const latestMessage = [...messages]
      .reverse()
      .find((message) => message.u?._id !== this.state.userId && typeof message.msg === "string" && message.msg.trim());

    if (latestMessage) {
      await this.processMessage(subscription, latestMessage);
    }
  }

  private rememberSubscriptions(subscriptions: ManagedSubscription[]): void {
    for (const subscription of subscriptions) {
      this.knownSubscriptionsByRoomId.set(subscription.roomId, subscription);
    }
  }

  private shouldRespondToMessage(message: RocketChatMessage): boolean {
    if (!message._id) return false;
    if (message.u?._id === this.state.userId) return false;
    if (typeof message.msg !== "string") return false;

    const text = message.msg.trim();
    if (!text) return false;

    if (this.config.botTriggerPrefix) {
      return text.startsWith(this.config.botTriggerPrefix);
    }

    return true;
  }

  private isWithinActivationPreferences(preferences: BotActivationPreferences): boolean {
    const now = new Date();

    if (preferences.dateEnabled) {
      const currentDate = this.formatLocalDate(now);
      if (!preferences.startDate || !preferences.endDate) {
        return false;
      }

      if (currentDate < preferences.startDate || currentDate > preferences.endDate) {
        return false;
      }
    }

    if (preferences.timeEnabled) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = this.parseTimeToMinutes(preferences.startTime);
      const endMinutes = this.parseTimeToMinutes(preferences.endTime);

      if (startMinutes === null || endMinutes === null) {
        return false;
      }

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      }

      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    return true;
  }

  private parseTimeToMinutes(value: string): number | null {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) {
      return null;
    }

    const [, hours, minutes] = match;
    if (!hours || !minutes) {
      return null;
    }

    return Number.parseInt(hours, 10) * 60 + Number.parseInt(minutes, 10);
  }

  private formatLocalDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
