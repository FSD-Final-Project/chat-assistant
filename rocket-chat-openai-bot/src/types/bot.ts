export type ChatRole = "user" | "assistant";

export interface ContextEntry {
  role: ChatRole;
  text: string;
}

export interface BotConfig {
  rcUrl: string;
  rcUser: string;
  rcPassword: string;
  openAiApiKey: string;
  openAiModel: string;
  systemPrompt: string;
  pollIntervalMs: number;
  maxContextMessages: number;
  botTriggerPrefix: string;
  mirrorUserStyle: boolean;
  mirrorStyleSampleSize: number;
  speakAsUser: boolean;
}
