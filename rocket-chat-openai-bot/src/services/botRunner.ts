import type { BotConfig } from "../types/bot.js";
import type { RocketChatMessage } from "../types/rocketchat.js";
import { RocketChatClient } from "../clients/rocketChatClient.js";
import { BotState } from "../state/botState.js";
import { sleep } from "../utils/sleep.js";
import { ReplyService } from "./replyService.js";

export class BotRunner {
  private readonly state = new BotState();
  private readonly startedAt = new Date();
  private readonly roomWatermarks = new Map<string, Date>();

  constructor(
    private readonly config: BotConfig,
    private readonly rocketChatClient: RocketChatClient,
    private readonly replyService: ReplyService
  ) {}

  async start(): Promise<void> {
    this.initializeAuth();
    console.log(`Starting poll loop (${this.config.pollIntervalMs} ms)`);
    await this.runLoop();
  }

  private initializeAuth(): void {
    this.state.userId = this.rocketChatClient.currentUserId;
    console.log(
      `Using Rocket.Chat token auth for '${this.rocketChatClient.identityLabel}' (userId=${this.state.userId})`
    );
  }

  private async runLoop(): Promise<void> {
    while (true) {
      try {
        const rooms = await this.rocketChatClient.listDirectRooms();
        for (const room of rooms) {
          await this.processRoom(room._id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Polling error: ${message}`);
      }

      await sleep(this.config.pollIntervalMs);
    }
  }

  private async processRoom(roomId: string): Promise<void> {
    const oldest = this.roomWatermarks.get(roomId) ?? this.startedAt;
    const messages = await this.rocketChatClient.getDirectMessages(roomId, oldest);

    for (const message of messages) {
      await this.processMessage(roomId, message);
      const timestamp = this.getMessageDate(message);
      if (timestamp) {
        this.roomWatermarks.set(roomId, timestamp);
      }
    }
  }

  private async processMessage(roomId: string, message: RocketChatMessage): Promise<void> {
    if (!message._id) {
      return;
    }

    if (!this.shouldRespondToMessage(message)) {
      this.state.markProcessed(message._id);
      return;
    }

    try {
      const userText = (message.msg ?? "").trim();
      console.log(`[${roomId}] User: ${userText}`);
      const reply = await this.replyService.generateReply(roomId, userText);
      await this.rocketChatClient.postMessage(roomId, reply);
      console.log(`[${roomId}] Bot: ${reply}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${roomId}] Failed to reply: ${errorMessage}`);
      await this.rocketChatClient.postMessage(
        roomId,
        "I hit an internal error while generating a reply. Please try again."
      );
    } finally {
      this.state.markProcessed(message._id);
    }
  }

  private shouldRespondToMessage(message: RocketChatMessage): boolean {
    if (!message._id) return false;
    if (this.state.isProcessed(message._id)) return false;
    if (message.u?._id === this.state.userId) return false;
    if (typeof message.msg !== "string") return false;

    const text = message.msg.trim();
    if (!text) return false;

    if (this.config.botTriggerPrefix) {
      return text.startsWith(this.config.botTriggerPrefix);
    }

    return true;
  }

  private getMessageDate(message: RocketChatMessage): Date | null {
    if (!message.ts) {
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
}
