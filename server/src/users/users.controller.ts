import { Body, Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { SessionUser } from "../auth/session-user";
import { BotNotificationService } from "./bot-notification.service";
import { RocketSyncService } from "./rocket-sync.service";
import { UsersService } from "./users.service";
import type { RocketPreferenceColor } from "./schemas/rocket-subscription.schema";

interface RocketIntegrationBody {
  rocketUserToken?: string;
  rocketUserId?: string;
}

interface RocketSubscriptionsSyncBody {
  googleId?: string;
  email?: string;
  subscriptions?: Array<Record<string, unknown>>;
}

interface RocketMessagesSyncBody {
  googleId?: string;
  email?: string;
  roomId?: string;
  roomType?: string;
  messages?: Array<Record<string, unknown>>;
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

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rocketSyncService: RocketSyncService,
    private readonly botNotificationService: BotNotificationService,
  ) {}

  private isInternalRequestAuthorized(request: Request): boolean {
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      throw new Error("Missing INTERNAL_API_KEY on server");
    }

    const providedKey = request.header("x-internal-api-key");
    return Boolean(providedKey && providedKey === internalApiKey);
  }

  private getRocketBaseUrl(): string {
    const rocketUrl = process.env.RC_URL?.trim();
    if (!rocketUrl) {
      throw new Error("Missing RC_URL on server");
    }

    return rocketUrl.replace(/\/+$/, "");
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

  @Get("internal/rocket-auth/all")
  async getAllInternalRocketAuth(@Req() request: Request, @Res() response: Response) {
    try {
      if (!this.isInternalRequestAuthorized(request)) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }
    } catch (error) {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

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
    } catch (error) {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      response.status(400).json({ message: "email is required" });
      return;
    }

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
    response.status(200).json({
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.subscriptionId,
        roomId: subscription.roomId,
        roomType: subscription.roomType,
        preferenceColor: subscription.preferenceColor,
      })),
    });
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
    } catch (error) {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const googleId = body.googleId?.trim();
    const email = body.email?.trim().toLowerCase();
    const subscriptions = body.subscriptions ?? [];

    if (!googleId || !email) {
      response.status(400).json({ message: "googleId and email are required" });
      return;
    }

    await this.rocketSyncService.upsertSubscriptions(googleId, email, subscriptions);
    response.status(200).json({ success: true, count: subscriptions.length });
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
    } catch (error) {
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

    await this.rocketSyncService.upsertMessages(googleId, email, roomId, roomType, messages);
    response.status(200).json({ success: true, count: messages.length });
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

    response.status(200).json({
      success: true,
      notificationId: notification._id,
    });
  }

  @Post("me/rocket-integration")
  async saveRocketIntegration(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: RocketIntegrationBody,
  ) {
    const sessionUser = request.user as SessionUser | undefined;
    if (!request.isAuthenticated() || !sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const rocketUserToken = body.rocketUserToken?.trim();
    const rocketUserId = body.rocketUserId?.trim();

    if (!rocketUserToken || !rocketUserId) {
      response.status(400).json({ message: "rocketUserToken and rocketUserId are required" });
      return;
    }

    const user = await this.usersService.saveRocketIntegration(
      sessionUser.id,
      rocketUserToken,
      rocketUserId,
    );

    if (!user) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    response.status(200).json({
      success: true,
      user: {
        id: user.googleId,
        email: user.email,
        name: user.name,
        givenName: user.givenName,
        familyName: user.familyName,
        picture: user.picture,
        hasRocketIntegration: this.usersService.hasRocketIntegration(user),
      },
    });
  }

  @Get("me/rocket-subscriptions")
  async getMyRocketSubscriptions(@Req() request: Request, @Res() response: Response) {
    const sessionUser = request.user as SessionUser | undefined;
    if (!request.isAuthenticated() || !sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const subscriptions = await this.rocketSyncService.listSubscriptions(sessionUser.id);
    response.status(200).json({
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.subscriptionId,
        roomId: subscription.roomId,
        roomType: subscription.roomType,
        preferenceColor: subscription.preferenceColor,
        payload: subscription.payload,
        avatarUrl: `/users/me/rocket-subscriptions/${encodeURIComponent(subscription.subscriptionId)}/avatar`,
      })),
    });
  }

  @Post("me/rocket-subscriptions/:subscriptionId/preference-color")
  async updateMyRocketSubscriptionPreferenceColor(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: UpdateRocketSubscriptionPreferenceColorBody,
  ) {
    const sessionUser = request.user as SessionUser | undefined;
    if (!request.isAuthenticated() || !sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const rawSubscriptionId = request.params.subscriptionId;
    const subscriptionId =
      typeof rawSubscriptionId === "string" ? rawSubscriptionId.trim() : undefined;
    const preferenceColor = body.preferenceColor;

    if (!subscriptionId) {
      response.status(400).json({ message: "subscriptionId is required" });
      return;
    }

    if (!preferenceColor || !["red", "yellow", "green"].includes(preferenceColor)) {
      response.status(400).json({ message: "preferenceColor must be red, yellow, or green" });
      return;
    }

    const subscription = await this.rocketSyncService.updateSubscriptionPreferenceColor(
      sessionUser.id,
      subscriptionId,
      preferenceColor,
    );

    if (!subscription) {
      response.status(404).json({ message: "Subscription not found" });
      return;
    }

    response.status(200).json({
      success: true,
      subscription: {
        id: subscription.subscriptionId,
        preferenceColor: subscription.preferenceColor,
      },
    });
  }

  @Get("me/bot-notifications")
  async getMyBotNotifications(@Req() request: Request, @Res() response: Response) {
    const sessionUser = request.user as SessionUser | undefined;
    if (!request.isAuthenticated() || !sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const notifications = await this.botNotificationService.listPending(sessionUser.id);
    response.status(200).json({
      notifications: notifications.map((notification) => this.mapBotNotification(notification)),
    });
  }

  @Get("me/bot-notifications/stream")
  async streamMyBotNotifications(@Req() request: Request, @Res() response: Response) {
    const sessionUser = request.user as SessionUser | undefined;
    if (!request.isAuthenticated() || !sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();

    const writeSnapshot = async () => {
      const notifications = await this.botNotificationService.listPending(sessionUser.id);
      response.write(
        `event: notifications\ndata: ${JSON.stringify({
          notifications: notifications.map((notification) => this.mapBotNotification(notification)),
        })}\n\n`,
      );
    };

    await writeSnapshot();

    const unsubscribe = this.botNotificationService.subscribe(sessionUser.id, () => {
      void writeSnapshot();
    });

    const heartbeat = setInterval(() => {
      response.write(": keep-alive\n\n");
    }, 15000);

    request.on("close", () => {
      clearInterval(heartbeat);
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
    const sessionUser = request.user as SessionUser | undefined;
    if (!request.isAuthenticated() || !sessionUser) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to approve notification";
      response.status(500).json({ message });
    }
  }

  @Post("me/bot-notifications/:notificationId/dismiss")
  async dismissMyBotNotification(@Req() request: Request, @Res() response: Response) {
    const sessionUser = request.user as SessionUser | undefined;
    if (!request.isAuthenticated() || !sessionUser) {
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

    const notification = await this.botNotificationService.dismiss(sessionUser.id, notificationId);
    if (!notification) {
      response.status(404).json({ message: "Notification not found" });
      return;
    }

    response.status(200).json({ success: true });
  }

  @Get("me/rocket-subscriptions/:subscriptionId/avatar")
  async getMyRocketSubscriptionAvatar(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const sessionUser = request.user as SessionUser | undefined;
    if (!request.isAuthenticated() || !sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const rawSubscriptionId = request.params.subscriptionId;
    const subscriptionId =
      typeof rawSubscriptionId === "string" ? rawSubscriptionId.trim() : undefined;
    if (!subscriptionId) {
      response.status(400).json({ message: "subscriptionId is required" });
      return;
    }

    const subscription = await this.rocketSyncService.findSubscription(sessionUser.id, subscriptionId);
    if (!subscription) {
      response.status(404).json({ message: "Subscription not found" });
      return;
    }

    const user = await this.usersService.findByGoogleId(sessionUser.id);
    const rocketAuth = this.usersService.getDecryptedRocketIntegration(user);
    if (!rocketAuth) {
      response.status(404).json({ message: "Rocket.Chat credentials not found for user" });
      return;
    }

    let avatarUrl: string | null = null;
    try {
      avatarUrl = this.buildSubscriptionAvatarUrl(subscription.roomType, subscription.payload);
    } catch (error) {
      response.status(500).json({ message: "Missing RC_URL on server" });
      return;
    }

    if (!avatarUrl) {
      response.status(404).json({ message: "Avatar not available for subscription" });
      return;
    }

    const rocketResponse = await fetch(avatarUrl, {
      headers: {
        "X-Auth-Token": rocketAuth.userToken,
        "X-User-Id": rocketAuth.userId,
      },
      redirect: "follow",
    });

    if (!rocketResponse.ok) {
      response
        .status(rocketResponse.status)
        .json({ message: "Failed to fetch avatar from Rocket.Chat" });
      return;
    }

    const contentType = rocketResponse.headers.get("content-type");
    const cacheControl = rocketResponse.headers.get("cache-control");
    const buffer = Buffer.from(await rocketResponse.arrayBuffer());

    if (contentType) {
      response.setHeader("Content-Type", contentType);
    }

    if (cacheControl) {
      response.setHeader("Cache-Control", cacheControl);
    } else {
      response.setHeader("Cache-Control", "private, max-age=3600");
    }

    response.status(200).send(buffer);
  }
}
