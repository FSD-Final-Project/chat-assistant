import type { BotConfig, RocketChatAuth } from "../types/bot.js";

export class RocketCredentialsStore {
  constructor(private readonly config: BotConfig) {}

  async loadRocketChatAuth(): Promise<RocketChatAuth[]> {
    const response = await fetch(
      `${this.config.mainServerUrl}/users/internal/rocket-auth/all`,
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
        `Failed to load Rocket.Chat credentials from main server: ${response.status} ${message}`
      );
    }

    const credentials = (await response.json()) as RocketChatAuth[];
    if (credentials.length === 0) {
      throw new Error("Main server returned no Rocket.Chat integrations");
    }

    return credentials;
  }

  async disconnectRocketChatAuth(rocketAuth: RocketChatAuth): Promise<void> {
    const response = await fetch(
      `${this.config.mainServerUrl}/users/internal/rocket-auth/disconnect`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Api-Key": this.config.internalApiKey,
        },
        body: JSON.stringify({
          googleId: rocketAuth.googleId,
          email: rocketAuth.email,
          rocketUserId: rocketAuth.userId,
        }),
      }
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `Failed to disconnect Rocket.Chat credentials from main server: ${response.status} ${message}`
      );
    }
  }
}
