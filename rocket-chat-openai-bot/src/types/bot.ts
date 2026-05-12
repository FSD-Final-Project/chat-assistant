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

export interface BotActivationPreferences {
  timeEnabled: boolean;
  startTime: string;
  endTime: string;
  dateEnabled: boolean;
  startDate?: string;
  endDate?: string;
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
  suggestedReply?: string;
  context?: ContextEntry[];
}

export interface BotConfig {
  rcUrl: string;
  mainServerUrl: string;
  internalApiKey: string;
  openAiApiKey: string;
  openAiBaseUrl: string;
  summaryModel: string;
  embeddingModel: string;
  rcRequestIntervalMs: number;
  rcRetryBackoffMs: number;
  maxContextMessages: number;
}
