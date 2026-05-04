import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  RocketSubscriptionRecord,
  type RocketSubscriptionDocument,
  type RocketPreferenceColor,
} from "./schemas/rocket-subscription.schema";
import {
  RocketMessageRecord,
  type RocketMessageDocument,
} from "./schemas/rocket-message.schema";
import {
  RocketSummaryRecord,
  type RocketSummaryDocument,
} from "./schemas/rocket-summary.schema";

interface RocketSubscriptionPayload {
  _id?: string;
  rid?: string;
  t?: string;
  [key: string]: unknown;
}

interface RocketMessagePayload {
  _id?: string;
  [key: string]: unknown;
}

@Injectable()
export class RocketSyncService {
  constructor(
    @InjectModel(RocketSubscriptionRecord.name)
    private readonly subscriptionModel: Model<RocketSubscriptionDocument>,
    @InjectModel(RocketMessageRecord.name)
    private readonly messageModel: Model<RocketMessageDocument>,
    @InjectModel(RocketSummaryRecord.name)
    private readonly summaryModel: Model<RocketSummaryDocument>,
  ) {}

  async upsertSubscriptions(
    appUserGoogleId: string,
    appUserEmail: string,
    subscriptions: RocketSubscriptionPayload[],
  ): Promise<void> {
    const subscriptionOps = subscriptions
      .filter((subscription) => subscription._id && subscription.rid)
      .map((subscription) => ({
        updateOne: {
          filter: {
            appUserGoogleId,
            subscriptionId: subscription._id,
          },
          update: {
            $set: {
              appUserGoogleId,
              appUserEmail,
              subscriptionId: subscription._id,
              roomId: subscription.rid,
              roomType: typeof subscription.t === "string" ? subscription.t : undefined,
              payload: subscription,
            },
            $setOnInsert: {
              preferenceColor: "yellow" as RocketPreferenceColor,
            },
          },
          upsert: true,
        },
      }));

    if (subscriptionOps.length > 0) {
      await this.subscriptionModel.bulkWrite(subscriptionOps, { ordered: false });
    }
  }

  async reconcileSubscriptions(
    appUserGoogleId: string,
    appUserEmail: string,
    subscriptions: RocketSubscriptionPayload[],
  ): Promise<void> {
    await this.upsertSubscriptions(appUserGoogleId, appUserEmail, subscriptions);

    const activeSubscriptionIds = subscriptions
      .map((subscription) => subscription._id)
      .filter((subscriptionId): subscriptionId is string => typeof subscriptionId === "string");

    if (activeSubscriptionIds.length === 0) {
      await this.subscriptionModel.deleteMany({ appUserGoogleId });
      return;
    }

    await this.subscriptionModel.deleteMany({
      appUserGoogleId,
      subscriptionId: { $nin: activeSubscriptionIds },
    });
  }

  async removeSubscriptionsByIds(
    appUserGoogleId: string,
    subscriptionIds: string[],
  ): Promise<void> {
    const normalizedIds = subscriptionIds.filter((subscriptionId) => Boolean(subscriptionId));
    if (normalizedIds.length === 0) {
      return;
    }

    await this.subscriptionModel.deleteMany({
      appUserGoogleId,
      subscriptionId: { $in: normalizedIds },
    });
  }

  async applySubscriptionDelta(
    appUserGoogleId: string,
    appUserEmail: string,
    updatedSubscriptions: RocketSubscriptionPayload[],
    removedSubscriptionIds: string[],
  ): Promise<void> {
    await this.upsertSubscriptions(appUserGoogleId, appUserEmail, updatedSubscriptions);
    await this.removeSubscriptionsByIds(appUserGoogleId, removedSubscriptionIds);
  }

  async upsertMessages(
    appUserGoogleId: string,
    appUserEmail: string,
    roomId: string,
    roomType: string | undefined,
    messages: RocketMessagePayload[],
  ): Promise<void> {
    const messageOps = messages
      .filter((message) => message._id)
      .map((message) => ({
        updateOne: {
          filter: {
            appUserGoogleId,
            messageId: message._id,
          },
          update: {
            $set: {
              appUserGoogleId,
              appUserEmail,
              roomId,
              messageId: message._id,
              roomType,
              payload: message,
            },
          },
          upsert: true,
        },
      }));

    if (messageOps.length > 0) {
      await this.messageModel.bulkWrite(messageOps, { ordered: false });
    }
  }

  async listSubscriptions(appUserGoogleId: string): Promise<RocketSubscriptionDocument[]> {
    return this.subscriptionModel
      .find({ appUserGoogleId })
      .sort({ updatedAt: -1, createdAt: -1, subscriptionId: 1 });
  }

