export type ChatRole = "user" | "assistant";

export interface ContextEntry {
  role: ChatRole;
  text: string;
}

export interface RocketChatAuth {
  googleId: string;
  email?: string;
  userToken: string;
  userId: string;
}

export type PreferenceColor = "red" | "yellow" | "green";

export interface ManagedSubscription {
  id: string;
  roomId: string;
  roomType?: string;
  preferenceColor: PreferenceColor;
}

export interface BotContextPayload {
  subscription: ManagedSubscription;
  context: ContextEntry[];
}

export interface BotConfig {
  rcUrl: string;
  mainServerUrl: string;
  internalApiKey: string;
  openAiApiKey: string;
  openAiModel: string;
  systemPrompt: string;
  rcRequestIntervalMs: number;
  rcRetryBackoffMs: number;
  maxContextMessages: number;
  botTriggerPrefix: string;
  mirrorUserStyle: boolean;
  mirrorStyleSampleSize: number;
  speakAsUser: boolean;
}
