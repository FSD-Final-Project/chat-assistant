import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleStrategy } from "./google.strategy";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    PassportModule.register({
      session: false,
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [GoogleStrategy, AuthService],
  exports: [AuthService],
})
export class AuthModule {}
