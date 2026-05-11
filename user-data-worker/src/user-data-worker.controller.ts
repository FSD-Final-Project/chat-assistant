import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import { UserDataWorkerService } from "./user-data-worker.service";

interface TriggerUserSyncBody {
  googleId?: string;
}

@Controller("internal")
export class UserDataWorkerController {
  constructor(private readonly userDataWorkerService: UserDataWorkerService) {}

  @Post("sync-user")
  async triggerSyncForUser(
    @Req() request: { header(name: string): string | undefined },
    @Res() response: {
      status(code: number): {
        json(body: Record<string, unknown>): void;
      };
    },
    @Body() body: TriggerUserSyncBody,
  ) {
    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      response.status(500).json({ message: "Missing INTERNAL_API_KEY on worker" });
      return;
    }

    if (request.header("x-internal-api-key") !== internalApiKey) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const googleId = body.googleId?.trim();
    if (!googleId) {
      response.status(400).json({ message: "googleId is required" });
      return;
    }

    await this.userDataWorkerService.triggerSyncForUser(googleId);
    response.status(202).json({ success: true });
  }
}
