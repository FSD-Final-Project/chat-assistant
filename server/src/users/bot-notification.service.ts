import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EventEmitter } from "events";
import { BotNotificationRecord, type BotNotificationDocument, type BotNotificationKind } from "./schemas/bot-notification.schema";
import type { RocketPreferenceColor } from "./schemas/rocket-subscription.schema";
import { UsersService } from "./users.service";

interface CreateBotNotificationInput {
  appUserGoogleId: string;
  appUserEmail: string;
  roomId: string;
  messageId: string;
  subscriptionId?: string;
  roomType?: string;
  preferenceColor: RocketPreferenceColor;
  kind: BotNotificationKind;
  senderName?: string;
  senderUsername?: string;
  incomingText: string;
  suggestedReply?: string;
}

@Injectable()
export class BotNotificationService {
  private readonly events = new EventEmitter();

  constructor(
    @InjectModel(BotNotificationRecord.name)
    private readonly botNotificationModel: Model<BotNotificationDocument>,
    private readonly usersService: UsersService,
  ) {}

  async createOrUpdatePending(input: CreateBotNotificationInput): Promise<BotNotificationDocument> {
    const notification = await this.botNotificationModel.findOneAndUpdate(
      {
        appUserGoogleId: input.appUserGoogleId,
        messageId: input.messageId,
      },
      {
        $set: {
          appUserGoogleId: input.appUserGoogleId,
          appUserEmail: input.appUserEmail,
          roomId: input.roomId,
          messageId: input.messageId,
          subscriptionId: input.subscriptionId,
          roomType: input.roomType,
          preferenceColor: input.preferenceColor,
          kind: input.kind,
          senderName: input.senderName,
          senderUsername: input.senderUsername,
          incomingText: input.incomingText,
          suggestedReply: input.suggestedReply,
          status: "pending",
        },
      },
      { new: true, upsert: true },
    );

    if (!notification) {
      throw new Error("Failed to persist bot notification");
    }

    await this.emitPendingChanged(input.appUserGoogleId);
    return notification;
  }

  async listPending(appUserGoogleId: string): Promise<BotNotificationDocument[]> {
    return this.botNotificationModel
      .find({
        appUserGoogleId,
        status: "pending",
      })
      .sort({ createdAt: -1, _id: -1 });
  }

  async findPendingById(
    appUserGoogleId: string,
    notificationId: string,
  ): Promise<BotNotificationDocument | null> {
    return this.botNotificationModel.findOne({
      _id: notificationId,
      appUserGoogleId,
      status: "pending",
    });
  }

  async dismiss(appUserGoogleId: string, notificationId: string): Promise<BotNotificationDocument | null> {
    const notification = await this.botNotificationModel.findOneAndUpdate(
      {
        _id: notificationId,
        appUserGoogleId,
        status: "pending",
      },
      {
        $set: {
          status: "dismissed",
        },
      },
      { new: true },
    );

    if (notification) {
      await this.emitPendingChanged(appUserGoogleId);
    }

    return notification;
  }

  async approveAndSend(
    appUserGoogleId: string,
    notificationId: string,
    replyText: string,
  ): Promise<BotNotificationDocument | null> {
    const notification = await this.findPendingById(appUserGoogleId, notificationId);
    if (!notification) {
      return null;
    }

    const user = await this.usersService.findByGoogleId(appUserGoogleId);
    const rocketAuth = this.usersService.getDecryptedRocketIntegration(user);
    if (!rocketAuth) {
      throw new Error("Rocket.Chat credentials not found for user");
    }

    const rocketUrl = process.env.RC_URL?.trim();
    if (!rocketUrl) {
      throw new Error("Missing RC_URL on server");
    }

    const response = await fetch(`${rocketUrl.replace(/\/+$/, "")}/api/v1/chat.postMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": rocketAuth.userToken,
        "X-User-Id": rocketAuth.userId,
      },
      body: JSON.stringify({
        roomId: notification.roomId,
        text: replyText,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to send Rocket.Chat reply: ${response.status} ${body}`);
    }

    const updatedNotification = await this.botNotificationModel.findByIdAndUpdate(
      notification._id,
      {
        $set: {
          status: "approved",
          approvedReply: replyText,
        },
      },
      { new: true },
    );

    await this.emitPendingChanged(appUserGoogleId);
    return updatedNotification;
  }

  async aggregateStats(
    appUserGoogleId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ greenCount: number; manualCount: number; yellowTotal: number; yellowApproved: number }> {
    const match: Record<string, unknown> = { appUserGoogleId };
    if (startDate || endDate) {
      match.createdAt = {
        ...(startDate ? { $gte: startDate } : {}),
        ...(endDate ? { $lte: endDate } : {}),
      };
    }

    const result = await this.botNotificationModel.aggregate<{
      greenCount: number;
      manualCount: number;
      yellowTotal: number;
      yellowApproved: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          greenCount: {
            $sum: { $cond: [{ $eq: ["$preferenceColor", "green"] }, 1, 0] },
          },
          manualCount: {
            $sum: { $cond: [{ $ne: ["$preferenceColor", "green"] }, 1, 0] },
          },
          yellowTotal: {
            $sum: { $cond: [{ $eq: ["$preferenceColor", "yellow"] }, 1, 0] },
          },
          yellowApproved: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$preferenceColor", "yellow"] },
                    { $eq: ["$status", "approved"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    return result[0] ?? { greenCount: 0, manualCount: 0, yellowTotal: 0, yellowApproved: 0 };
  }

  subscribe(appUserGoogleId: string, listener: () => void): () => void {
    const eventName = this.getEventName(appUserGoogleId);
    this.events.on(eventName, listener);
    return () => {
      this.events.off(eventName, listener);
    };
  }

  private getEventName(appUserGoogleId: string): string {
    return `pending-changed:${appUserGoogleId}`;
  }

  private async emitPendingChanged(appUserGoogleId: string): Promise<void> {
    this.events.emit(this.getEventName(appUserGoogleId));
  }
}
