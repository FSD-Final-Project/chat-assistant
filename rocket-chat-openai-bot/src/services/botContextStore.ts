import type {
  BotConfig,
  BotContextPayload,
  ManagedSubscription,
  RocketChatAuth,
} from "../types/bot.js";
import type { RocketChatMessage } from "../types/rocketchat.js";

interface BotContextResponse {
  subscription?: ManagedSubscription;
  currentSummary?: BotContextPayload["currentSummary"];
  relevantSummaries?: BotContextPayload["relevantSummaries"];
}

export class BotContextStore {
  constructor(private readonly config: BotConfig) {}

  async loadContextForMessage(
    auth: RocketChatAuth,
    roomId: string,
    roomType: string | undefined,
    subscriptionId: string | undefined,
    message: RocketChatMessage,
    queryEmbedding: number[],
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
        queryEmbedding,
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
      currentSummary: payload.currentSummary ?? null,
      relevantSummaries: payload.relevantSummaries ?? [],
    };
  }

  async saveSummary(input: {
    auth: RocketChatAuth;
    subscription: ManagedSubscription;
    summary: string;
    embedding: number[];
    lastMessageId?: string;
    sourceMessageCount?: number;
    source: "worker" | "bot";
  }): Promise<void> {
    const response = await fetch(`${this.config.mainServerUrl}/users/internal/rocket-summaries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": this.config.internalApiKey,
      },
      body: JSON.stringify({
        googleId: input.auth.googleId,
        email: input.auth.email,
        subscriptionId: input.subscription.id,
        roomId: input.subscription.roomId,
        roomType: input.subscription.roomType,
        summary: input.summary,
        embedding: input.embedding,
        lastMessageId: input.lastMessageId,
        sourceMessageCount: input.sourceMessageCount,
        source: input.source,
      }),
    });

    if (!response.ok) {
      const messageText = await response.text();
      throw new Error(
        `Failed to save bot summary for '${input.auth.email ?? input.auth.googleId}': ${response.status} ${messageText}`,
      );
    }
  }
}
