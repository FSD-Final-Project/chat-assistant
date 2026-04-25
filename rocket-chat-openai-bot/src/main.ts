import { loadConfig } from "./config/env.js";
import { RocketChatClient } from "./clients/rocketChatClient.js";
import { BotRunner } from "./services/botRunner.js";
import { BotNotificationStore } from "./services/botNotificationStore.js";
import { ContextStore } from "./services/contextStore.js";
import { RocketCredentialsStore } from "./services/rocketCredentialsStore.js";
import { ReplyService } from "./services/replyService.js";
import { SubscriptionPreferenceStore } from "./services/subscriptionPreferenceStore.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const credentialsStore = new RocketCredentialsStore(config);
  const rocketChatAuthList = await credentialsStore.loadRocketChatAuth();
  const subscriptionPreferenceStore = new SubscriptionPreferenceStore(config);
  const botNotificationStore = new BotNotificationStore(config);

  const botRunners = rocketChatAuthList.map((rocketChatAuth) => {
    const rocketChatClient = new RocketChatClient(config, rocketChatAuth);
    const contextStore = new ContextStore(config.maxContextMessages);
    const replyService = new ReplyService(config, contextStore);
    return new BotRunner(
      config,
      rocketChatAuth,
      rocketChatClient,
      replyService,
      subscriptionPreferenceStore,
      botNotificationStore
    );
  });

  await Promise.all(botRunners.map((botRunner) => botRunner.start()));
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal startup error: ${message}`);
  process.exit(1);
});
