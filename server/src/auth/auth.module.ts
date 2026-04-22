import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthSerializer } from "./auth.serializer";
import { GoogleStrategy } from "./google.strategy";

@Module({
  imports: [
    PassportModule.register({
      session: true,
    }),
  ],
  controllers: [AuthController],
  providers: [GoogleStrategy, AuthSerializer],
})
export class AuthModule {}
