import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { SessionUser } from "./session-user";
import { UsersService } from "../users/users.service";
import type { RocketIntegration } from "../users/schemas/user.schema";

interface TokenPayload {
  sub: string;
  type: "access" | "refresh";
  exp: number;
}

interface LocalRegisterInput {
  email: string;
  password: string;
  name?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async registerWithEmail(input: LocalRegisterInput): Promise<SessionUser> {
    const existingUser = await this.usersService.findByEmail(input.email);
    if (existingUser) {
      throw new Error("A user with this email already exists");
    }

    const normalizedName = input.name?.trim() || input.email.split("@")[0] || "Workspace User";
    const user = await this.usersService.createLocalUser({
      id: `local:${randomUUID()}`,
      email: input.email,
      name: normalizedName,
      passwordHash: this.hashPassword(input.password),
    });

    return this.toSessionUser(user);
  }

  async validateEmailPassword(email: string, password: string): Promise<SessionUser | null> {
    const user = await this.usersService.findByEmail(email);
    const passwordHash = user?.localAuth?.passwordHash;

    if (!user || !passwordHash) {
      return null;
    }

    if (!this.verifyPassword(password, passwordHash)) {
      return null;
    }

    return this.toSessionUser(user);
  }

  async persistRefreshToken(userId: string, refreshToken: string, expiresAt: Date): Promise<void> {
    await this.usersService.saveRefreshToken(userId, this.hashRefreshToken(refreshToken), expiresAt);
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.usersService.clearRefreshToken(userId);
  }

  async issueAuthCookies(response: Response, user: SessionUser): Promise<void> {
    const accessToken = this.signToken({
      sub: user.id,
      type: "access",
      exp: Date.now() + this.accessTokenTtlMs,
    });
    const refreshToken = this.signToken({
      sub: user.id,
      type: "refresh",
      exp: Date.now() + this.refreshTokenTtlMs,
    });

    response.cookie(this.accessTokenCookieName, accessToken, this.buildCookieOptions(this.accessTokenTtlMs));
    response.cookie(this.refreshTokenCookieName, refreshToken, this.buildCookieOptions(this.refreshTokenTtlMs));
    await this.persistRefreshToken(user.id, refreshToken, new Date(Date.now() + this.refreshTokenTtlMs));
  }

  clearAuthCookies(response: Response): void {
    response.clearCookie(this.accessTokenCookieName);
    response.clearCookie(this.refreshTokenCookieName);
  }

  async authenticateRequest(request: Request, response: Response): Promise<SessionUser | null> {
    const cookies = this.parseCookies(request);
    const accessToken = cookies[this.accessTokenCookieName];
    const refreshToken = cookies[this.refreshTokenCookieName];

    if (accessToken) {
      const accessPayload = this.verifyToken(accessToken, "access");
      if (accessPayload) {
        const user = await this.usersService.findByGoogleId(accessPayload.sub);
        if (user) {
          return this.toSessionUser(user);
        }
      }
    }

    if (!refreshToken) {
      return null;
    }

    const refreshPayload = this.verifyToken(refreshToken, "refresh");
    if (!refreshPayload) {
      this.clearAuthCookies(response);
      return null;
    }

    const user = await this.usersService.findByGoogleId(refreshPayload.sub);
    if (!user?.localAuth?.refreshTokenHash || !user.localAuth.refreshTokenExpiresAt) {
      this.clearAuthCookies(response);
      return null;
    }

    if (user.localAuth.refreshTokenExpiresAt.getTime() < Date.now()) {
      await this.clearRefreshToken(user.googleId);
      this.clearAuthCookies(response);
      return null;
    }

    const expectedHash = user.localAuth.refreshTokenHash;
    const actualHash = this.hashRefreshToken(refreshToken);
    if (!this.safeEqual(expectedHash, actualHash)) {
      this.clearAuthCookies(response);
      return null;
    }

    const sessionUser = this.toSessionUser(user);
    await this.issueAuthCookies(response, sessionUser);
    return sessionUser;
  }

  private toSessionUser(user: {
    googleId: string;
    email: string;
    name: string;
    givenName?: string;
    familyName?: string;
    picture?: string;
    rocketIntegration?: RocketIntegration | null;
  }): SessionUser {
    return {
      id: user.googleId,
      email: user.email,
      name: user.name,
      givenName: user.givenName,
      familyName: user.familyName,
      picture: user.picture,
      hasRocketIntegration: this.usersService.hasRocketIntegration(user),
    };
  }

  private parseCookies(request: Request): Record<string, string> {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return {};
    }

    return cookieHeader.split(";").reduce<Record<string, string>>((accumulator, part) => {
      const [key, ...valueParts] = part.trim().split("=");
      if (!key) {
        return accumulator;
      }

      accumulator[key] = decodeURIComponent(valueParts.join("="));
      return accumulator;
    }, {});
  }

  private signToken(payload: TokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.getSecret(payload.type))
      .update(encodedPayload)
      .digest("base64url");

    return `${encodedPayload}.${signature}`;
  }

  private verifyToken(token: string, expectedType: TokenPayload["type"]): TokenPayload | null {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = createHmac("sha256", this.getSecret(expectedType))
      .update(encodedPayload)
      .digest("base64url");

    if (!this.safeEqual(signature, expectedSignature)) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as TokenPayload;
      if (payload.type !== expectedType || payload.exp < Date.now()) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${derived}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const [salt, expected] = stored.split(":");
    if (!salt || !expected) {
      return false;
    }

    const actual = scryptSync(password, salt, 64).toString("hex");
    return this.safeEqual(expected, actual);
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHmac("sha256", this.refreshTokenHashSecret).update(refreshToken).digest("hex");
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private buildCookieOptions(maxAge: number) {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      maxAge,
      path: "/",
    };
  }

  private getSecret(type: TokenPayload["type"]): string {
    const envName = type === "access" ? "ACCESS_TOKEN_SECRET" : "REFRESH_TOKEN_SECRET";
    const value = process.env[envName];
    if (!value) {
      throw new Error(`Missing required env var: ${envName}`);
    }

    return value;
  }

  private get accessTokenTtlMs(): number {
    return Number.parseInt(process.env.ACCESS_TOKEN_TTL_MS ?? "900000", 10);
  }

  private get refreshTokenTtlMs(): number {
    return Number.parseInt(process.env.REFRESH_TOKEN_TTL_MS ?? "2592000000", 10);
  }

  private get accessTokenCookieName(): string {
    return process.env.ACCESS_TOKEN_COOKIE_NAME ?? "chat_assistant_access_token";
  }

  private get refreshTokenCookieName(): string {
    return process.env.REFRESH_TOKEN_COOKIE_NAME ?? "chat_assistant_refresh_token";
  }

  private get refreshTokenHashSecret(): string {
    const value = process.env.REFRESH_TOKEN_HASH_SECRET ?? process.env.REFRESH_TOKEN_SECRET;
    if (!value) {
      throw new Error("Missing required env var: REFRESH_TOKEN_HASH_SECRET or REFRESH_TOKEN_SECRET");
    }

    return value;
  }
}
