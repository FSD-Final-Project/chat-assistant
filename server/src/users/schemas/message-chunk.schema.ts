import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

export type MessageChunkDocument = HydratedDocument<MessageChunkRecord>;

@Schema()
class MessageContent {
  @Prop({ required: true })
  user!: string;

  @Prop({ required: true })
  text!: string;

  @Prop({ required: true })
  timestamp!: Date;
}

const MessageContentSchema = SchemaFactory.createForClass(MessageContent);

@Schema({ timestamps: true })
export class MessageChunkRecord {
  @Prop({ required: true, index: true })
  appUserGoogleId!: string;

  @Prop({ required: true, index: true })
  roomId!: string;

  @Prop({ index: true })
  tmid?: string;

  @Prop({ type: [MessageContentSchema], required: true })
  messages!: MessageContent[];

  @Prop({ required: true })
  startTime!: Date;

  @Prop({ required: true })
  endTime!: Date;

  @Prop({ type: [Number], index: "2dsphere" }) // Note: MongoDB Vector Search uses a different index type, but we store as array
  embedding?: number[];

  @Prop()
  summary?: string;

  @Prop({ default: false, index: true })
  isClosed!: boolean;
}

export const MessageChunkSchema = SchemaFactory.createForClass(MessageChunkRecord);

// We don't add the vector index here as it must be created in MongoDB Atlas UI for Vector Search
