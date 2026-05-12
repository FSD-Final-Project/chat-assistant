import "dotenv/config";

import type { BotConfig } from "../types/bot.js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string, defaultValue = ""): string {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
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
    openAiApiKey: getOptionalEnv("OPENAI_API_KEY"),
    openAiBaseUrl: normalizeBaseUrl(getOptionalEnv("OPENAI_BASE_URL", "https://api.openai.com/v1")),
    summaryModel: process.env.SUMMARY_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
    rcRequestIntervalMs: getNumberEnv("RC_REQUEST_INTERVAL_MS", 400),
    rcRetryBackoffMs: getNumberEnv("RC_RETRY_BACKOFF_MS", 5000),
    maxContextMessages: getNumberEnv("MAX_CONTEXT_MESSAGES", 12),
    botTriggerPrefix: getOptionalEnv("BOT_TRIGGER_PREFIX"),
  };
}
