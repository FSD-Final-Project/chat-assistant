import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { RocketPreferenceColor } from "./rocket-subscription.schema";

export type BotNotificationDocument = HydratedDocument<BotNotificationRecord>;
export type BotNotificationStatus = "pending" | "approved" | "dismissed";
export type BotNotificationKind = "approval" | "info";

@Schema({ timestamps: true })
export class BotNotificationRecord {
  @Prop({ required: true, index: true })
  appUserGoogleId!: string;

  @Prop({ required: true, index: true })
  appUserEmail!: string;

  @Prop({ required: true, index: true })
  roomId!: string;

  @Prop({ required: true })
  messageId!: string;

  @Prop()
  subscriptionId?: string;

  @Prop()
  roomType?: string;

  @Prop({ required: true, enum: ["red", "yellow", "green"] })
  preferenceColor!: RocketPreferenceColor;

  @Prop({ required: true, enum: ["approval", "info"] })
  kind!: BotNotificationKind;

  @Prop({ required: true, enum: ["pending", "approved", "dismissed"], default: "pending", index: true })
  status!: BotNotificationStatus;

  @Prop()
  senderName?: string;

  @Prop()
  senderUsername?: string;

  @Prop({ required: true })
  incomingText!: string;

  @Prop()
  suggestedReply?: string;

  @Prop()
  approvedReply?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BotNotificationSchema = SchemaFactory.createForClass(BotNotificationRecord);
BotNotificationSchema.index({ appUserGoogleId: 1, messageId: 1 }, { unique: true });
