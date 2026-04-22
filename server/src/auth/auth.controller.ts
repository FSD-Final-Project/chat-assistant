import { Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { GoogleAuthGuard } from "./google.guard";
import type { SessionUser } from "./session-user";

@Controller("auth")
export class AuthController {
  @Get("google")
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    return;
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  googleAuthRedirect(@Res() response: Response) {
    const clientUrl = process.env.CLIENT_URL ?? "http://localhost:8080";
    response.redirect(`${clientUrl}/`);
  }

  @Get("session")
  getSession(@Req() request: Request) {
    const user = request.user as SessionUser | undefined;

    if (!request.isAuthenticated() || !user) {
      return {
        authenticated: false,
        user: null,
      };
    }

    return {
      authenticated: true,
      user,
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
