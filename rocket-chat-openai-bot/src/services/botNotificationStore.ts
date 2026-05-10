import type { BotConfig, PreferenceColor, RocketChatAuth } from "../types/bot.js";

interface CreateBotNotificationInput {
  auth: RocketChatAuth;
  roomId: string;
  roomType?: string;
  subscriptionId?: string;
  messageId: string;
  preferenceColor: PreferenceColor;
  kind: "approval" | "info";
  senderName?: string;
  senderUsername?: string;
  incomingText: string;
  suggestedReply?: string;
}

export class BotNotificationStore {
  constructor(private readonly config: BotConfig) {}

  async createNotification(input: CreateBotNotificationInput): Promise<void> {
    const response = await fetch(`${this.config.mainServerUrl}/users/internal/bot-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": this.config.internalApiKey,
      },
      body: JSON.stringify({
        googleId: input.auth.googleId,
        email: input.auth.email,
        roomId: input.roomId,
        roomType: input.roomType,
        subscriptionId: input.subscriptionId,
        messageId: input.messageId,
        preferenceColor: input.preferenceColor,
        kind: input.kind,
        senderName: input.senderName,
        senderUsername: input.senderUsername,
        incomingText: input.incomingText,
        suggestedReply: input.suggestedReply,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to persist bot notification: ${response.status} ${message}`);
    }
  }
}
