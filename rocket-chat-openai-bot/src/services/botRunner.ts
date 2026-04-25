import type { BotConfig, ManagedSubscription, RocketChatAuth } from "../types/bot.js";
import type { RocketChatMessage } from "../types/rocketchat.js";
import { RocketChatClient } from "../clients/rocketChatClient.js";
import { BotState } from "../state/botState.js";
import { sleep } from "../utils/sleep.js";
import { BotNotificationStore } from "./botNotificationStore.js";
import { ReplyService } from "./replyService.js";
import { SubscriptionPreferenceStore } from "./subscriptionPreferenceStore.js";

export class BotRunner {
  private readonly state = new BotState();
  private readonly startedAt = new Date();
  private readonly roomWatermarks = new Map<string, Date>();

  constructor(
    private readonly config: BotConfig,
    private readonly auth: RocketChatAuth,
    private readonly rocketChatClient: RocketChatClient,
    private readonly replyService: ReplyService,
    private readonly subscriptionPreferenceStore: SubscriptionPreferenceStore,
    private readonly botNotificationStore: BotNotificationStore
  ) {}

  async start(): Promise<void> {
    this.initializeAuth();
    console.log(`Starting poll loop (${this.config.pollIntervalMs} ms)`);
    await this.runLoop();
  }

  private initializeAuth(): void {
    this.state.userId = this.rocketChatClient.currentUserId;
    console.log(
      `Using Rocket.Chat token auth for '${this.rocketChatClient.identityLabel}' (userId=${this.state.userId})`
    );
  }

  private async runLoop(): Promise<void> {
    while (true) {
      try {
        const subscriptions =
          await this.subscriptionPreferenceStore.loadManagedSubscriptions(this.auth);
        for (const subscription of subscriptions) {
          await this.processSubscription(subscription);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Polling error: ${message}`);
      }

      await sleep(this.config.pollIntervalMs);
    }
  }

  private async processSubscription(subscription: ManagedSubscription): Promise<void> {
    const oldest = this.roomWatermarks.get(subscription.roomId) ?? this.startedAt;
    const messages = await this.rocketChatClient.getRoomMessages(
      subscription.roomId,
      subscription.roomType,
      oldest
    );

    for (const message of messages) {
      await this.processMessage(subscription, message);
      const timestamp = this.getMessageDate(message);
      if (timestamp) {
        this.roomWatermarks.set(subscription.roomId, timestamp);
      }
    }
  }

  private async processMessage(
    subscription: ManagedSubscription,
    message: RocketChatMessage
  ): Promise<void> {
    if (!message._id) {
      return;
    }

    if (!this.shouldRespondToMessage(message)) {
      this.state.markProcessed(message._id);
      return;
    }

    try {
      const userText = (message.msg ?? "").trim();
      const senderName = message.u?.username ?? message.u?._id ?? subscription.roomId;
      console.log(
        `[${subscription.roomId}] ${subscription.preferenceColor.toUpperCase()} User: ${userText}`
      );

      if (subscription.preferenceColor === "green") {
        const reply = await this.replyService.generateReply(subscription.roomId, userText);
        await this.rocketChatClient.postMessage(subscription.roomId, reply);
        console.log(`[${subscription.roomId}] Bot: ${reply}`);
      } else if (subscription.preferenceColor === "yellow") {
        const suggestedReply = await this.replyService.generateReply(
          subscription.roomId,
          userText,
          { commitToContext: false }
        );
        await this.botNotificationStore.createNotification({
          auth: this.auth,
          roomId: subscription.roomId,
          roomType: subscription.roomType,
          subscriptionId: subscription.id,
          messageId: message._id,
          preferenceColor: subscription.preferenceColor,
          kind: "approval",
          senderName,
          senderUsername: message.u?.username,
          incomingText: userText,
          suggestedReply,
        });
      } else {
        await this.botNotificationStore.createNotification({
          auth: this.auth,
          roomId: subscription.roomId,
          roomType: subscription.roomType,
          subscriptionId: subscription.id,
          messageId: message._id,
          preferenceColor: subscription.preferenceColor,
          kind: "info",
          senderName,
          senderUsername: message.u?.username,
          incomingText: userText,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${subscription.roomId}] Failed to handle message: ${errorMessage}`);
      if (subscription.preferenceColor === "green") {
        await this.rocketChatClient.postMessage(
          subscription.roomId,
          "I hit an internal error while generating a reply. Please try again."
        );
      }
    } finally {
      this.state.markProcessed(message._id);
    }
  }

  private shouldRespondToMessage(message: RocketChatMessage): boolean {
    if (!message._id) return false;
    if (this.state.isProcessed(message._id)) return false;
    if (message.u?._id === this.state.userId) return false;
    if (typeof message.msg !== "string") return false;

    const text = message.msg.trim();
    if (!text) return false;

    if (this.config.botTriggerPrefix) {
      return text.startsWith(this.config.botTriggerPrefix);
    }

    return true;
  }

  private getMessageDate(message: RocketChatMessage): Date | null {
    if (!message.ts) {
      return null;
    }

    if (typeof message.ts === "string") {
      const parsed = new Date(message.ts);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof message.ts.$date === "number") {
      return new Date(message.ts.$date);
    }

    return null;
  }
}
