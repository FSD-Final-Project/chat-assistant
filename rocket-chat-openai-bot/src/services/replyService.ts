import OpenAI from "openai";

import type { BotConfig, SummaryContextItem } from "../types/bot.js";


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
  constructor(
    private readonly config: BotConfig
  ) {
    this.openai = new OpenAI({
      apiKey: config.openAiApiKey || "missing-openai-key",
      baseURL: config.openAiBaseUrl,
    });
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
