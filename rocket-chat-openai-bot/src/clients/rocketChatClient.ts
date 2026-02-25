import type { BotConfig } from "../types/bot.js";
import type {
  RocketChatDirectRoom,
  RocketChatImListResponse,
  RocketChatLoginResponse,
  RocketChatMessage,
  RocketChatMessagesResponse,
} from "../types/rocketchat.js";

export class RocketChatClient {
  private authToken = "";
  private userId = "";

  constructor(private readonly config: BotConfig) {}

  get currentUserId(): string {
    return this.userId;
  }

  clearAuth(): void {
    this.authToken = "";
    this.userId = "";
  }

  async login(): Promise<void> {
    const json = await this.request<RocketChatLoginResponse>("/api/v1/login", {
      method: "POST",
      body: {
        user: this.config.rcUser,
        password: this.config.rcPassword,
      },
    });

    if (json.status !== "success" || !json.data?.authToken || !json.data.userId) {
      throw new Error(`Login failed: ${JSON.stringify(json)}`);
    }

    this.authToken = json.data.authToken;
    this.userId = json.data.userId;
  }

  async listDirectRooms(): Promise<RocketChatDirectRoom[]> {
    const json = await this.request<RocketChatImListResponse>("/api/v1/im.list");
    return json.ims ?? [];
  }

  async getDirectMessages(roomId: string, count = 20): Promise<RocketChatMessage[]> {
    const sort = encodeURIComponent(JSON.stringify({ ts: -1 }));
    const query = `/api/v1/im.messages?roomId=${encodeURIComponent(roomId)}&count=${count}&sort=${sort}`;
    const json = await this.request<RocketChatMessagesResponse>(query);
    return json.messages ?? [];
  }

  async postMessage(roomId: string, text: string): Promise<void> {
    await this.request("/api/v1/chat.postMessage", {
      method: "POST",
      body: {
        roomId,
        text,
      },
    });
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: Record<string, unknown> } = {}
  ): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.authToken) {
      headers["X-Auth-Token"] = this.authToken;
      headers["X-User-Id"] = this.userId;
    }

    const response = await fetch(`${this.config.rcUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Rocket.Chat API error ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  }
}

