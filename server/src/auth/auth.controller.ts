import { Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { GoogleAuthGuard } from "./google.guard";
import type { SessionUser } from "./session-user";
import { UsersService } from "../users/users.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    return;
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  googleAuthRedirect(@Res() response: Response) {
    const clientUrl = process.env.CLIENT_URL ?? "http://localhost:8080";
    response.redirect(`${clientUrl}/rocket-integration`);
  }

  @Get("session")
  async getSession(@Req() request: Request) {
    const user = request.user as SessionUser | undefined;

    if (!request.isAuthenticated() || !user) {
      return {
        authenticated: false,
        user: null,
      };
    }

    const appUser = await this.usersService.findByGoogleId(user.id);

    return {
      authenticated: true,
      user: appUser
        ? {
            id: appUser.googleId,
            email: appUser.email,
            name: appUser.name,
            givenName: appUser.givenName,
            familyName: appUser.familyName,
            picture: appUser.picture,
            hasRocketIntegration: this.usersService.hasRocketIntegration(appUser),
          }
        : {
            ...user,
            hasRocketIntegration: false,
          },
    };
  }

  @Post("logout")
  logout(@Req() request: Request, @Res() response: Response) {
    request.logout((logoutError) => {
      if (logoutError) {
        response.status(500).json({ message: "Logout failed" });
        return;
      }

      request.session.destroy(() => {
        response.clearCookie(process.env.SESSION_COOKIE_NAME ?? "chat_assistant_session");
        response.status(200).json({ success: true });
      });
    });
  }
}
