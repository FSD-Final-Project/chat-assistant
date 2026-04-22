import { loadConfig } from "./config/env.js";
import { RocketChatClient } from "./clients/rocketChatClient.js";
import { BotRunner } from "./services/botRunner.js";
import { ContextStore } from "./services/contextStore.js";
import { ReplyService } from "./services/replyService.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();

  const rocketChatClient = new RocketChatClient(config);
  const contextStore = new ContextStore(config.maxContextMessages);
  const replyService = new ReplyService(config, contextStore);
  const botRunner = new BotRunner(config, rocketChatClient, replyService);

  await botRunner.start();
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal startup error: ${message}`);
  process.exit(1);
});

