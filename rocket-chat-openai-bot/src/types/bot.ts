export type ChatRole = "user" | "assistant";

export interface ContextEntry {
  role: ChatRole;
  text: string;
}

export interface RocketChatAuth {
  googleId?: string;
  email?: string;
  userToken: string;
  userId: string;
}

export interface BotConfig {
  rcUrl: string;
  mainServerUrl: string;
  internalApiKey: string;
  openAiApiKey: string;
  openAiModel: string;
  systemPrompt: string;
  pollIntervalMs: number;
  rcRequestIntervalMs: number;
  rcRetryBackoffMs: number;
  maxContextMessages: number;
  botTriggerPrefix: string;
  mirrorUserStyle: boolean;
  mirrorStyleSampleSize: number;
  speakAsUser: boolean;
}
