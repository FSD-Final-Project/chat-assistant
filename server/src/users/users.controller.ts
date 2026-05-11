import { Body, Controller, Get, Logger, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { SessionUser } from "../auth/session-user";
import { BotNotificationService } from "./bot-notification.service";
import { RocketSyncService } from "./rocket-sync.service";
import { UsersService } from "./users.service";
import { EmbeddingService } from "./embedding.service";
import { RocketChatService } from "./rocket-chat.service";
import type { RocketPreferenceColor } from "./schemas/rocket-subscription.schema";

interface RocketIntegrationBody {
  rocketUserToken?: string;
  rocketUserId?: string;
}

interface RocketIntegrationDisconnectBody {
  googleId?: string;
  email?: string;
  rocketUserId?: string;
}

interface RocketSubscriptionsSyncBody {
  googleId?: string;
  email?: string;
  mode?: "full" | "delta";
  subscriptions?: Array<Record<string, unknown>>;
  removedSubscriptionIds?: string[];
}

interface RocketMessagesSyncBody {
  googleId?: string;
  email?: string;
  roomId?: string;
  roomType?: string;
  messages?: Array<Record<string, unknown>>;
}

interface RocketSyncStatusBody {
  googleId?: string;
  status?: "pending" | "syncing" | "completed" | "failed";
  error?: string;
}

interface InternalBotContextBody {
  googleId?: string;
  email?: string;
  roomId?: string;
  roomType?: string;
  subscriptionId?: string;
  contextLimit?: number;
  queryEmbedding?: number[];
  message?: Record<string, unknown>;
  includeSuggestion?: boolean;
}

interface InternalMessageSuggestionBody {
  googleId?: string;
  roomId?: string;
  messageId?: string;
  suggestion?: string;
}

interface InternalRocketSummaryBody {
  googleId?: string;
  email?: string;
  subscriptionId?: string;
  roomId?: string;
  roomType?: string;
  summary?: string;
  embedding?: number[];
  lastMessageId?: string;
  sourceMessageCount?: number;
  source?: "worker" | "bot";
}

interface RocketSubscriptionPayloadUser {
  _id?: string;
  username?: string;
  name?: string;
}

interface RocketSubscriptionPayload {
  name?: string;
  fname?: string;
  u?: RocketSubscriptionPayloadUser;
}

interface InternalBotSubscriptionsQuery {
  googleId?: string;
}

interface UpdateRocketSubscriptionPreferenceColorBody {
  preferenceColor?: RocketPreferenceColor;
}

interface BotActivationPreferencesBody {
  timeEnabled?: boolean;
  startTime?: string;
  endTime?: string;
  dateEnabled?: boolean;
  startDate?: string;
  endDate?: string;
}

interface InternalBotNotificationBody {
  googleId?: string;
  email?: string;
  roomId?: string;
  messageId?: string;
  subscriptionId?: string;
  roomType?: string;
  preferenceColor?: RocketPreferenceColor;
  kind?: "approval" | "info";
  senderName?: string;
  senderUsername?: string;
  incomingText?: string;
  suggestedReply?: string;
}

interface ApproveBotNotificationBody {
  replyText?: string;
}

interface SummaryContextResponse {
  subscriptionId: string;
  roomId: string;
  roomType?: string;
  summary: string;
  score?: number;
}

interface ActiveChatsQuery {
  start?: string;
  end?: string;
  limit?: string;
}

@Controller("users")
export class UsersController {
  private readonly logger = new Logger(UsersController.name);
  constructor(
    private readonly usersService: UsersService,
    private readonly rocketSyncService: RocketSyncService,
    private readonly embeddingService: EmbeddingService,
    private readonly botNotificationService: BotNotificationService,
    private readonly rocketChatService: RocketChatService,
  ) { }

  private isInternalRequestAuthorized(request: Request): boolean {
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      throw new Error("Missing INTERNAL_API_KEY on server");
    }

    const providedKey = request.header("x-internal-api-key");
    return Boolean(providedKey && providedKey === internalApiKey);
  }

  private getAuthenticatedUser(request: Request): SessionUser | undefined {
    return request.user as SessionUser | undefined;
  }

  private getRocketBaseUrl(): string {
    const rocketUrl = process.env.RC_URL?.trim();
    if (!rocketUrl) {
      throw new Error("Missing RC_URL on server");
    }

    return rocketUrl.replace(/\/+$/, "");
  }

  private getWorkerBaseUrl(): string {
    const workerUrl = process.env.USER_DATA_WORKER_URL?.trim();
    if (!workerUrl) {
      throw new Error("Missing USER_DATA_WORKER_URL on server");
    }

    return workerUrl.replace(/\/+$/, "");
  }

  private buildSubscriptionAvatarUrl(
    roomType: string | undefined,
    payload: Record<string, unknown>,
  ): string | null {
    const baseUrl = this.getRocketBaseUrl();
    const typedPayload = payload as RocketSubscriptionPayload;

    if (roomType === "d") {
      const username = typedPayload.u?.username ?? typedPayload.name;
      const userId = typedPayload.u?._id;

      if (username) {
        return `${baseUrl}/api/v1/users.getAvatar?username=${encodeURIComponent(username)}`;
      }

      if (userId) {
        return `${baseUrl}/api/v1/users.getAvatar?userId=${encodeURIComponent(userId)}`;
      }

      return null;
    }

    const roomName = typedPayload.name ?? typedPayload.fname;
    if (!roomName) {
      return null;
    }

    return `${baseUrl}/avatar/${encodeURIComponent(`@${roomName}`)}`;
  }

  private mapBotNotification(notification: {
    _id: unknown;
    roomId: string;
    roomType?: string;
    preferenceColor: RocketPreferenceColor;
    kind: "approval" | "info";
    senderName?: string;
    senderUsername?: string;
    incomingText: string;
    suggestedReply?: string;
    createdAt?: Date;
  }) {
    return {
      id: String(notification._id),
      roomId: notification.roomId,
      roomType: notification.roomType,
      preferenceColor: notification.preferenceColor,
      kind: notification.kind,
      senderName: notification.senderName,
      senderUsername: notification.senderUsername,
      incomingText: notification.incomingText,
      suggestedReply: notification.suggestedReply,
      createdAt: notification.createdAt,
    };
  }

  private mapSummaryContext(summary: {
    subscriptionId: string;
    roomId: string;
    roomType?: string;
    summary: string;
  }, score?: number): SummaryContextResponse {
    return {
      subscriptionId: summary.subscriptionId,
      roomId: summary.roomId,
      roomType: summary.roomType,
      summary: summary.summary,
      score,
    };
  }

  private getSubscriptionDisplayName(payload: Record<string, unknown>, roomId: string): string {
    const typedPayload = payload as RocketSubscriptionPayload;
    return (
      typedPayload.fname ??
      typedPayload.u?.name ??
      typedPayload.name ??
      typedPayload.u?.username ??
      roomId
    );
  }

  private isValidTime(value: string | undefined): value is string {
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private isValidDate(value: string | undefined): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
    const parsed = new Date(year, month - 1, day);
    return (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    );
  }

  private mapBotActivationPreferences(user: Parameters<UsersService["getBotActivationPreferences"]>[0]) {
    return this.usersService.getBotActivationPreferences(user);
  }

  private cosineSimilarity(left: number[], right: number[]): number {
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
      return 0;
    }

    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    for (let index = 0; index < left.length; index += 1) {
      const leftValue = left[index] ?? 0;
      const rightValue = right[index] ?? 0;
      dot += leftValue * rightValue;
      leftMagnitude += leftValue * leftValue;
      rightMagnitude += rightValue * rightValue;
    }

    if (leftMagnitude === 0 || rightMagnitude === 0) {
      return 0;
    }

    return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
  }

  private rankRelevantSummaries(
    summaries: Array<{
      subscriptionId: string;
      roomId: string;
      roomType?: string;
      summary: string;
      embedding: number[];
    }>,
    queryEmbedding: number[] | undefined,
    currentRoomId: string,
    limit: number,
  ): SummaryContextResponse[] {
    const candidates = summaries.filter(
      (summary) =>
        summary.roomId !== currentRoomId &&
        summary.summary.trim().length > 0 &&
        summary.embedding.length > 0,
    );

    if (!queryEmbedding || queryEmbedding.length === 0) {
      return candidates
        .slice(0, limit)
        .map((summary) => this.mapSummaryContext(summary));
    }

    return candidates
      .map((summary) => ({
        summary,
        score: this.cosineSimilarity(queryEmbedding, summary.embedding),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ summary, score }) => this.mapSummaryContext(summary, score));
  }

  private async triggerWorkerSyncForUser(googleId: string): Promise<void> {
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      throw new Error("Missing INTERNAL_API_KEY on server");
    }

    const response = await fetch(`${this.getWorkerBaseUrl()}/internal/sync-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": internalApiKey,
      },
      body: JSON.stringify({ googleId }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to trigger worker sync: ${response.status} ${body}`);
    }
  }

  @Get("internal/rocket-auth/all")
  async getAllInternalRocketAuth(@Req() request: Request, @Res() response: Response) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch (error: any) {
      this.logger.error(`Auth authorization failed: ${error.message}`, error.stack);
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    try {
      const users = await this.usersService.findAllWithRocketIntegration();
      response.status(200).json(
        users
          .map((user) => {
            const rocketAuth = this.usersService.getDecryptedRocketIntegration(user);
            if (!rocketAuth) {
              return null;
            }

            return {
              googleId: user.googleId,
              email: user.email,
              ...rocketAuth,
            };
          })
          .filter(Boolean),
      );
    } catch (error: any) {
      this.logger.error(`Failed to get all internal rocket auth: ${error.message}`, error.stack);
      response.status(500).json({ message: "Failed to get all internal rocket auth" });
    }
  }

  @Get("internal/rocket-auth")
  async getInternalRocketAuth(
    @Req() request: Request,
    @Res() response: Response,
    @Query("email") email?: string,
  ) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch (error: any) {
      this.logger.error(`Internal auth authorization failed: ${error.message}`, error.stack);
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      response.status(400).json({ message: "email is required" });
      return;
    }

    try {
      const user = await this.usersService.findByEmail(normalizedEmail);
      if (!user) {
        response.status(404).json({ message: "User not found" });
        return;
      }

      const rocketAuth = this.usersService.getDecryptedRocketIntegration(user);
      if (!rocketAuth) {
        response.status(404).json({ message: "Rocket.Chat credentials not found for user" });
        return;
      }

      response.status(200).json(rocketAuth);
    } catch (error: any) {
      this.logger.error(`Failed to get internal rocket auth for ${normalizedEmail}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
    }
  }

  @Get("internal/bot-subscriptions")
  async getInternalBotSubscriptions(
    @Req() request: Request,
    @Res() response: Response,
    @Query() query: InternalBotSubscriptionsQuery,
  ) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch (error) {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const googleId = query.googleId?.trim();
    if (!googleId) {
      response.status(400).json({ message: "googleId is required" });
      return;
    }

    const subscriptions = await this.rocketSyncService.listSubscriptions(googleId);
    const user = await this.usersService.findByGoogleId(googleId);
    response.status(200).json({
      botActivationPreferences: this.mapBotActivationPreferences(user),
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.subscriptionId,
        roomId: subscription.roomId,
        roomType: subscription.roomType,
        preferenceColor: subscription.preferenceColor,
      })),
    });
  }

  @Post("internal/rocket-sync/trigger-user")
  async triggerInternalRocketSyncForUser(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: { googleId?: string },
  ) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const googleId = body.googleId?.trim();
    if (!googleId) {
      response.status(400).json({ message: "googleId is required" });
      return;
    }

    try {
      await this.triggerWorkerSyncForUser(googleId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to trigger worker sync";
      response.status(500).json({ message });
      return;
    }

    response.status(202).json({ success: true });
  }

  @Get("internal/rocket-summaries/missing")
  async getInternalSubscriptionsMissingSummaries(
    @Req() request: Request,
    @Res() response: Response,
    @Query() query: InternalBotSubscriptionsQuery,
  ) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const googleId = query.googleId?.trim();
    if (!googleId) {
      response.status(400).json({ message: "googleId is required" });
      return;
    }

    const subscriptions = await this.rocketSyncService.listSubscriptionsMissingSummaries(googleId);
    response.status(200).json({
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.subscriptionId,
        roomId: subscription.roomId,
        roomType: subscription.roomType,
      })),
    });
  }

  @Post("internal/rocket-auth/disconnect")
  async disconnectInternalRocketAuth(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: RocketIntegrationDisconnectBody,
  ) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch (error) {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const googleId = body.googleId?.trim();
    const email = body.email?.trim().toLowerCase();
    const rocketUserId = body.rocketUserId?.trim();

    const user = googleId
      ? await this.usersService.findByGoogleId(googleId)
      : email
        ? await this.usersService.findByEmail(email)
        : null;

    if (!user) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    const rocketAuth = this.usersService.getDecryptedRocketIntegration(user);
    if (rocketUserId && rocketAuth?.userId && rocketAuth.userId !== rocketUserId) {
      response.status(409).json({ message: "Rocket.Chat user id does not match stored integration" });
      return;
    }

    await this.usersService.clearRocketIntegration(user.googleId);
    await this.rocketSyncService.clearRocketDataForUser(user.googleId);
    response.status(200).json({ success: true });
  }

  @Post("internal/rocket-sync/subscriptions")
  async syncSubscriptions(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: RocketSubscriptionsSyncBody,
  ) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch (error: any) {
      this.logger.error(`Sync subscriptions authorization failed: ${error.message}`, error.stack);
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const googleId = body.googleId?.trim();
    const email = body.email?.trim().toLowerCase();
    const mode = body.mode ?? "delta";
    const subscriptions = body.subscriptions ?? [];
    const removedSubscriptionIds = (body.removedSubscriptionIds ?? []).filter(
      (subscriptionId): subscriptionId is string => typeof subscriptionId === "string",
    );

    if (!googleId || !email) {
      response.status(400).json({ message: "googleId and email are required" });
      return;
    }

    try {
      if (mode === "full") {
        await this.rocketSyncService.reconcileSubscriptions(googleId, email, subscriptions);
      } else {
        await this.rocketSyncService.applySubscriptionDelta(
          googleId,
          email,
          subscriptions,
          removedSubscriptionIds,
        );
      }
    } catch (error: any) {
      this.logger.error(`Failed to sync subscriptions for ${email}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
      return;
    }

    response.status(200).json({
      success: true,
      count: subscriptions.length,
      removedCount: removedSubscriptionIds.length,
      mode,
    });
  }

  @Post("internal/rocket-sync/messages")
  async syncMessages(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: RocketMessagesSyncBody,
  ) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch (error: any) {
      this.logger.error(`Sync messages authorization failed: ${error.message}`, error.stack);
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const googleId = body.googleId?.trim();
    const email = body.email?.trim().toLowerCase();
    const roomId = body.roomId?.trim();
    const roomType = body.roomType?.trim();
    const messages = body.messages ?? [];

    if (!googleId || !email || !roomId) {
      response.status(400).json({ message: "googleId, email and roomId are required" });
      return;
    }

    try {
      await this.rocketSyncService.upsertMessages(googleId, email, roomId, roomType, messages);
      response.status(200).json({ success: true, count: messages.length });
    } catch (error: any) {
      this.logger.error(`Failed to sync messages for ${email} in room ${roomId}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
    }
  }

  @Post("internal/rocket-sync/status")
  async updateInternalRocketSyncStatus(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: RocketSyncStatusBody,
  ) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch (error) {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const googleId = body.googleId?.trim();
    const status = body.status;
    if (!googleId || !status || !["pending", "syncing", "completed", "failed"].includes(status)) {
      response.status(400).json({ message: "googleId and valid status are required" });
      return;
    }

    const user = await this.usersService.updateRocketSyncStatus(
      googleId,
      status,
      body.error?.trim(),
    );

    if (!user) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    response.status(200).json({ success: true });
  }

  @Post("internal/bot-notifications")
  async createInternalBotNotification(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: InternalBotNotificationBody,
  ) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch (error) {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const googleId = body.googleId?.trim();
    const email = body.email?.trim().toLowerCase();
    const roomId = body.roomId?.trim();
    const messageId = body.messageId?.trim();
    const incomingText = body.incomingText?.trim();
    const kind = body.kind;
    const preferenceColor = body.preferenceColor;

    if (!googleId || !email || !roomId || !messageId || !incomingText || !kind || !preferenceColor) {
      response.status(400).json({
        message:
          "googleId, email, roomId, messageId, incomingText, kind, and preferenceColor are required",
      });
      return;
    }

    if (!["approval", "info"].includes(kind)) {
      response.status(400).json({ message: "kind must be approval or info" });
      return;
    }

    if (!["red", "yellow", "green"].includes(preferenceColor)) {
      response.status(400).json({ message: "preferenceColor must be red, yellow, or green" });
      return;
    }

    const notification = await this.botNotificationService.createOrUpdatePending({
      appUserGoogleId: googleId,
      appUserEmail: email,
      roomId,
      messageId,
      subscriptionId: body.subscriptionId?.trim(),
      roomType: body.roomType?.trim(),
      preferenceColor,
      kind,
      senderName: body.senderName?.trim(),
      senderUsername: body.senderUsername?.trim(),
      incomingText,
      suggestedReply: body.suggestedReply?.trim(),
    });

    if (body.suggestedReply?.trim()) {
      await this.embeddingService.saveSuggestion(
        googleId,
        roomId,
        messageId,
        body.suggestedReply.trim(),
      );
    }

    response.status(200).json({
      success: true,
      notificationId: notification._id,
    });
  }

  @Post("internal/rocket-summaries")
  async saveInternalRocketSummary(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: InternalRocketSummaryBody,
  ) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const googleId = body.googleId?.trim();
    const subscriptionId = body.subscriptionId?.trim();
    const roomId = body.roomId?.trim();
    const summary = body.summary?.trim();

    if (!googleId || !subscriptionId || !roomId || !summary) {
      response.status(400).json({ message: "googleId, subscriptionId, roomId and summary are required" });
      return;
    }

    await this.rocketSyncService.upsertSummary({
      appUserGoogleId: googleId,
      appUserEmail: body.email?.trim().toLowerCase() || "",
      subscriptionId,
      roomId,
      roomType: body.roomType?.trim(),
      summary,
      embedding: body.embedding || [],
      lastMessageId: body.lastMessageId?.trim(),
      sourceMessageCount: body.sourceMessageCount || 0,
      source: body.source || "worker",
    });

    response.status(200).json({ success: true });
  }

  @Get("me/rocket-subscriptions")
  async getMyRocketSubscriptions(@Req() request: Request, @Res() response: Response) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const [subscriptions, user] = await Promise.all([
        this.rocketSyncService.listSubscriptions(sessionUser.id),
        this.usersService.findByGoogleId(sessionUser.id),
      ]);
      const rocketAuth = this.usersService.getDecryptedRocketIntegration(user);

      response.status(200).json({
        myRocketUserId: rocketAuth?.userId,
        subscriptions: subscriptions.map((subscription) => {
          const payload = subscription.payload as Record<string, unknown>;
          return {
            id: subscription.subscriptionId,
            roomId: subscription.roomId,
            roomType: subscription.roomType,
            displayName: this.getSubscriptionDisplayName(payload, subscription.roomId),
            avatarUrl: this.buildSubscriptionAvatarUrl(subscription.roomType, payload),
            preferenceColor: subscription.preferenceColor,
            updatedAt: subscription.updatedAt,
            payload,
          };
        }),
      });
    } catch (error: any) {
      this.logger.error(`Failed to get rocket subscriptions for ${sessionUser.id}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
    }
  }

  @Get("me/rocket-rooms/:roomId/messages")
  async getRoomMessages(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const roomId = request.params.roomId as string;
    if (!roomId) {
      response.status(400).json({ message: "roomId is required" });
      return;
    }

    try {
      const messages = await this.rocketSyncService.findMessagesByRoomId(sessionUser.id, roomId);
      response.status(200).json({ messages });
    } catch (error: any) {
      this.logger.error(`Failed to get room messages for ${sessionUser.id} in room ${roomId}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
    }
  }

  @Post("me/rocket-rooms/:roomId/messages")
  async postRoomMessage(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: { text: string },
  ) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const roomId = request.params.roomId as string;
    const text = body.text?.trim();

    if (!roomId || !text) {
      response.status(400).json({ message: "roomId and text are required" });
      return;
    }

    try {
      const message = await this.rocketChatService.postMessage(
        sessionUser.id,
        sessionUser.email,
        roomId,
        text,
      );

      // Auto-dismiss any pending bot notifications for this room since the user has replied manually
      await this.botNotificationService.dismissByRoomId(sessionUser.id, roomId);

      response.status(200).json({ success: true, message });
    } catch (error: any) {
      this.logger.error(`Failed to post message for user ${sessionUser.id} in room ${roomId}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Failed to post message" });
    }
  }

  @Get("me/rocket-rooms/:roomId/summary")
  async getRoomSummary(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const roomId = request.params.roomId as string;
    if (!roomId) {
      response.status(400).json({ message: "roomId is required" });
      return;
    }

    try {
      const summary = await this.rocketSyncService.findSummaryByRoomId(sessionUser.id, roomId);
      response.status(200).json({ summary });
    } catch (error: any) {
      this.logger.error(`Failed to get room summary for ${sessionUser.id} in room ${roomId}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
    }
  }

  @Post("me/rocket-rooms/:roomId/auto-reply-suggestion")
  async getAutoReplySuggestion(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: { messageText: string; messageId?: string },
  ) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const roomId = request.params.roomId as string;
    const messageText = body.messageText?.trim();
    const messageId = body.messageId?.trim();

    if (!roomId || !messageText) {
      response.status(400).json({ message: "roomId and messageText are required" });
      return;
    }

    try {
      // Check cache first
      if (messageId) {
        const cachedSuggestion = await this.embeddingService.findSuggestion(sessionUser.id, roomId, messageId);
        if (cachedSuggestion) {
          response.status(200).json({ suggestion: cachedSuggestion.suggestion });
          return;
        }
      }

      // 1. Get current room summary
      const currentSummary = await this.rocketSyncService.findSummaryByRoomId(sessionUser.id, roomId);

      // 2. Get all other room summaries for context
      const allSummaries = await this.rocketSyncService.listSummaries(sessionUser.id);

      // 3. Rank them if we have an embedding for the current query (not implemented yet, just take first 4)
      let context: any = null;
      if (currentSummary || allSummaries.length > 0) {
        const relevantSummaries = this.rankRelevantSummaries(
          allSummaries,
          undefined, // no query embedding for now
          roomId,
          4,
        );

        context = {
          currentSummary: currentSummary?.summary,
          relevantSummaries: relevantSummaries.map((s) => ({ roomId: s.roomId, summary: s.summary })),
        };
      }

      // 4. Generate suggestion
      const suggestion = await this.embeddingService.getAutoReplySuggestion(
        sessionUser.id,
        roomId,
        messageText,
        context,
      );

      // 5. Cache it if we have a messageId
      if (messageId) {
        await this.embeddingService.saveSuggestion(sessionUser.id, roomId, messageId, suggestion);
      }

      response.status(200).json({ suggestion });
    } catch (error: any) {
      this.logger.error(`Failed to generate auto-reply suggestion for user ${sessionUser.id} in room ${roomId}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Failed to generate auto-reply suggestion" });
    }
  }

  @Get("me/bot-notifications")
  async getMyBotNotifications(@Req() request: Request, @Res() response: Response) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const notifications = await this.botNotificationService.listPending(sessionUser.id);
      response.status(200).json({
        notifications: notifications.map((n) => this.mapBotNotification(n)),
      });
    } catch (error: any) {
      this.logger.error(`Failed to get bot notifications for ${sessionUser.id}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
    }
  }

  @Get("me/bot-notifications/stream")
  async streamMyBotNotifications(@Req() request: Request, @Res() response: Response) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const sendNotifications = async () => {
      const notifications = await this.botNotificationService.listPending(sessionUser.id);
      response.write(`event: notifications\ndata: ${JSON.stringify({
        notifications: notifications.map((n) => this.mapBotNotification(n)),
      })}\n\n`);
    };

    await sendNotifications();

    const unsubscribe = this.botNotificationService.subscribe(sessionUser.id, () => {
      void sendNotifications();
    });

    request.on("close", () => {
      unsubscribe();
      response.end();
    });
  }

  @Post("me/bot-notifications/:notificationId/approve")
  async approveMyBotNotification(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: ApproveBotNotificationBody,
  ) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const rawNotificationId = request.params.notificationId;
    const notificationId =
      typeof rawNotificationId === "string" ? rawNotificationId.trim() : undefined;
    const replyText = body.replyText?.trim();

    if (!notificationId || !replyText) {
      response.status(400).json({ message: "notificationId and replyText are required" });
      return;
    }

    try {
      const notification = await this.botNotificationService.approveAndSend(
        sessionUser.id,
        notificationId,
        replyText,
      );

      if (!notification) {
        response.status(404).json({ message: "Notification not found" });
        return;
      }

      response.status(200).json({ success: true });
    } catch (error: any) {
      this.logger.error(`Failed to approve bot notification ${notificationId}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Failed to approve bot notification" });
    }
  }

  @Post("me/bot-notifications/:notificationId/dismiss")
  async dismissMyBotNotification(@Req() request: Request, @Res() response: Response) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const rawNotificationId = request.params.notificationId;
    const notificationId =
      typeof rawNotificationId === "string" ? rawNotificationId.trim() : undefined;

    if (!notificationId) {
      response.status(400).json({ message: "notificationId is required" });
      return;
    }

    try {
      const notification = await this.botNotificationService.dismiss(sessionUser.id, notificationId);
      if (!notification) {
        response.status(404).json({ message: "Notification not found" });
        return;
      }

      response.status(200).json({ success: true });
    } catch (error: any) {
      this.logger.error(`Failed to dismiss bot notification ${notificationId}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Failed to dismiss bot notification" });
    }
  }

  @Post("me/rocket-subscriptions/:subscriptionId/preference-color")
  async updateRocketSubscriptionPreferenceColor(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: UpdateRocketSubscriptionPreferenceColorBody,
  ) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const subscriptionId = request.params.subscriptionId;
    const preferenceColor = body.preferenceColor;

    if (!subscriptionId || !preferenceColor) {
      response.status(400).json({ message: "subscriptionId and preferenceColor are required" });
      return;
    }

    if (!["red", "yellow", "green"].includes(preferenceColor)) {
      response.status(400).json({ message: "preferenceColor must be red, yellow, or green" });
      return;
    }

    try {
      const subscription = await this.rocketSyncService.updateSubscriptionPreferenceColor(
        sessionUser.id,
        subscriptionId as string,
        preferenceColor,
      );

      if (!subscription) {
        response.status(404).json({ message: "Subscription not found" });
        return;
      }

      response.status(200).json({ success: true });
    } catch (error: any) {
      this.logger.error(`Failed to update subscription preference color for ${sessionUser.id}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
    }
  }

  @Get("me/bot-activation-preferences")
  async getBotActivationPreferences(@Req() request: Request, @Res() response: Response) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const user = await this.usersService.findByGoogleId(sessionUser.id);
      response.status(200).json(this.mapBotActivationPreferences(user));
    } catch (error: any) {
      this.logger.error(`Failed to get bot activation preferences for ${sessionUser.id}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
    }
  }

  @Post("me/bot-activation-preferences")
  async updateBotActivationPreferences(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: BotActivationPreferencesBody,
  ) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { startTime, endTime, startDate, endDate } = body;

    if (startTime && !this.isValidTime(startTime)) {
      response.status(400).json({ message: "startTime must be in HH:mm format" });
      return;
    }

    if (endTime && !this.isValidTime(endTime)) {
      response.status(400).json({ message: "endTime must be in HH:mm format" });
      return;
    }

    if (startDate && !this.isValidDate(startDate)) {
      response.status(400).json({ message: "startDate must be in YYYY-MM-DD format" });
      return;
    }

    if (endDate && !this.isValidDate(endDate)) {
      response.status(400).json({ message: "endDate must be in YYYY-MM-DD format" });
      return;
    }

    try {
      const user = await this.usersService.saveBotActivationPreferences(sessionUser.id, body);
      response.status(200).json(this.mapBotActivationPreferences(user));
    } catch (error: any) {
      this.logger.error(`Failed to update bot activation preferences for ${sessionUser.id}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
    }
  }

  @Get("me/rocket-integration")
  async getRocketIntegration(@Req() request: Request, @Res() response: Response) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const user = await this.usersService.findByGoogleId(sessionUser.id);
      if (!user?.rocketIntegration) {
        response.status(404).json({ message: "Rocket.Chat integration not found" });
        return;
      }

      const rocketAuth = this.usersService.getDecryptedRocketIntegration(user);

      response.status(200).json({
        userId: rocketAuth?.userId,
        syncStatus: user.rocketIntegration.syncStatus,
        lastSyncError: user.rocketIntegration.syncError,
      });
    } catch (error: any) {
      this.logger.error(`Failed to get rocket integration for ${sessionUser.id}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Internal server error" });
    }
  }

  @Post("me/rocket-integration")
  async connectRocketChat(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: RocketIntegrationBody,
  ) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { rocketUserToken, rocketUserId } = body;
    if (!rocketUserToken || !rocketUserId) {
      response.status(400).json({ message: "rocketUserToken and rocketUserId are required" });
      return;
    }

    try {
      await this.usersService.saveRocketIntegration(sessionUser.id, rocketUserToken, rocketUserId);

      // Trigger initial sync
      await this.triggerWorkerSyncForUser(sessionUser.id);

      response.status(200).json({ success: true });
    } catch (error: any) {
      this.logger.error(`Failed to connect Rocket.Chat for ${sessionUser.id}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Failed to connect Rocket.Chat" });
    }
  }

  @Post("me/rocket-integration/disconnect")
  async disconnectRocketChat(@Req() request: Request, @Res() response: Response) {
    const sessionUser = this.getAuthenticatedUser(request);
    if (!sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      await this.usersService.clearRocketIntegration(sessionUser.id);
      await this.rocketSyncService.clearRocketDataForUser(sessionUser.id);
      response.status(200).json({ success: true });
    } catch (error: any) {
      this.logger.error(`Failed to disconnect Rocket.Chat for ${sessionUser.id}: ${error.message}`, error.stack);
      response.status(500).json({ message: "Failed to disconnect Rocket.Chat" });
    }
  }
}
