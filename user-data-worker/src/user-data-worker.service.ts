import { Injectable, Logger } from "@nestjs/common";
import { isRealMessage } from "../../common/message-utils";

interface RocketIntegrationIdentity {
  googleId: string;
  email: string;
  userToken: string;
  userId: string;
}

interface RocketSubscriptionPayload {
  _id?: string;
  rid?: string;
  t?: string;
  [key: string]: unknown;
}

interface RocketMessagePayload {
  _id?: string;
  ts?: string | { $date?: number };
  [key: string]: unknown;
}

interface RocketSubscriptionsResponse {
  update?: RocketSubscriptionPayload[];
}

interface RocketHistoryResponse {
  messages?: RocketMessagePayload[];
}

@Injectable()
export class UserDataWorkerService {
  private readonly logger = new Logger(UserDataWorkerService.name);
  private readonly roomWatermarks = new Map<string, Map<string, Date>>();
  private nextRocketRequestAt = 0;

  async start(): Promise<void> {
    this.logger.log(`Starting user data worker loop (${this.pollIntervalMs} ms)`);

    while (true) {
      try {
        const integrations = await this.fetchIntegrations();
        for (const integration of integrations) {
          await this.syncUser(integration);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Worker loop failed: ${message}`);
      }

      await this.sleep(this.pollIntervalMs);
    }
  }

  private async syncUser(integration: RocketIntegrationIdentity): Promise<void> {
    const subscriptionsResponse = await this.requestRocket<RocketSubscriptionsResponse>(
      integration,
      "/api/v1/subscriptions.get",
    );

    const subscriptions = subscriptionsResponse.update ?? [];
    this.logger.log(`[${integration.email}] Fetched ${subscriptions.length} subscriptions`);
    if (subscriptions.length === 0) {
      return;
    }

    for (const batch of this.chunkItems(subscriptions, this.mainServerBatchSize)) {
      await this.postToMainServer("/users/internal/rocket-sync/subscriptions", {
        googleId: integration.googleId,
        email: integration.email,
        subscriptions: batch,
      });
    }

    for (const subscription of subscriptions) {
      if (!subscription.rid) {
        continue;
      }

      await this.syncRoomMessages(
        integration,
        subscription.rid,
        typeof subscription.t === "string" ? subscription.t : undefined,
      );
    }
  }

  private async syncRoomMessages(
    integration: RocketIntegrationIdentity,
    roomId: string,
    roomType?: string,
  ): Promise<void> {
    let oldest = this.getRoomWatermark(integration.googleId, roomId);
    const endpoint = this.resolveHistoryEndpoint(roomType);

    while (true) {
      const params = new URLSearchParams({
        roomId,
        count: "100",
      });

      if (oldest) {
        params.set("oldest", new Date(oldest.getTime() + 1).toISOString());
      }

      const history = await this.requestRocket<RocketHistoryResponse>(
        integration,
        `${endpoint}?${params.toString()}`,
      );

      const allMessages = history.messages ?? [];
      const messages = allMessages.filter(isRealMessage);

      this.logger.log(`[${integration.email}] Fetched ${allMessages.length} messages, ${messages.length} remaining after filtering system/empty messages.`);
      
      if (allMessages.length === 0) {
        break;
      }

      if (messages.length > 0) {
        for (const batch of this.chunkItems(messages, this.mainServerBatchSize)) {
          this.logger.log(`[${integration.email}] Posting batch of ${batch.length} messages to main server for roomId: ${roomId}`);
          await this.postToMainServer("/users/internal/rocket-sync/messages", {
            googleId: integration.googleId,
            email: integration.email,
            roomId,
            roomType,
            messages: batch,
          });
        }
      }

      const lastTimestamp = this.getMessageDate(allMessages[allMessages.length - 1]);
      if (!lastTimestamp) {
        break;
      }

      this.setRoomWatermark(integration.googleId, roomId, lastTimestamp);
      oldest = lastTimestamp;

      if (allMessages.length < 100) {
        break;
      }
    }
  }

  private async fetchIntegrations(): Promise<RocketIntegrationIdentity[]> {
    const response = await fetch(`${this.mainServerUrl}/users/internal/rocket-auth/all`, {
      headers: {
        "X-Internal-Api-Key": this.internalApiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch integrations: ${response.status} ${body}`);
    }

    return (await response.json()) as RocketIntegrationIdentity[];
  }

  private async postToMainServer(path: string, body: Record<string, unknown>): Promise<void> {
    const response = await fetch(`${this.mainServerUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": this.internalApiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`Failed to persist Rocket data via main server: ${response.status} ${responseBody}`);
    }
  }

  private async requestRocket<T>(
    integration: RocketIntegrationIdentity,
    path: string,
  ): Promise<T> {
    while (true) {
      const waitMs = Math.max(0, this.nextRocketRequestAt - Date.now());
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }

      this.nextRocketRequestAt = Date.now() + this.rcRequestIntervalMs;

      const response = await fetch(`${this.rcUrl}${path}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": integration.userToken,
          "X-User-Id": integration.userId,
        },
      });

