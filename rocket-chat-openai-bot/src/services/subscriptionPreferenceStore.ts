import type { BotActivationPreferences, BotConfig, ManagedSubscription, RocketChatAuth } from "../types/bot.js";
import type { RocketChatMessage } from "../types/rocketchat.js";

interface ManagedSubscriptionsResponse {
  botActivationPreferences?: BotActivationPreferences;
  subscriptions?: ManagedSubscription[];
}

export interface ManagedSubscriptionSettings {
  botActivationPreferences: BotActivationPreferences;
  subscriptions: ManagedSubscription[];
}

const defaultBotActivationPreferences: BotActivationPreferences = {
  timeEnabled: false,
  startTime: "15:00",
  endTime: "20:30",
  dateEnabled: false,
};

export class SubscriptionPreferenceStore {
  constructor(private readonly config: BotConfig) {}

  async loadManagedSubscriptionSettings(auth: RocketChatAuth): Promise<ManagedSubscriptionSettings> {
    if (!auth.googleId) {
      throw new Error(`Cannot load managed subscriptions without googleId for '${auth.email ?? auth.userId}'`);
    }

    const params = new URLSearchParams({
      googleId: auth.googleId,
    });
    const response = await fetch(
      `${this.config.mainServerUrl}/users/internal/bot-subscriptions?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "X-Internal-Api-Key": this.config.internalApiKey,
        },
      }
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `Failed to load managed subscriptions for '${auth.email ?? auth.googleId}': ${response.status} ${message}`
      );
    }

    const payload = (await response.json()) as ManagedSubscriptionsResponse;
    return {
      botActivationPreferences: {
        ...defaultBotActivationPreferences,
        ...payload.botActivationPreferences,
      },
      subscriptions: payload.subscriptions ?? [],
    };
  }

  async loadManagedSubscriptions(auth: RocketChatAuth): Promise<ManagedSubscription[]> {
    const settings = await this.loadManagedSubscriptionSettings(auth);
    return settings.subscriptions;
  }

  async triggerWorkerSync(auth: RocketChatAuth): Promise<void> {
    if (!auth.googleId) {
      throw new Error(`Cannot trigger worker sync without googleId for '${auth.email ?? auth.userId}'`);
    }

    const response = await fetch(`${this.config.mainServerUrl}/users/internal/rocket-sync/trigger-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": this.config.internalApiKey,
      },
      body: JSON.stringify({
        googleId: auth.googleId,
      }),
    });

    if (!response.ok) {
      const messageText = await response.text();
      throw new Error(
        `Failed to trigger worker sync for '${auth.email ?? auth.googleId}': ${response.status} ${messageText}`
      );
    }
  }

  async syncOutgoingMessage(
    auth: RocketChatAuth,
    roomId: string,
    roomType: string | undefined,
    message: RocketChatMessage,
  ): Promise<void> {
    const response = await fetch(`${this.config.mainServerUrl}/users/internal/rocket-sync/messages`, {
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
        messages: [message],
      }),
    });

    if (!response.ok) {
      const messageText = await response.text();
      throw new Error(
        `Failed to sync outgoing message for '${auth.email ?? auth.googleId}': ${response.status} ${messageText}`
      );
    }
  }
}
