import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type MessageSuggestionDocument = HydratedDocument<MessageSuggestionRecord>;

@Schema({ timestamps: true })
export class MessageSuggestionRecord {
  @Prop({ required: true, index: true })
  appUserGoogleId!: string;

  @Prop({ required: true, index: true })
  roomId!: string;

  @Prop({ required: true, index: true })
  messageId!: string;

  @Prop({ required: true })
  suggestion!: string;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;
}

export const MessageSuggestionSchema = SchemaFactory.createForClass(MessageSuggestionRecord);
MessageSuggestionSchema.index({ appUserGoogleId: 1, messageId: 1 }, { unique: true });
MessageSuggestionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
