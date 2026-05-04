import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type RocketSummaryDocument = HydratedDocument<RocketSummaryRecord>;

@Schema({ timestamps: true })
export class RocketSummaryRecord {
  @Prop({ required: true, index: true })
  appUserGoogleId!: string;

  @Prop({ required: true, index: true })
  appUserEmail!: string;

  @Prop({ required: true, index: true })
  subscriptionId!: string;

  @Prop({ required: true, index: true })
  roomId!: string;

  @Prop()
  roomType?: string;

  @Prop({ required: true })
  summary!: string;

  @Prop({ type: [Number], default: [] })
  embedding!: number[];

  @Prop()
  lastMessageId?: string;

  @Prop()
  sourceMessageCount?: number;

  @Prop({ required: true, enum: ["worker", "bot"], default: "worker" })
  source!: "worker" | "bot";
}

export const RocketSummarySchema = SchemaFactory.createForClass(RocketSummaryRecord);
RocketSummarySchema.index({ appUserGoogleId: 1, subscriptionId: 1 }, { unique: true });
