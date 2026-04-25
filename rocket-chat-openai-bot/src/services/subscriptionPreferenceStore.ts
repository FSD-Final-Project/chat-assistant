import type { BotConfig, ManagedSubscription, RocketChatAuth } from "../types/bot.js";

interface ManagedSubscriptionsResponse {
  subscriptions?: ManagedSubscription[];
}

export class SubscriptionPreferenceStore {
  constructor(private readonly config: BotConfig) {}

  async loadManagedSubscriptions(auth: RocketChatAuth): Promise<ManagedSubscription[]> {
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
    return payload.subscriptions ?? [];
  }
}
