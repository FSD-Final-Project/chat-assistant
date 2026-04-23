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

  async findSubscription(
    appUserGoogleId: string,
    subscriptionId: string,
  ): Promise<RocketSubscriptionDocument | null> {
    return this.subscriptionModel.findOne({
      appUserGoogleId,
      subscriptionId,
    });
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
}
