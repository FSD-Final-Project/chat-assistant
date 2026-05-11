import { Injectable, Logger } from "@nestjs/common";

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
  _updatedAt?: string | { $date?: number };
  [key: string]: unknown;
}

interface RocketSubscriptionRemovalPayload {
  _id?: string;
  [key: string]: unknown;
}

interface RocketMessagePayload {
  _id?: string;
  ts?: string | { $date?: number };
  [key: string]: unknown;
}

interface RocketSubscriptionsResponse {
  update?: RocketSubscriptionPayload[];
  remove?: RocketSubscriptionRemovalPayload[];
}

interface RocketHistoryResponse {
  messages?: RocketMessagePayload[];
}

interface MissingSummarySubscription {
  id: string;
  roomId: string;
  roomType?: string;
}

interface OpenAiResponsesApiPayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

class RocketChatAuthError extends Error {
  constructor(
    message: string,
    public readonly integration: RocketIntegrationIdentity,
  ) {
    super(message);
    this.name = "RocketChatAuthError";
  }
}

@Injectable()
export class UserDataWorkerService {
  private readonly logger = new Logger(UserDataWorkerService.name);
  private readonly roomWatermarks = new Map<string, Map<string, Date>>();
  private readonly incrementalSubscriptionWatermarks = new Map<string, Date>();
  private readonly activeSyncCounts = new Map<string, number>();
  private nextRocketRequestAt = 0;
  private fullSyncIteration = 0;
  private incrementalSyncIteration = 0;

  async start(): Promise<void> {
    this.logger.log(
      `Starting user data worker loops (full=${this.fullSubscriptionsSyncIntervalMs} ms, incremental=${this.incrementalSubscriptionsSyncIntervalMs} ms)`,
    );

    await Promise.all([
      this.runFullSubscriptionsLoop(),
      this.runIncrementalSubscriptionsLoop(),
    ]);
  }

  async triggerSyncForUser(googleId: string): Promise<void> {
    const integrations = await this.fetchIntegrations();
    const integration = integrations.find((candidate) => candidate.googleId === googleId);
    if (!integration) {
      throw new Error(`Integrated Rocket user not found for googleId '${googleId}'`);
    }

    this.logger.log(`Triggered immediate sync for ${integration.email}`);
    await this.runFullSubscriptionSyncForUser(integration);
    await this.ensureMissingSummaries(integration);
  }

  private async runFullSubscriptionsLoop(): Promise<void> {
    while (true) {
      try {
        this.fullSyncIteration += 1;
        this.logger.log(`Full sync ${this.fullSyncIteration}: starting cycle`);
        const integrations = await this.fetchIntegrations();
        this.logger.log(
          `Full sync ${this.fullSyncIteration}: fetched ${integrations.length} integrated user(s)`,
        );

        for (const integration of integrations) {
          await this.runForIntegration(integration, async () => {
            await this.runFullSubscriptionSyncForUser(integration);
            await this.ensureMissingSummaries(integration);
          });
        }

        this.logger.log(`Full sync ${this.fullSyncIteration}: cycle completed`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Full sync ${this.fullSyncIteration}: failed: ${message}`);
      }

      await this.sleep(this.fullSubscriptionsSyncIntervalMs);
    }
  }

  private async runIncrementalSubscriptionsLoop(): Promise<void> {
    while (true) {
      try {
        this.incrementalSyncIteration += 1;
        this.logger.log(`Incremental sync ${this.incrementalSyncIteration}: starting cycle`);
        const integrations = await this.fetchIntegrations();
        this.logger.log(
          `Incremental sync ${this.incrementalSyncIteration}: fetched ${integrations.length} integrated user(s)`,
        );

        for (const integration of integrations) {
          await this.runForIntegration(integration, async () => {
            await this.runIncrementalSubscriptionSyncForUser(integration);
            await this.ensureMissingSummaries(integration);
          });
        }

        this.logger.log(`Incremental sync ${this.incrementalSyncIteration}: cycle completed`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Incremental sync ${this.incrementalSyncIteration}: failed: ${message}`);
      }

      await this.sleep(this.incrementalSubscriptionsSyncIntervalMs);
    }
  }

