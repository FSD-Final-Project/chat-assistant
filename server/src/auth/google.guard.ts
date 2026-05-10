import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const clientUrl = process.env.CLIENT_URL ?? "http://localhost:8080";

    if (request.path.includes("/callback")) {
      return {
        session: false,
        failureRedirect: `${clientUrl}/login?error=Google%20authentication%20failed`,
      };
    }

    return {
      session: false,
    };
  }
}
