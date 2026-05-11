import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { User, type UserDocument } from "./schemas/user.schema";

interface GoogleProfileUserInput {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

interface LocalUserInput {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

type RocketSyncStatus = "pending" | "syncing" | "completed" | "failed";

export interface BotActivationPreferencesInput {
  timeEnabled: boolean;
  startTime: string;
  endTime: string;
  dateEnabled: boolean;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async upsertGoogleUser(input: GoogleProfileUserInput): Promise<UserDocument> {
    const existingUser = await this.userModel.findOne({
      $or: [{ googleId: input.id }, { email: input.email }],
    });

    const user = await this.userModel.findOneAndUpdate(
      existingUser
        ? { _id: existingUser._id }
        : { googleId: input.id },
      {
        $set: {
          email: input.email,
          name: input.name,
          givenName: input.givenName,
          familyName: input.familyName,
          picture: input.picture,
          authProvider: "google",
          googleId: input.id,
        },
      },
      { new: true, upsert: true },
    );

    if (!user) {
      throw new Error("Failed to upsert user");
    }

    return user;
  }

  async createLocalUser(input: LocalUserInput): Promise<UserDocument> {
    const user = await this.userModel.create({
      googleId: input.id,
      email: input.email,
      name: input.name,
      authProvider: "local",
      localAuth: {
        passwordHash: input.passwordHash,
      },
    });

    return user;
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId });
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email });
  }

  async findAllWithRocketIntegration(): Promise<UserDocument[]> {
    return this.userModel.find({
      "rocketIntegration.encryptedUserToken": { $exists: true, $ne: null },
      "rocketIntegration.encryptedUserId": { $exists: true, $ne: null },
    });
  }

  async saveRocketIntegration(googleId: string, rocketUserToken: string, rocketUserId: string): Promise<UserDocument | null> {
    return this.userModel.findOneAndUpdate(
      { googleId },
      {
        $set: {
          rocketIntegration: {
            encryptedUserToken: this.encrypt(rocketUserToken),
            encryptedUserId: this.encrypt(rocketUserId),
            syncStatus: "pending",
            syncStartedAt: undefined,
            syncCompletedAt: undefined,
            syncError: undefined,
            updatedAt: new Date(),
          },
        },
      },
      { new: true },
    );
  }

  async updateRocketSyncStatus(
    googleId: string,
    status: RocketSyncStatus,
    error?: string,
  ): Promise<UserDocument | null> {
    const now = new Date();
    return this.userModel.findOneAndUpdate(
      { googleId },
      {
        $set: {
          "rocketIntegration.syncStatus": status,
          "rocketIntegration.updatedAt": now,
          ...(status === "syncing" ? { "rocketIntegration.syncStartedAt": now } : {}),
          ...(status === "completed" ? { "rocketIntegration.syncCompletedAt": now } : {}),
          ...(status === "failed" && error ? { "rocketIntegration.syncError": error } : {}),
        },
        ...(status === "syncing" || status === "completed"
          ? { $unset: { "rocketIntegration.syncError": "" } }
          : {}),
      },
      { new: true },
    );
  }

  async saveRefreshToken(googleId: string, refreshTokenHash: string, refreshTokenExpiresAt: Date): Promise<void> {
    // Use an aggregation pipeline update to safely merge fields even if localAuth is null
    await this.userModel.updateOne(
      { googleId },
      [
        {
          $set: {
            localAuth: {
              $mergeObjects: [
                { $ifNull: ["$localAuth", {}] },
                {
                  refreshTokenHash: refreshTokenHash,
                  refreshTokenExpiresAt: refreshTokenExpiresAt,
                },
              ],
            },
          },
        },
      ],
    );
  }

  async clearRefreshToken(googleId: string): Promise<void> {
    await this.userModel.updateOne(
      { googleId },
      {
        $unset: {
          "localAuth.refreshTokenHash": "",
          "localAuth.refreshTokenExpiresAt": "",
        },
      },
    );
  }

  async clearRocketIntegration(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOneAndUpdate(
      { googleId },
      {
        $unset: {
          "rocketIntegration.encryptedUserToken": "",
          "rocketIntegration.encryptedUserId": "",
        },
        $set: {
          "rocketIntegration.updatedAt": new Date(),
        },
      },
      { new: true },
    );
  }

  getBotActivationPreferences(
    user: Pick<User, "botActivationPreferences"> | null | undefined,
  ): BotActivationPreferencesInput {
    const preferences = user?.botActivationPreferences;
    return {
      timeEnabled: preferences?.timeEnabled ?? false,
      startTime: preferences?.startTime ?? "15:00",
      endTime: preferences?.endTime ?? "20:30",
      dateEnabled: preferences?.dateEnabled ?? false,
      startDate: preferences?.startDate,
      endDate: preferences?.endDate,
    };
  }

  async saveBotActivationPreferences(
    googleId: string,
    preferences: BotActivationPreferencesInput,
  ): Promise<UserDocument | null> {
    return this.userModel.findOneAndUpdate(
      { googleId },
      {
        $set: {
          botActivationPreferences: preferences,
        },
      },
      { new: true },
    );
  }

  hasRocketIntegration(user: Pick<User, "rocketIntegration"> | null | undefined): boolean {
    return Boolean(
      user?.rocketIntegration?.encryptedUserToken &&
        user?.rocketIntegration?.encryptedUserId,
    );
  }

  getDecryptedRocketIntegration(user: Pick<User, "rocketIntegration"> | null | undefined) {
    const encryptedUserToken = user?.rocketIntegration?.encryptedUserToken;
    const encryptedUserId = user?.rocketIntegration?.encryptedUserId;

    if (!encryptedUserToken || !encryptedUserId) {
      return null;
    }

    return {
      userToken: this.decrypt(encryptedUserToken),
      userId: this.decrypt(encryptedUserId),
    };
  }

  private encrypt(value: string): string {
    const secret = process.env.ROCKET_CREDENTIALS_ENCRYPTION_KEY;
    if (!secret) {
      throw new Error("Missing required env var: ROCKET_CREDENTIALS_ENCRYPTION_KEY");
    }

    const key = createHash("sha256").update(secret).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
  }

  private decrypt(value: string): string {
    const secret = process.env.ROCKET_CREDENTIALS_ENCRYPTION_KEY;
    if (!secret) {
      throw new Error("Missing required env var: ROCKET_CREDENTIALS_ENCRYPTION_KEY");
    }

    const [ivBase64, authTagBase64, encryptedBase64] = value.split(":");
    if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
      throw new Error("Invalid encrypted Rocket.Chat credential format");
    }

    const key = createHash("sha256").update(secret).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, "base64")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }
}