      if (response.status === 429) {
        const retryDelayMs = this.getRetryDelayMs(response);
        this.logger.warn(
          `[${integration.email}] Rocket.Chat rate limit hit in worker. Retrying in ${retryDelayMs} ms.`,
        );
        this.nextRocketRequestAt = Math.max(this.nextRocketRequestAt, Date.now() + retryDelayMs);
        await this.sleep(retryDelayMs);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Rocket.Chat request failed for '${integration.email}' on ${path}: ${response.status} ${body}`,
        );
      }

      return (await response.json()) as T;
    }
  }

  private resolveHistoryEndpoint(roomType?: string): string {
    switch (roomType) {
      case "c":
        return "/api/v1/channels.history";
      case "p":
        return "/api/v1/groups.history";
      case "d":
      default:
        return "/api/v1/im.history";
    }
  }

  private getMessageDate(message?: RocketMessagePayload): Date | null {
    if (!message?.ts) {
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

  private getRoomWatermark(googleId: string, roomId: string): Date | undefined {
    return this.roomWatermarks.get(googleId)?.get(roomId);
  }

  private setRoomWatermark(googleId: string, roomId: string, timestamp: Date): void {
    if (!this.roomWatermarks.has(googleId)) {
      this.roomWatermarks.set(googleId, new Map());
    }

    this.roomWatermarks.get(googleId)?.set(roomId, timestamp);
  }

  private get mainServerUrl(): string {
    const value = process.env.MAIN_SERVER_URL;
    if (!value) {
      throw new Error("Missing required env var: MAIN_SERVER_URL");
    }

    return value.replace(/\/$/, "");
  }

  private get internalApiKey(): string {
    const value = process.env.INTERNAL_API_KEY;
    if (!value) {
      throw new Error("Missing required env var: INTERNAL_API_KEY");
    }

    return value;
  }

  private get rcUrl(): string {
    const value = process.env.RC_URL;
    if (!value) {
      throw new Error("Missing required env var: RC_URL");
    }

    return value.replace(/\/$/, "");
  }

  private get pollIntervalMs(): number {
    return this.getPositiveInt("POLL_INTERVAL_MS", 30000);
  }

  private get rcRequestIntervalMs(): number {
    return this.getPositiveInt("RC_REQUEST_INTERVAL_MS", 500);
  }

  private get rcRetryBackoffMs(): number {
    return this.getPositiveInt("RC_RETRY_BACKOFF_MS", 5000);
  }

  private get mainServerBatchSize(): number {
    return this.getPositiveInt("MAIN_SERVER_BATCH_SIZE", 25);
  }

  private getPositiveInt(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Env var ${name} must be a positive integer`);
    }

    return parsed;
  }

  private chunkItems<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize));
    }

    return chunks;
  }

  private getRetryDelayMs(response: Response): number {
    const retryAfter = response.headers.get("retry-after");
    if (!retryAfter) {
      return this.rcRetryBackoffMs;
    }

    const asSeconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(asSeconds) && asSeconds > 0) {
      return Math.ceil(asSeconds * 1000);
    }

    const asDate = new Date(retryAfter).getTime();
    if (Number.isFinite(asDate)) {
      return Math.max(this.rcRetryBackoffMs, asDate - Date.now());
    }

    return this.rcRetryBackoffMs;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
