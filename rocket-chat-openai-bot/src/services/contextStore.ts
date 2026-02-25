import type { ChatRole, ContextEntry } from "../types/bot.js";

export class ContextStore {
  private readonly roomContext = new Map<string, ContextEntry[]>();

  constructor(private readonly maxContextMessages: number) {}

  get(roomId: string): ContextEntry[] {
    if (!this.roomContext.has(roomId)) {
      this.roomContext.set(roomId, []);
    }

    return this.roomContext.get(roomId) ?? [];
  }

  push(roomId: string, role: ChatRole, text: string): void {
    const context = this.get(roomId);
    context.push({ role, text });

    if (context.length > this.maxContextMessages) {
      context.splice(0, context.length - this.maxContextMessages);
    }
  }
}

