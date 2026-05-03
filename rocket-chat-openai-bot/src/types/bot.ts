export type ChatRole = "user" | "assistant";

export interface ContextEntry {
  role: ChatRole;
  text: string;
}

export interface RocketChatAuth {
  email?: string;
  userToken: string;
  userId: string;
}

export interface BotConfig {
  rcUrl: string;
  mainServerUrl: string;
  internalApiKey: string;
  openAiApiKey: string;
  openAiBaseUrl: string;
  openAiModel: string;
  ollamaApiKey: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  llmFallbackToOllama: boolean;
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
