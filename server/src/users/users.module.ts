import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersController } from "./users.controller";
import { User, UserSchema } from "./schemas/user.schema";
import {
  RocketMessageRecord,
  RocketMessageSchema,
} from "./schemas/rocket-message.schema";
import {
  RocketSummaryRecord,
  RocketSummarySchema,
} from "./schemas/rocket-summary.schema";
import {
  RocketSubscriptionRecord,
  RocketSubscriptionSchema,
} from "./schemas/rocket-subscription.schema";
import {
  MessageChunkRecord,
  MessageChunkSchema,
} from "./schemas/message-chunk.schema";
import {
  BotNotificationRecord,
  BotNotificationSchema,
} from "./schemas/bot-notification.schema";
import {
  MessageSuggestionRecord,
  MessageSuggestionSchema,
} from "./schemas/message-suggestion.schema";
import { BotNotificationService } from "./bot-notification.service";
import { RocketSyncService } from "./rocket-sync.service";
import { UsersService } from "./users.service";
import { EmbeddingService } from "./embedding.service";
import { ChunkProcessorService } from "./chunk-processor.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RocketSubscriptionRecord.name, schema: RocketSubscriptionSchema },
      { name: RocketMessageRecord.name, schema: RocketMessageSchema },
      { name: MessageChunkRecord.name, schema: MessageChunkSchema },
      { name: RocketSummaryRecord.name, schema: RocketSummarySchema },
      { name: BotNotificationRecord.name, schema: BotNotificationSchema },
      { name: MessageSuggestionRecord.name, schema: MessageSuggestionSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, RocketSyncService, EmbeddingService, ChunkProcessorService, BotNotificationService],
  exports: [UsersService, RocketSyncService, EmbeddingService, BotNotificationService],
})
export class UsersModule { }
