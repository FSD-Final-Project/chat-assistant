import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthSerializer } from "./auth.serializer";
import { GoogleStrategy } from "./google.strategy";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    PassportModule.register({
      session: true,
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [GoogleStrategy, AuthSerializer],
})
export class AuthModule {}
