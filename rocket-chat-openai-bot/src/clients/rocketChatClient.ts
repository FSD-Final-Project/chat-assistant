import type { BotConfig } from "../types/bot.js";
import type {
  RocketChatDirectRoom,
  RocketChatImListResponse,
  RocketChatMessage,
  RocketChatMessagesResponse,
} from "../types/rocketchat.js";

export class RocketChatClient {
  constructor(private readonly config: BotConfig) {}

  get currentUserId(): string {
    return this.config.rcUserId;
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Auth-Token": this.config.rcUserToken,
      "X-User-Id": this.config.rcUserId,
    };

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
