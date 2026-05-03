import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { GoogleAuthGuard } from "./google.guard";
import type { SessionUser } from "./session-user";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  private getAuthenticatedUser(request: Request): SessionUser | undefined {
    return request.user as SessionUser | undefined;
  }

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    return;
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() request: Request, @Res() response: Response) {
    const user = this.getAuthenticatedUser(request);
    if (!user) {
      response.redirect(`/login?error=${encodeURIComponent("Google authentication failed")}`);
      return;
    }

    await this.authService.issueAuthCookies(response, user);
    request.logout?.(() => undefined);
    request.session?.destroy(() => undefined);
    const clientUrl = process.env.CLIENT_URL ?? "http://localhost:8080";
    response.redirect(`${clientUrl}/rocket-integration`);
  }

  @Get("session")
  async getSession(@Req() request: Request) {
    const user = this.getAuthenticatedUser(request);

    if (!user) {
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

  @Post("register")
  async register(
    @Req() _request: Request,
    @Res() response: Response,
    @Body() body: { email?: string; password?: string; name?: string },
  ) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();
    const name = body.name?.trim();

    if (!email || !password) {
      response.status(400).json({ message: "email and password are required" });
      return;
    }

    if (password.length < 8) {
      response.status(400).json({ message: "password must be at least 8 characters" });
      return;
    }

    try {
      const user = await this.authService.registerWithEmail({ email, password, name });
      await this.authService.issueAuthCookies(response, user);
      response.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      response.status(400).json({ message });
    }
  }

  @Post("login")
  async login(
    @Req() _request: Request,
    @Res() response: Response,
    @Body() body: { email?: string; password?: string },
  ) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!email || !password) {
      response.status(400).json({ message: "email and password are required" });
      return;
    }

    const user = await this.authService.validateEmailPassword(email, password);
    if (!user) {
      response.status(401).json({ message: "Invalid email or password" });
      return;
    }

    await this.authService.issueAuthCookies(response, user);
    response.status(200).json({
      success: true,
      user,
    });
  }

  @Post("logout")
  async logout(@Req() request: Request, @Res() response: Response) {
    const user = this.getAuthenticatedUser(request);
    if (user) {
      await this.authService.clearRefreshToken(user.id);
    }

    request.logout?.(() => undefined);
    request.session?.destroy(() => undefined);
    response.clearCookie(process.env.SESSION_COOKIE_NAME ?? "chat_assistant_session");
    this.authService.clearAuthCookies(response);
    response.status(200).json({ success: true });
  }
}