  private async runForIntegration(
    integration: RocketIntegrationIdentity,
    task: () => Promise<void>,
  ): Promise<void> {
    await this.beginIntegrationSync(integration.googleId);

    try {
      await task();
      if (this.endIntegrationSync(integration.googleId)) {
        await this.updateSyncStatus(integration.googleId, "completed");
      }
    } catch (error) {
      if (error instanceof RocketChatAuthError) {
        this.endIntegrationSync(integration.googleId);
        await this.disconnectIntegrationAfterAuthFailure(error.integration, error.message);
        return;
      }

      if (this.endIntegrationSync(integration.googleId)) {
        await this.updateSyncStatus(
          integration.googleId,
          "failed",
          error instanceof Error ? error.message : String(error),
        );
      }
      throw error;
    }
  }

  private async beginIntegrationSync(googleId: string): Promise<void> {
    const currentCount = this.activeSyncCounts.get(googleId) ?? 0;
    this.activeSyncCounts.set(googleId, currentCount + 1);
    if (currentCount === 0) {
      await this.updateSyncStatus(googleId, "syncing");
    }
  }

  private endIntegrationSync(googleId: string): boolean {
    const nextCount = Math.max(0, (this.activeSyncCounts.get(googleId) ?? 1) - 1);
    if (nextCount === 0) {
      this.activeSyncCounts.delete(googleId);
      return true;
    }

    this.activeSyncCounts.set(googleId, nextCount);
    return false;
  }

  private async runFullSubscriptionSyncForUser(
    integration: RocketIntegrationIdentity,
  ): Promise<void> {
    this.logger.log(`Full sync ${this.fullSyncIteration}: syncing all subscriptions for ${integration.email}`);
    const subscriptionsResponse = await this.requestRocket<RocketSubscriptionsResponse>(
      integration,
      "/api/v1/subscriptions.get",
    );

    const subscriptions = subscriptionsResponse.update ?? [];
    this.logger.log(
      `Full sync ${this.fullSyncIteration}: ${integration.email} returned ${subscriptions.length} full subscription(s)`,
    );

    await this.postToMainServer("/users/internal/rocket-sync/subscriptions", {
      googleId: integration.googleId,
      email: integration.email,
      mode: "full",
      subscriptions,
    });

    if (subscriptions.length === 0) {
      return;
    }

    for (const subscription of subscriptions) {
      if (!subscription.rid) {
        continue;
      }

      await this.refreshRoomSummary(
        integration,
        subscription._id,
        subscription.rid,
        typeof subscription.t === "string" ? subscription.t : undefined,
      );
    }

    const latestUpdatedAt = this.getLatestSubscriptionTimestamp(subscriptions);
    if (latestUpdatedAt) {
      this.incrementalSubscriptionWatermarks.set(integration.googleId, latestUpdatedAt);
    }
  }

  private async runIncrementalSubscriptionSyncForUser(
    integration: RocketIntegrationIdentity,
  ): Promise<void> {
    const updatedSince = this.incrementalSubscriptionWatermarks.get(integration.googleId);
    this.logger.log(
      `Incremental sync ${this.incrementalSyncIteration}: syncing subscription delta for ${integration.email}${updatedSince ? ` since ${updatedSince.toISOString()}` : ""}`,
    );

    const params = new URLSearchParams();
    if (updatedSince) {
      params.set("updatedSince", updatedSince.toISOString());
    }

    const path = params.size > 0 ? `/api/v1/subscriptions.get?${params.toString()}` : "/api/v1/subscriptions.get";
    const subscriptionsResponse = await this.requestRocket<RocketSubscriptionsResponse>(
      integration,
      path,
    );

    const updatedSubscriptions = subscriptionsResponse.update ?? [];
    const removedSubscriptionIds = (subscriptionsResponse.remove ?? [])
      .map((subscription) => subscription._id)
      .filter((subscriptionId): subscriptionId is string => typeof subscriptionId === "string");

    this.logger.log(
      `Incremental sync ${this.incrementalSyncIteration}: ${integration.email} returned ${updatedSubscriptions.length} update(s) and ${removedSubscriptionIds.length} removal(s)`,
    );

    await this.postSubscriptionDelta(
      integration,
      updatedSubscriptions,
      removedSubscriptionIds,
    );

    for (const subscription of updatedSubscriptions) {
      if (!subscription.rid) {
        continue;
      }

      await this.syncRoomMessages(
        integration,
        subscription.rid,
        typeof subscription.t === "string" ? subscription.t : undefined,
      );
      await this.refreshRoomSummary(
        integration,
        subscription._id,
        subscription.rid,
        typeof subscription.t === "string" ? subscription.t : undefined,
      );
    }

    const latestUpdatedAt = this.getLatestSubscriptionTimestamp(updatedSubscriptions);
    if (latestUpdatedAt) {
      this.incrementalSubscriptionWatermarks.set(integration.googleId, latestUpdatedAt);
    }
  }

