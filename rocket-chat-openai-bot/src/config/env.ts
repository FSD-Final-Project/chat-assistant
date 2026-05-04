import "dotenv/config";

import type { BotConfig } from "../types/bot.js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getNumberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Env var ${name} must be a positive integer`);
  }

  return parsed;
}

function getBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }

  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  throw new Error(`Env var ${name} must be a boolean (true/false)`);
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function loadConfig(): BotConfig {
  return {
    rcUrl: normalizeBaseUrl(getRequiredEnv("RC_URL")),
    mainServerUrl: normalizeBaseUrl(getRequiredEnv("MAIN_SERVER_URL")),
    internalApiKey: getRequiredEnv("INTERNAL_API_KEY"),
    openAiApiKey: getRequiredEnv("OPENAI_API_KEY"),
    openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    summaryModel: process.env.SUMMARY_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    systemPrompt: process.env.SYSTEM_PROMPT ?? "You are a helpful Rocket.Chat assistant.",
    rcRequestIntervalMs: getNumberEnv("RC_REQUEST_INTERVAL_MS", 400),
    rcRetryBackoffMs: getNumberEnv("RC_RETRY_BACKOFF_MS", 5000),
    maxContextMessages: getNumberEnv("MAX_CONTEXT_MESSAGES", 12),
    botTriggerPrefix: process.env.BOT_TRIGGER_PREFIX ?? "",
    mirrorUserStyle: getBooleanEnv("MIRROR_USER_STYLE", true),
    mirrorStyleSampleSize: getNumberEnv("MIRROR_STYLE_SAMPLE_SIZE", 6),
    speakAsUser: getBooleanEnv("SPEAK_AS_USER", true),
  };
}
