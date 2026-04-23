import { Body, Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { SessionUser } from "../auth/session-user";
import { UsersService } from "./users.service";

interface RocketIntegrationBody {
  rocketUserToken?: string;
  rocketUserId?: string;
}

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("internal/rocket-auth/all")
  async getAllInternalRocketAuth(@Req() request: Request, @Res() response: Response) {
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const providedKey = request.header("x-internal-api-key");
    if (!providedKey || providedKey !== internalApiKey) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const users = await this.usersService.findAllWithRocketIntegration();
    response.status(200).json(
      users
        .map((user) => {
          const rocketAuth = this.usersService.getDecryptedRocketIntegration(user);
          if (!rocketAuth) {
            return null;
          }

          return {
            email: user.email,
            ...rocketAuth,
          };
        })
        .filter(Boolean),
    );
  }

  @Get("internal/rocket-auth")
  async getInternalRocketAuth(
    @Req() request: Request,
    @Res() response: Response,
    @Query("email") email?: string,
  ) {
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on server" });
      return;
    }

    const providedKey = request.header("x-internal-api-key");
    if (!providedKey || providedKey !== internalApiKey) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      response.status(400).json({ message: "email is required" });
      return;
    }

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    const rocketAuth = this.usersService.getDecryptedRocketIntegration(user);
    if (!rocketAuth) {
      response.status(404).json({ message: "Rocket.Chat credentials not found for user" });
      return;
    }

    response.status(200).json(rocketAuth);
  }

  @Post("me/rocket-integration")
  async saveRocketIntegration(
    @Req() request: Request,
    @Res() response: Response,
    @Body() body: RocketIntegrationBody,
  ) {
    const sessionUser = request.user as SessionUser | undefined;
    if (!request.isAuthenticated() || !sessionUser) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const rocketUserToken = body.rocketUserToken?.trim();
    const rocketUserId = body.rocketUserId?.trim();

    if (!rocketUserToken || !rocketUserId) {
      response.status(400).json({ message: "rocketUserToken and rocketUserId are required" });
      return;
    }

    const user = await this.usersService.saveRocketIntegration(
      sessionUser.id,
      rocketUserToken,
      rocketUserId,
    );

    if (!user) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    response.status(200).json({
      success: true,
      user: {
        id: user.googleId,
        email: user.email,
        name: user.name,
        givenName: user.givenName,
        familyName: user.familyName,
        picture: user.picture,
        hasRocketIntegration: this.usersService.hasRocketIntegration(user),
      },
    });
  }
}
