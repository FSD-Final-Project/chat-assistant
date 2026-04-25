import OpenAI from "openai";

import type { BotConfig } from "../types/bot.js";
import { ContextStore } from "./contextStore.js";

function isTodoListMessage(text: string): boolean {
  const normalized = text.toLowerCase();
  const hasTodoKeyword =
    normalized.includes("todo") || normalized.includes("to-do") || normalized.includes("task list");

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const listItemCount = lines.filter((line) =>
    /^(-|\*|\d+\.|\[\s?\])\s+/.test(line)
  ).length;

  return hasTodoKeyword || listItemCount >= 2;
}

function buildStyleMirrorInstruction(userSamples: string[]): string {
  if (userSamples.length === 0) {
    return "Match the user's writing style, but keep answers clear and concise.";
  }

  const examples = userSamples
    .map((sample, index) => `${index + 1}. ${sample}`)
    .join("\n");

  return [
    "Mirror the user's writing style based on these recent messages.",
    "Keep the same tone, level of formality, punctuation habit, and response length preference.",
    "Do not mention being an AI, assistant, or bot.",
    "Recent user examples:",
    examples,
  ].join("\n");
}

export class ReplyService {
  private readonly openai: OpenAI;

  constructor(
    private readonly config: BotConfig,
    private readonly contextStore: ContextStore
  ) {
    this.openai = new OpenAI({ apiKey: config.openAiApiKey });
  }

  async generateReply(
    roomId: string,
    incomingText: string,
    options: { commitToContext?: boolean } = {}
  ): Promise<string> {
    const { commitToContext = true } = options;
    const userText = this.config.botTriggerPrefix
      ? incomingText.trim().slice(this.config.botTriggerPrefix.length).trim()
      : incomingText.trim();

    if (isTodoListMessage(userText)) {
      if (commitToContext) {
        this.contextStore.push(roomId, "user", userText);
        this.contextStore.push(roomId, "assistant", "noted");
      }
      return "noted";
    }

    const context = this.contextStore.get(roomId);
    const styleMessages = this.config.mirrorUserStyle
      ? context
          .filter((entry) => entry.role === "user")
          .slice(-this.config.mirrorStyleSampleSize)
          .map((entry) => entry.text)
      : [];

    const input = [
      { role: "system" as const, content: this.config.systemPrompt },
      ...(this.config.speakAsUser
        ? [
            {
              role: "system" as const,
              content:
                "Reply as the account owner in first-person voice. Do not present yourself as a bot or AI.",
            },
          ]
        : []),
      ...(this.config.mirrorUserStyle
        ? [{ role: "system" as const, content: buildStyleMirrorInstruction(styleMessages) }]
        : []),
      ...context.map((entry) => ({ role: entry.role, content: entry.text })),
      { role: "user" as const, content: userText },
    ];

    const response = await this.openai.responses.create({
      model: this.config.openAiModel,
      input,
    });

    const output = response.output_text?.trim();
    if (!output) {
      throw new Error("OpenAI response did not contain text output");
    }

    if (commitToContext) {
      this.contextStore.push(roomId, "user", userText);
      this.contextStore.push(roomId, "assistant", output);
    }
    return output;
  }
}
