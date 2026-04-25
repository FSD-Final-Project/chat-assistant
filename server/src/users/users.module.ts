import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersController } from "./users.controller";
import { User, UserSchema } from "./schemas/user.schema";
import {
  RocketMessageRecord,
  RocketMessageSchema,
} from "./schemas/rocket-message.schema";
import {
  RocketSubscriptionRecord,
  RocketSubscriptionSchema,
} from "./schemas/rocket-subscription.schema";
import {
  BotNotificationRecord,
  BotNotificationSchema,
} from "./schemas/bot-notification.schema";
import { BotNotificationService } from "./bot-notification.service";
import { RocketSyncService } from "./rocket-sync.service";
import { UsersService } from "./users.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RocketSubscriptionRecord.name, schema: RocketSubscriptionSchema },
      { name: RocketMessageRecord.name, schema: RocketMessageSchema },
      { name: BotNotificationRecord.name, schema: BotNotificationSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, RocketSyncService, BotNotificationService],
  exports: [UsersService, RocketSyncService, BotNotificationService],
})
export class UsersModule {}