  private async postSubscriptionDelta(
    integration: RocketIntegrationIdentity,
    updatedSubscriptions: RocketSubscriptionPayload[],
    removedSubscriptionIds: string[],
  ): Promise<void> {
    if (updatedSubscriptions.length === 0) {
      await this.postToMainServer("/users/internal/rocket-sync/subscriptions", {
        googleId: integration.googleId,
        email: integration.email,
        mode: "delta",
        subscriptions: [],
        removedSubscriptionIds,
      });
      return;
    }

    for (const batch of this.chunkItems(updatedSubscriptions, this.mainServerBatchSize)) {
      await this.postToMainServer("/users/internal/rocket-sync/subscriptions", {
        googleId: integration.googleId,
        email: integration.email,
        mode: "delta",
        subscriptions: batch,
        removedSubscriptionIds,
      });
      removedSubscriptionIds = [];
    }

    const latestUpdatedAt = this.getLatestSubscriptionTimestamp(updatedSubscriptions);
    if (latestUpdatedAt) {
      this.incrementalSubscriptionWatermarks.set(integration.googleId, latestUpdatedAt);
    }
  }

  private async syncRoomMessages(
    integration: RocketIntegrationIdentity,
    roomId: string,
    roomType?: string,
  ): Promise<void> {
    let oldest = this.getRoomWatermark(integration.googleId, roomId);
    const endpoint = this.resolveHistoryEndpoint(roomType);
    this.logger.log(
      `Incremental sync ${this.incrementalSyncIteration}: syncing room ${roomId} (${roomType ?? "d"}) for ${integration.email}`,
    );

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

      const messages = history.messages ?? [];
      if (messages.length === 0) {
        this.logger.log(
          `Incremental sync ${this.incrementalSyncIteration}: no new messages for room ${roomId} (${integration.email})`,
        );
        break;
      }

      this.logger.log(
        `Incremental sync ${this.incrementalSyncIteration}: fetched ${messages.length} message(s) for room ${roomId} (${integration.email})`,
      );

      for (const batch of this.chunkItems(messages, this.mainServerBatchSize)) {
        await this.postToMainServer("/users/internal/rocket-sync/messages", {
          googleId: integration.googleId,
          email: integration.email,
          roomId,
          roomType,
          messages: batch,
        });
      }

      const lastTimestamp = this.getMessageDate(messages[messages.length - 1]);
      if (!lastTimestamp) {
        break;
      }

      this.setRoomWatermark(integration.googleId, roomId, lastTimestamp);
      oldest = lastTimestamp;

      if (messages.length < 100) {
        break;
      }
    }
  }

  private async refreshRoomSummary(
    integration: RocketIntegrationIdentity,
    subscriptionId: string | undefined,
    roomId: string,
    roomType?: string,
  ): Promise<void> {
    if (!subscriptionId) {
      return;
    }

    const messages = await this.loadRecentRoomTranscript(integration, roomId, roomType);
    if (messages.length === 0) {
      return;
    }

    const transcript = this.buildTranscript(messages);
    const summary = await this.generateSummary(transcript);
    const embedding = await this.generateEmbedding(summary);
    const lastMessageId = typeof messages[messages.length - 1]?._id === "string"
      ? messages[messages.length - 1]._id
      : undefined;

    await this.postToMainServer("/users/internal/rocket-summaries", {
      googleId: integration.googleId,
      email: integration.email,
      subscriptionId,
      roomId,
      roomType,
      summary,
      embedding,
      lastMessageId,
      sourceMessageCount: messages.length,
      source: "worker",
    });
  }

  private async ensureMissingSummaries(
    integration: RocketIntegrationIdentity,
  ): Promise<void> {
    const response = await fetch(
      `${this.mainServerUrl}/users/internal/rocket-summaries/missing?googleId=${encodeURIComponent(
        integration.googleId,
      )}`,
      {
        headers: {
          "X-Internal-Api-Key": this.internalApiKey,
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to fetch missing summaries for '${integration.email}': ${response.status} ${body}`,
      );
    }

    const payload = (await response.json()) as {
      subscriptions?: MissingSummarySubscription[];
    };
    const missingSubscriptions = payload.subscriptions ?? [];
    if (missingSubscriptions.length === 0) {
      return;
    }

    this.logger.log(
      `Backfilling ${missingSubscriptions.length} missing summary subscription(s) for ${integration.email}`,
    );

    for (const subscription of missingSubscriptions) {
      await this.refreshRoomSummary(
        integration,
        subscription.id,
        subscription.roomId,
        subscription.roomType,
      );
    }
  }

  private async loadRecentRoomTranscript(
    integration: RocketIntegrationIdentity,
    roomId: string,
    roomType?: string,
  ): Promise<RocketMessagePayload[]> {
    const endpoint = this.resolveHistoryEndpoint(roomType);
    const sort = encodeURIComponent(JSON.stringify({ ts: 1 }));
    const params = new URLSearchParams({
      roomId,
      count: String(this.summarySourceMessageLimit),
      sort,
    });

    const history = await this.requestRocket<RocketHistoryResponse>(
      integration,
      `${endpoint}?${params.toString()}`,
    );

    return history.messages ?? [];
  }

  private buildTranscript(messages: RocketMessagePayload[]): string {
    return messages
      .filter((message) => typeof message.msg === "string" && message.msg.trim().length > 0)
      .map((message) => {
        const sender =
          message.u &&
          typeof message.u === "object" &&
          typeof (message.u as { username?: unknown }).username === "string"
            ? (message.u as { username: string }).username
            : "unknown";

        return `${sender}: ${String(message.msg).trim()}`;
      })
      .join("\n");
  }

  private async generateSummary(transcript: string): Promise<string> {
    const response = await this.fetchWithContext("OpenAI summary generation", "https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: this.summaryModel,
        input: [
          {
            role: "system",
            content:
              "Summarize this Rocket.Chat conversation for retrieval use. Keep only useful context: stable facts, preferences, ongoing topics, tasks, commitments, and relevant tone cues. Do not mention that this is a conversation, chat, Rocket.Chat, user names unless they matter, or any meta phrases like 'the conversation shows' or 'the user discusses'. Write compact notes, not narration. Stay under 220 words and return only plain summary text.",
          },
          {
            role: "user",
            content: transcript,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to generate summary: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as OpenAiResponsesApiPayload;
    const summary = this.cleanSummaryText(this.extractOpenAiText(payload));
    if (!summary) {
      throw new Error("OpenAI summary response did not contain output_text");
    }

    return summary;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.fetchWithContext("OpenAI embedding generation", "https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to generate embedding: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };

    return payload.data?.[0]?.embedding ?? [];
  }

  private async fetchIntegrations(): Promise<RocketIntegrationIdentity[]> {
    const url = `${this.mainServerUrl}/users/internal/rocket-auth/all`;
    const response = await this.fetchWithContext("fetch integrations from main server", url, {
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

  private async disconnectIntegrationAfterAuthFailure(
    integration: RocketIntegrationIdentity,
    reason: string,
  ): Promise<void> {
    this.logger.warn(
      `Disconnecting Rocket.Chat integration for '${integration.email}' after auth failure: ${reason}`,
    );

    await this.postToMainServer("/users/internal/rocket-auth/disconnect", {
      googleId: integration.googleId,
      email: integration.email,
      rocketUserId: integration.userId,
    });

    this.incrementalSubscriptionWatermarks.delete(integration.googleId);
    this.roomWatermarks.delete(integration.googleId);
  }

  private async updateSyncStatus(
    googleId: string,
    status: "syncing" | "completed" | "failed",
    error?: string,
  ): Promise<void> {
    await this.postToMainServer("/users/internal/rocket-sync/status", {
      googleId,
      status,
      error,
    });
  }

  private async postToMainServer(path: string, body: Record<string, unknown>): Promise<void> {
    const url = `${this.mainServerUrl}${path}`;
    const response = await this.fetchWithContext(`persist Rocket data to main server (${path})`, url, {
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

      const url = `${this.rcUrl}${path}`;
      const response = await this.fetchWithContext(
        `Rocket.Chat request for '${integration.email}'`,
        url,
        {
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": integration.userToken,
          "X-User-Id": integration.userId,
        },
        },
      );

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
        if (response.status === 401) {
          throw new RocketChatAuthError(
            `Rocket.Chat request failed for '${integration.email}' on ${path}: ${response.status} ${body}`,
            integration,
          );
        }

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

  private getLatestSubscriptionTimestamp(subscriptions: RocketSubscriptionPayload[]): Date | null {
    let latestTimestamp: Date | null = null;

    for (const subscription of subscriptions) {
      const timestamp = this.getSubscriptionUpdatedAt(subscription);
      if (!timestamp) {
        continue;
      }

      if (!latestTimestamp || timestamp.getTime() > latestTimestamp.getTime()) {
        latestTimestamp = timestamp;
      }
    }

    return latestTimestamp;
  }

  private getSubscriptionUpdatedAt(subscription: RocketSubscriptionPayload): Date | null {
    const updatedAt = subscription._updatedAt;
    if (!updatedAt) {
      return null;
    }

    if (typeof updatedAt === "string") {
      const parsed = new Date(updatedAt);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof updatedAt.$date === "number") {
      return new Date(updatedAt.$date);
    }

    return null;
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

  private get fullSubscriptionsSyncIntervalMs(): number {
    return this.getPositiveInt("FULL_SUBSCRIPTIONS_SYNC_INTERVAL_MS", 3600000);
  }

  private get incrementalSubscriptionsSyncIntervalMs(): number {
    return this.getPositiveInt("INCREMENTAL_SUBSCRIPTIONS_SYNC_INTERVAL_MS", 900000);
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

  private get summarySourceMessageLimit(): number {
    return this.getPositiveInt("SUMMARY_SOURCE_MESSAGE_LIMIT", 100);
  }

  private get openAiApiKey(): string {
    const value = process.env.OPENAI_API_KEY;
    if (!value) {
      throw new Error("Missing required env var: OPENAI_API_KEY");
    }

    return value;
  }

  private get summaryModel(): string {
    return process.env.SUMMARY_MODEL ?? "gpt-4.1-mini";
  }

  private get embeddingModel(): string {
    return process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
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

  private extractOpenAiText(payload: OpenAiResponsesApiPayload): string {
    const directText = payload.output_text?.trim();
    if (directText) {
      return directText;
    }

    const nestedText = (payload.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || item.type === "text" || !item.type)
      .map((item) => item.text?.trim() ?? "")
      .filter((text) => text.length > 0)
      .join("\n")
      .trim();

    return nestedText;
  }

  private cleanSummaryText(text: string): string {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter(
        (line) =>
          !/^(the )?(rocket\.chat )?(conversation|chat) (shows|is about|focuses on)\b/i.test(line) &&
          !/^the user (discusses|talks about|mentions)\b/i.test(line)
      )
      .join("\n")
      .trim();
  }

  private async fetchWithContext(
    label: string,
    url: string,
    init?: RequestInit,
  ): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const causeMessage =
        error instanceof Error &&
        "cause" in error &&
        error.cause &&
        typeof error.cause === "object" &&
        "message" in error.cause &&
        typeof (error.cause as { message?: unknown }).message === "string"
          ? (error.cause as { message: string }).message
          : undefined;
      const codeMessage =
        error instanceof Error &&
        "cause" in error &&
        error.cause &&
        typeof error.cause === "object" &&
        "code" in error.cause &&
        typeof (error.cause as { code?: unknown }).code === "string"
          ? (error.cause as { code: string }).code
          : undefined;

      const details = [message, codeMessage, causeMessage]
        .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index)
        .join(" | ");

      throw new Error(`${label} failed for ${url}: ${details}`);
    }
  }
}
