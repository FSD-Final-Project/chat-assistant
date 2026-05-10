import type { BotConfig, ManagedSubscription, RocketChatAuth } from "../types/bot.js";
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

    let subscriptions =
      await this.subscriptionPreferenceStore.loadManagedSubscriptions(this.auth);
    if (subscriptions.length === 0) {
      console.log(
        `[${this.rocketChatClient.identityLabel}] No managed subscriptions found. Realtime listener not started.`,
      );
      return;
    }

    while (true) {
      try {
        await this.rocketChatRealtimeClient.run(subscriptions, async (subscription, message) => {
          await this.processMessage(subscription, message);
        });
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

      subscriptions = await this.subscriptionPreferenceStore.loadManagedSubscriptions(this.auth);
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

    if (!this.shouldRespondToMessage(message)) {
      this.state.markProcessed(message._id);
      return;
    }

    try {
      const contextPayload = await this.botContextStore.loadContextForMessage(
        this.auth,
        subscription.roomId,
        subscription.roomType,
        subscription.id,
        message,
      );

      const incomingText = (message.msg ?? "").trim();
      const senderName = message.u?.username ?? message.u?._id ?? subscription.roomId;
      console.log(
        `[${subscription.roomId}] ${contextPayload.subscription.preferenceColor.toUpperCase()} User: ${incomingText}`,
      );

      const suggestedReply = await this.replyService.generateReply(
        incomingText,
        contextPayload.context,
      );

      if (contextPayload.subscription.preferenceColor === "green") {
        const postedMessage = await this.rocketChatClient.postMessage(subscription.roomId, suggestedReply);
        if (postedMessage) {
          await this.subscriptionPreferenceStore.syncOutgoingMessage(
            this.auth,
            subscription.roomId,
            subscription.roomType,
            postedMessage,
          );
        }
        console.log(`[${subscription.roomId}] Bot: ${suggestedReply}`);
      } else {
        await this.botNotificationStore.createNotification({
          auth: this.auth,
          roomId: subscription.roomId,
          roomType: subscription.roomType,
          subscriptionId: subscription.id,
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
      console.error(`[${subscription.roomId}] Failed to handle message: ${errorMessage}`);
      if (subscription.preferenceColor === "green") {
        await this.rocketChatClient.postMessage(
          subscription.roomId,
          "I hit an internal error while generating a reply. Please try again.",
        );
      }
    } finally {
      this.state.markProcessed(message._id);
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
}
