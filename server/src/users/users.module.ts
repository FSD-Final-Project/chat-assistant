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
import { RocketSyncService } from "./rocket-sync.service";
import { UsersService } from "./users.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RocketSubscriptionRecord.name, schema: RocketSubscriptionSchema },
      { name: RocketMessageRecord.name, schema: RocketMessageSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, RocketSyncService],
  exports: [UsersService, RocketSyncService],
})
export class UsersModule {}
