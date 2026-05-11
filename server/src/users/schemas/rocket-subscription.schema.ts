import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

export type RocketSubscriptionDocument = HydratedDocument<RocketSubscriptionRecord>;
export type RocketPreferenceColor = "red" | "yellow" | "green";

@Schema({ timestamps: true })
export class RocketSubscriptionRecord {
  @Prop({ required: true, index: true })
  appUserGoogleId!: string;

  @Prop({ required: true, index: true })
  appUserEmail!: string;

  @Prop({ required: true })
  subscriptionId!: string;

  @Prop({ required: true, index: true })
  roomId!: string;

  @Prop()
  roomType?: string;

  @Prop({ required: true, enum: ["red", "yellow", "green"], default: "yellow" })
  preferenceColor!: RocketPreferenceColor;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload!: Record<string, unknown>;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RocketSubscriptionSchema = SchemaFactory.createForClass(RocketSubscriptionRecord);
RocketSubscriptionSchema.index({ appUserGoogleId: 1, subscriptionId: 1 }, { unique: true });