  async listSubscriptionsMissingSummaries(
    appUserGoogleId: string,
  ): Promise<RocketSubscriptionDocument[]> {
    const [subscriptions, summaries] = await Promise.all([
      this.subscriptionModel.find({ appUserGoogleId }),
      this.summaryModel.find({ appUserGoogleId }).select({ subscriptionId: 1 }),
    ]);

    const summarizedIds = new Set(
      summaries
        .map((summary) => summary.subscriptionId)
        .filter((subscriptionId): subscriptionId is string => typeof subscriptionId === "string"),
    );

    return subscriptions.filter(
      (subscription) => !summarizedIds.has(subscription.subscriptionId),
    );
  }

  async findSubscription(
    appUserGoogleId: string,
    subscriptionId: string,
  ): Promise<RocketSubscriptionDocument | null> {
    return this.subscriptionModel.findOne({
      appUserGoogleId,
      subscriptionId,
    });
  }

  async findSubscriptionByRoomId(
    appUserGoogleId: string,
    roomId: string,
  ): Promise<RocketSubscriptionDocument | null> {
    return this.subscriptionModel.findOne({
      appUserGoogleId,
      roomId,
    });
  }

  async listRecentMessages(
    appUserGoogleId: string,
    roomId: string,
    limit: number,
  ): Promise<RocketMessageDocument[]> {
    return this.messageModel
      .find({ appUserGoogleId, roomId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit);
  }

  async updateSubscriptionPreferenceColor(
    appUserGoogleId: string,
    subscriptionId: string,
    preferenceColor: RocketPreferenceColor,
  ): Promise<RocketSubscriptionDocument | null> {
    return this.subscriptionModel.findOneAndUpdate(
      {
        appUserGoogleId,
        subscriptionId,
      },
      {
        $set: {
          preferenceColor,
        },
      },
      { new: true },
    );
  }

  async upsertSummary(input: {
    appUserGoogleId: string;
    appUserEmail: string;
    subscriptionId: string;
    roomId: string;
    roomType?: string;
    summary: string;
    embedding: number[];
    lastMessageId?: string;
    sourceMessageCount?: number;
    source: "worker" | "bot";
  }): Promise<RocketSummaryDocument | null> {
    return this.summaryModel.findOneAndUpdate(
      {
        appUserGoogleId: input.appUserGoogleId,
        subscriptionId: input.subscriptionId,
      },
      {
        $set: {
          appUserGoogleId: input.appUserGoogleId,
          appUserEmail: input.appUserEmail,
          subscriptionId: input.subscriptionId,
          roomId: input.roomId,
          roomType: input.roomType,
          summary: input.summary,
          embedding: input.embedding,
          lastMessageId: input.lastMessageId,
          sourceMessageCount: input.sourceMessageCount,
          source: input.source,
        },
      },
      { new: true, upsert: true },
    );
  }

  async findSummaryBySubscriptionId(
    appUserGoogleId: string,
    subscriptionId: string,
  ): Promise<RocketSummaryDocument | null> {
    return this.summaryModel.findOne({
      appUserGoogleId,
      subscriptionId,
    });
  }

  async findSummaryByRoomId(
    appUserGoogleId: string,
    roomId: string,
  ): Promise<RocketSummaryDocument | null> {
    return this.summaryModel.findOne({
      appUserGoogleId,
      roomId,
    });
  }

  async listSummaries(appUserGoogleId: string): Promise<RocketSummaryDocument[]> {
    return this.summaryModel
      .find({ appUserGoogleId })
      .sort({ updatedAt: -1, createdAt: -1, roomId: 1 });
  }

  async listActiveChats(
    appUserGoogleId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit: number;
    },
  ): Promise<
    Array<{
      roomId: string;
      messageCount: number;
      subscription?: RocketSubscriptionDocument | null;
      summary?: RocketSummaryDocument | null;
    }>
  > {
    const match: Record<string, unknown> = {
      appUserGoogleId,
    };

    if (options.startDate || options.endDate) {
      match.createdAt = {
        ...(options.startDate ? { $gte: options.startDate } : {}),
        ...(options.endDate ? { $lte: options.endDate } : {}),
      };
    }

    const counts = await this.messageModel.aggregate<{
      _id: string;
      messageCount: number;
    }>([
      { $match: match },
      { $group: { _id: "$roomId", messageCount: { $sum: 1 } } },
      { $sort: { messageCount: -1, _id: 1 } },
      { $limit: options.limit },
    ]);

    if (counts.length === 0) {
      return [];
    }

    const roomIds = counts.map((item) => item._id);
    const [subscriptions, summaries] = await Promise.all([
      this.subscriptionModel.find({ appUserGoogleId, roomId: { $in: roomIds } }),
      this.summaryModel.find({ appUserGoogleId, roomId: { $in: roomIds } }),
    ]);

    const subscriptionByRoomId = new Map(
      subscriptions.map((subscription) => [subscription.roomId, subscription]),
    );
    const summaryByRoomId = new Map(
      summaries.map((summary) => [summary.roomId, summary]),
    );

    return counts.map((count) => ({
      roomId: count._id,
      messageCount: count.messageCount,
      subscription: subscriptionByRoomId.get(count._id) ?? null,
      summary: summaryByRoomId.get(count._id) ?? null,
    }));
  }
}
