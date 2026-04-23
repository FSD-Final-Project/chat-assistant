import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

export type RocketMessageDocument = HydratedDocument<RocketMessageRecord>;

@Schema({ timestamps: true })
export class RocketMessageRecord {
  @Prop({ required: true, index: true })
  appUserGoogleId!: string;

  @Prop({ required: true, index: true })
  appUserEmail!: string;

  @Prop({ required: true, index: true })
  roomId!: string;

  @Prop({ required: true })
  messageId!: string;

  @Prop()
  roomType?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload!: Record<string, unknown>;
}

export const RocketMessageSchema = SchemaFactory.createForClass(RocketMessageRecord);
RocketMessageSchema.index({ appUserGoogleId: 1, messageId: 1 }, { unique: true });
