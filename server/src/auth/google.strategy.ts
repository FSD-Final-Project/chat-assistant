import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";
import type { SessionUser } from "./session-user";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    super({
      clientID: getRequiredEnv("GOOGLE_CLIENT_ID"),
      clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
      callbackURL: getRequiredEnv("GOOGLE_CALLBACK_URL"),
      scope: ["email", "profile"],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      name?: { givenName?: string; familyName?: string };
      displayName?: string;
      emails?: Array<{ value: string }>;
      photos?: Array<{ value: string }>;
    },
    done: VerifyCallback,
  ) {
    void accessToken;
    void refreshToken;

    const user: SessionUser = {
      id: profile.id,
      email: profile.emails?.[0]?.value ?? "",
      name: profile.displayName ?? "Google User",
      givenName: profile.name?.givenName,
      familyName: profile.name?.familyName,
      picture: profile.photos?.[0]?.value,
    };

    done(null, user);
  }
}
