export class BotState {
  public authToken = "";
  public userId = "";
  private processedMessageIds = new Set<string>();

  isProcessed(messageId: string): boolean {
    return this.processedMessageIds.has(messageId);
  }

  markProcessed(messageId: string): void {
    this.processedMessageIds.add(messageId);

    // Keep memory bounded.
    if (this.processedMessageIds.size > 5000) {
      const ids = Array.from(this.processedMessageIds);
      const keep = ids.slice(ids.length - 2500);
      this.processedMessageIds = new Set(keep);
    }
  }
}

