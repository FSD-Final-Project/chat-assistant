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

export type PreferenceColor = "red" | "yellow" | "green";

export interface ManagedSubscription {
  id: string;
  roomId: string;
  roomType?: string;
  preferenceColor: PreferenceColor;
}

export interface SummaryContextItem {
  subscriptionId: string;
  roomId: string;
  roomType?: string;
  summary: string;
  score?: number;
}

export interface BotContextPayload {
  subscription: ManagedSubscription;
  currentSummary: SummaryContextItem | null;
  relevantSummaries: SummaryContextItem[];
  context?: ContextEntry[];
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
  summaryModel: string;
  embeddingModel: string;
  systemPrompt: string;
  rcRequestIntervalMs: number;
  rcRetryBackoffMs: number;
  maxContextMessages: number;
  botTriggerPrefix: string;
  mirrorUserStyle: boolean;
  mirrorStyleSampleSize: number;
  speakAsUser: boolean;
}
