import OpenAI from "openai";

import type { BotConfig, SummaryContextItem } from "../types/bot.js";

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

function buildSummaryContextBlock(
  currentSummary: SummaryContextItem | null,
  relevantSummaries: SummaryContextItem[],
): string {
  const sections: string[] = [];

  if (currentSummary?.summary) {
    sections.push(`Current conversation summary:\n${currentSummary.summary}`);
  }

  if (relevantSummaries.length > 0) {
    sections.push(
      [
        "Related conversation summaries:",
        ...relevantSummaries.map((summary, index) =>
          `${index + 1}. [room ${summary.roomId}] ${summary.summary}`,
        ),
      ].join("\n"),
    );
  }

  return sections.join("\n\n").trim();
}

function cleanSummaryText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter(
      (line) =>
        !/^(the )?(rocket\.chat )?(conversation|chat) (shows|is about|focuses on)\b/i.test(line) &&
        !/^the user (discusses|talks about|mentions)\b/i.test(line)
    )
    .join("\n")
    .trim();
}

export class ReplyService {
  private readonly openai: OpenAI;

  constructor(private readonly config: BotConfig) {
    this.openai = new OpenAI({ apiKey: config.openAiApiKey });
  }

  async generateReply(
    incomingText: string,
    currentSummary: SummaryContextItem | null,
    relevantSummaries: SummaryContextItem[],
  ): Promise<string> {
    const userText = this.config.botTriggerPrefix
      ? incomingText.trim().slice(this.config.botTriggerPrefix.length).trim()
      : incomingText.trim();

    if (isTodoListMessage(userText)) {
      return "noted";
    }

    const summaryContext = buildSummaryContextBlock(currentSummary, relevantSummaries);
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
      ...(summaryContext
        ? [
            {
              role: "system" as const,
              content: `Use these stored conversation summaries as context.\n\n${summaryContext}`,
            },
          ]
        : []),
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

    return output;
  }

  async reviseSummary(input: {
    currentSummary?: string | null;
    incomingText: string;
    assistantReply?: string;
  }): Promise<string> {
    const prompt = [
      "You maintain a concise running summary for retrieval use.",
      "Update the summary using only factual details from the conversation.",
      "Preserve stable preferences, commitments, open tasks, ongoing topics, tone cues, and important context.",
      "Do not write meta narration such as 'the conversation shows', 'the user discusses', or mention Rocket.Chat unless it is directly relevant.",
      "Do not include anything speculative.",
      "Keep the summary under 220 words.",
      "",
      `Current summary:\n${input.currentSummary?.trim() || "(none)"}`,
      "",
      `New user message:\n${input.incomingText.trim()}`,
      "",
      `Assistant reply actually sent:\n${input.assistantReply?.trim() || "(none sent)"}`,
    ].join("\n");

    const response = await this.openai.responses.create({
      model: this.config.summaryModel,
      input: [
        {
          role: "system",
          content:
            "Return only the updated conversation summary text with no headings or markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const output = response.output_text?.trim();
    if (!output) {
      throw new Error("OpenAI summary response did not contain text output");
    }

    return cleanSummaryText(output);
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.config.embeddingModel,
      input: text,
    });

    return response.data[0]?.embedding ?? [];
  }
}
