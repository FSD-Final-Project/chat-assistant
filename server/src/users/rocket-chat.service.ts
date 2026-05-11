import { Injectable, Logger } from "@nestjs/common";
import { UsersService } from "./users.service";
import { RocketSyncService } from "./rocket-sync.service";

@Injectable()
export class RocketChatService {
  private readonly logger = new Logger(RocketChatService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly rocketSyncService: RocketSyncService,
  ) {}

  async postMessage(googleId: string, email: string, roomId: string, text: string): Promise<any> {
    const user = await this.usersService.findByGoogleId(googleId);
    const rocketAuth = this.usersService.getDecryptedRocketIntegration(user);

    if (!rocketAuth) {
      throw new Error("Rocket.Chat integration not configured for this user");
    }

    const rocketUrl = this.getRocketBaseUrl();
    const response = await fetch(`${rocketUrl}/api/v1/chat.postMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": rocketAuth.userToken,
        "X-User-Id": rocketAuth.userId,
      },
      body: JSON.stringify({ roomId, text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Rocket.Chat API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Immediately sync the sent message to our DB
    if (data.message) {
      await this.rocketSyncService.upsertMessages(
        googleId,
        email,
        roomId,
        undefined,
        [data.message],
      );
    }

    return data.message;
  }

  private getRocketBaseUrl(): string {
    const rocketUrl = process.env.RC_URL?.trim();
    if (!rocketUrl) {
      throw new Error("Missing RC_URL on server");
    }
    return rocketUrl.replace(/\/+$/, "");
  }
}
