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
}

export const MessageSuggestionSchema = SchemaFactory.createForClass(MessageSuggestionRecord);
MessageSuggestionSchema.index({ appUserGoogleId: 1, messageId: 1 }, { unique: true });
MessageSuggestionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 7 }); // Keep for 7 days
