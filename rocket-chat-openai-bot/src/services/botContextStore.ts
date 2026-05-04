import type {
  BotConfig,
  BotContextPayload,
  ManagedSubscription,
  RocketChatAuth,
} from "../types/bot.js";
import type { RocketChatMessage } from "../types/rocketchat.js";

interface BotContextResponse {
  subscription?: ManagedSubscription;
  context?: BotContextPayload["context"];
}

export class BotContextStore {
  constructor(private readonly config: BotConfig) {}

  async loadContextForMessage(
    auth: RocketChatAuth,
    roomId: string,
    roomType: string | undefined,
    subscriptionId: string | undefined,
    message: RocketChatMessage,
  ): Promise<BotContextPayload> {
    const response = await fetch(`${this.config.mainServerUrl}/users/internal/bot-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": this.config.internalApiKey,
      },
      body: JSON.stringify({
        googleId: auth.googleId,
        email: auth.email,
        roomId,
        roomType,
        subscriptionId,
        contextLimit: this.config.maxContextMessages,
        message,
      }),
    });

    if (!response.ok) {
      const messageText = await response.text();
      throw new Error(
        `Failed to load bot context for '${auth.email ?? auth.googleId}': ${response.status} ${messageText}`
      );
    }

    const payload = (await response.json()) as BotContextResponse;
    if (!payload.subscription) {
      throw new Error("Main server bot context response did not include a subscription");
    }

    return {
      subscription: payload.subscription,
      context: payload.context ?? [],
    };
  }
}
