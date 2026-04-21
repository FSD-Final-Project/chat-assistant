import type { BotConfig } from "../types/bot.js";
import type { RocketChatMessage } from "../types/rocketchat.js";
import { RocketChatClient } from "../clients/rocketChatClient.js";
import { BotState } from "../state/botState.js";
import { sleep } from "../utils/sleep.js";
import { ReplyService } from "./replyService.js";

export class BotRunner {
  private readonly state = new BotState();
  private readonly initializedRoomIds = new Set<string>();

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
    console.log(`Using Rocket.Chat token auth (userId=${this.state.userId})`);
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
    const messages = await this.rocketChatClient.getDirectMessages(roomId, 20);

    if (!this.initializedRoomIds.has(roomId)) {
      for (const message of messages) {
        if (message._id) {
          this.state.markProcessed(message._id);
        }
      }

      this.initializedRoomIds.add(roomId);
      if (messages.length > 0) {
        console.log(`[${roomId}] Skipped ${messages.length} existing message(s) on first sync`);
      }
      return;
    }

    messages.reverse();

    for (const message of messages) {
      await this.processMessage(roomId, message);
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
}
