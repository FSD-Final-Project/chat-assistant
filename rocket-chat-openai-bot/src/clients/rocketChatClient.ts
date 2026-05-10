import type { BotConfig, RocketChatAuth } from "../types/bot.js";
import type {
  RocketChatMessage,
  RocketChatMessagesResponse,
  RocketChatPostMessageResponse,
} from "../types/rocketchat.js";
import { sleep } from "../utils/sleep.js";

export class RocketChatAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RocketChatAuthError";
  }
}

export class RocketChatClient {
  private static queue = Promise.resolve();
  private static nextRequestAt = 0;

  constructor(
    private readonly config: BotConfig,
    private readonly auth: RocketChatAuth
  ) {}

  get currentUserId(): string {
    return this.auth.userId;
  }

  get identityLabel(): string {
    return this.auth.email ?? this.auth.userId;
  }

  async getRoomMessages(
    roomId: string,
    roomType: string | undefined,
    oldest?: Date,
    count = 100
  ): Promise<RocketChatMessage[]> {
    const sort = encodeURIComponent(JSON.stringify({ ts: 1 }));
    const params = new URLSearchParams({
      roomId,
      count: String(count),
      sort,
    });

    if (oldest) {
      params.set("oldest", new Date(oldest.getTime() + 1).toISOString());
    }

    const endpoint = this.resolveHistoryEndpoint(roomType);
    const query = `${endpoint}?${params.toString()}`;
    const json = await this.request<RocketChatMessagesResponse>(query);
    return json.messages ?? [];
  }

  async postMessage(roomId: string, text: string): Promise<RocketChatMessage | null> {
    const response = await this.request<RocketChatPostMessageResponse>(
      "/api/v1/chat.postMessage",
      {
      method: "POST",
      body: {
        roomId,
        text,
      },
      }
    );

    return response.message ?? null;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: Record<string, unknown> } = {}
  ): Promise<T> {
    return this.enqueueRequest(async () => {
      let attempt = 0;

      while (true) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Auth-Token": this.auth.userToken,
          "X-User-Id": this.auth.userId,
        };

        const response = await fetch(`${this.config.rcUrl}${path}`, {
          method: options.method ?? "GET",
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        if (response.status === 429) {
          attempt += 1;
          const retryDelayMs = this.getRetryDelayMs(response);
          console.warn(
            `[${this.identityLabel}] Rocket.Chat rate limit hit. Retrying in ${retryDelayMs} ms (attempt ${attempt}).`
          );
          RocketChatClient.nextRequestAt = Math.max(
            RocketChatClient.nextRequestAt,
            Date.now() + retryDelayMs
          );
          await sleep(retryDelayMs);
          continue;
        }

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401) {
            throw new RocketChatAuthError(
              `Rocket.Chat API auth error ${response.status}: ${text}`,
              response.status
            );
          }

          throw new Error(`Rocket.Chat API error ${response.status}: ${text}`);
        }

        return (await response.json()) as T;
      }
    });
  }

  private async enqueueRequest<T>(task: () => Promise<T>): Promise<T> {
    const run = async () => {
      const waitMs = Math.max(0, RocketChatClient.nextRequestAt - Date.now());
      if (waitMs > 0) {
        await sleep(waitMs);
      }

      RocketChatClient.nextRequestAt = Date.now() + this.config.rcRequestIntervalMs;
      return task();
    };

    const scheduled = RocketChatClient.queue.then(run, run);
    RocketChatClient.queue = scheduled.then(
      () => undefined,
      () => undefined
    );

    return scheduled;
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

  private getRetryDelayMs(response: Response): number {
    const retryAfter = response.headers.get("retry-after");
    if (!retryAfter) {
      return this.config.rcRetryBackoffMs;
    }

    const asSeconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(asSeconds) && asSeconds > 0) {
      return Math.ceil(asSeconds * 1000);
    }

    const asDate = new Date(retryAfter).getTime();
    if (Number.isFinite(asDate)) {
      return Math.max(this.config.rcRetryBackoffMs, asDate - Date.now());
    }

    return this.config.rcRetryBackoffMs;
  }
}
