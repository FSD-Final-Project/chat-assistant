import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import OpenAI from "openai";
import { isRealMessage } from "../../../common/message-utils";
import {
  MessageChunkRecord,
  MessageChunkDocument,
} from "./schemas/message-chunk.schema";
import {
  RocketMessageRecord,
  RocketMessageDocument,
} from "./schemas/rocket-message.schema";
import {
  MessageSuggestionRecord,
  MessageSuggestionDocument,
} from "./schemas/message-suggestion.schema";

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(MessageChunkRecord.name)
    private readonly chunkModel: Model<MessageChunkDocument>,
    @InjectModel(RocketMessageRecord.name)
    private readonly messageModel: Model<RocketMessageDocument>,
    @InjectModel(MessageSuggestionRecord.name)
    private readonly suggestionModel: Model<MessageSuggestionDocument>,
  ) {
    this.openai = new OpenAI({
      apiKey: this.openaiApiKey,
    });
  }

  private get openaiApiKey(): string {
    const value = this.configService.get<string>("OPENAI_API_KEY");
    if (!value) {
      throw new Error("Missing OPENAI_API_KEY in configuration");
    }
    return value;
  }

  private get openaiModel(): string {
    const value = this.configService.get<string>("OPENAI_MODEL");
    if (!value) {
      throw new Error("Missing OPENAI_MODEL in configuration");
    }
    return value;
  }

  private get embeddingModel(): string {
    const value = this.configService.get<string>("EMBEDDING_MODEL");
    if (!value) {
      throw new Error("Missing EMBEDDING_MODEL in configuration");
    }
    return value;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: "float",
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Failed to generate embedding: ${error}`);
      throw error;
    }
  }

  /**
   * Performs vector search on message chunks
   */
  async vectorSearch(
    appUserGoogleId: string,
    queryVector: number[],
    limit: number = 5,
  ): Promise<MessageChunkDocument[]> {
    try {
      return await this.chunkModel.aggregate([
        {
          $vectorSearch: {
            index: "vector_index", // This must match the index name in Atlas
            path: "embedding",
            queryVector: queryVector,
            numCandidates: 100,
            limit: limit,
            filter: {
              appUserGoogleId: appUserGoogleId,
            },
          },
        },
      ]);
    } catch (error: any) {
      this.logger.warn(`Vector search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Helper to format a chunk's messages into a single string for embedding
   */
  formatChunkForEmbedding(messages: any[]): string {
    return messages
      .map((m) => `${m.user}: ${m.text}`)
      .join("\n");
  }

  /**
   * Logic to process messages and group them into chunks
   */
  async chunkMessages(): Promise<void> {
    const unchunkedMessages = await this.messageModel
      .find({ isChunked: false })
      .sort({ "payload.ts": 1 })
      .limit(500);

    if (unchunkedMessages.length === 0) {
      this.logger.debug("No unchunked messages found.");
      return;
    }

    this.logger.log(`Processing ${unchunkedMessages.length} unchunked messages`);

    for (const message of unchunkedMessages) {
      const payload = message.payload as any;
      const tmid = payload.tmid;
      const roomId = message.roomId;
      // Filter system and empty messages using shared logic
      if (!isRealMessage(payload)) {
        this.logger.debug(`Skipping non-real message ${message._id} (type: ${payload.t ?? 'none'})`);
        message.isChunked = true;
        await message.save();
        continue;
      }

      const timestamp = new Date(payload.ts?.$date ?? payload.ts);
      const text = (payload.msg ?? "").trim();
      const user = payload.u?.username ?? "unknown";

      if (isNaN(timestamp.getTime())) {
        this.logger.warn(`Skipping message ${message._id} due to invalid timestamp`);
        message.isChunked = true;
        await message.save();
        continue;
      }

      if (tmid) {
        // Threaded logic: Group by thread ID
        await this.appendToThreadChunk(
          message.appUserGoogleId,
          roomId,
          tmid,
          { text, user, timestamp },
        );
      } else {
        // Unthreaded logic: Group by time gap
        await this.appendToTimeGapChunk(
          message.appUserGoogleId,
          roomId,
          { text, user, timestamp },
        );
      }

      // Mark as chunked
      message.isChunked = true;
      await message.save();
    }
  }

  private async appendToThreadChunk(
    appUserGoogleId: string,
    roomId: string,
    tmid: string,
    message: { text: string; user: string; timestamp: Date },
  ): Promise<void> {
    let chunk = await this.chunkModel.findOne({
      appUserGoogleId,
      roomId,
      tmid,
      isClosed: false,
    });

    if (!chunk) {
      this.logger.debug(`Creating new thread chunk for roomId: ${roomId}, tmid: ${tmid}`);
      chunk = new this.chunkModel({
        appUserGoogleId,
        roomId,
        tmid,
        messages: [message],
        startTime: message.timestamp,
        endTime: message.timestamp,
        isClosed: false,
      });
    } else {
      this.logger.debug(`Appending to existing thread chunk for roomId: ${roomId}, tmid: ${tmid}`);
      chunk.messages.push(message);
      chunk.endTime = message.timestamp;
    }

    await chunk.save();
  }

  private async appendToTimeGapChunk(
    appUserGoogleId: string,
    roomId: string,
    message: { text: string; user: string; timestamp: Date },
  ): Promise<void> {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    // Find the latest open chunk for this room that doesn't have a tmid
    let chunk = await this.chunkModel
      .findOne({
        appUserGoogleId,
        roomId,
        tmid: { $exists: false },
        isClosed: false,
      })
      .sort({ endTime: -1 });

    if (chunk) {
      const timeDiff = message.timestamp.getTime() - chunk.endTime.getTime();
      if (timeDiff > FIVE_MINUTES_MS) {
        // Gap too large, close this chunk and create a new one
        this.logger.debug(`Closing time gap chunk for roomId: ${roomId} due to time gap (${timeDiff}ms)`);
        chunk.isClosed = true;
        await chunk.save();
        chunk = null;
      }
    }

    if (!chunk) {
      this.logger.debug(`Creating new time gap chunk for roomId: ${roomId}`);
      chunk = new this.chunkModel({
        appUserGoogleId,
        roomId,
        messages: [message],
        startTime: message.timestamp,
        endTime: message.timestamp,
        isClosed: false,
      });
    } else {
      this.logger.debug(`Appending to existing time gap chunk for roomId: ${roomId}`);
      chunk.messages.push(message);
      chunk.endTime = message.timestamp;
    }

    await chunk.save();
  }

  /**
   * Closes chunks that haven't been updated for 5 minutes
   */
  async closeColdChunks(): Promise<void> {
    const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);

    const result = await this.chunkModel.updateMany(
      {
        isClosed: false,
        endTime: { $lt: FIVE_MINUTES_AGO },
      },
      {
        $set: { isClosed: true },
      },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(`Closed ${result.modifiedCount} cold chunks`);
    }
  }

  /**
   * Generates embeddings for closed chunks that don't have one
   */
  async processPendingEmbeddings(): Promise<void> {
    const pendingChunks = await this.chunkModel
      .find({
        isClosed: true,
        embedding: { $exists: false },
      })
      .limit(10);

    if (pendingChunks.length > 0) {
      this.logger.log(`Found ${pendingChunks.length} chunks pending embedding generation`);
    }

    for (const chunk of pendingChunks) {
      const text = this.formatChunkForEmbedding(chunk.messages);
      if (!text.trim()) {
        // Skip empty chunks
        chunk.embedding = [];
        await chunk.save();
        continue;
      }

      try {
        const embedding = await this.generateEmbedding(text);
        chunk.embedding = embedding;
        await chunk.save();
        this.logger.log(`Generated embedding for chunk ${chunk._id}`);
      } catch (error) {
        this.logger.error(`Failed to process embedding for chunk ${chunk._id}: ${error}`);
      }
    }
  }

  /**
   * Generates an auto-reply suggestion using hybrid retrieval or provided context
   */
  async getAutoReplySuggestion(
    appUserGoogleId: string,
    roomId: string,
    messageText: string,
    context?: {
      currentSummary?: string | null;
      relevantSummaries?: Array<{ roomId: string; summary: string }>;
    },
  ): Promise<string> {
    let contextText = "";

    if (context) {
      const sections: string[] = [];
      if (context.currentSummary) {
        sections.push(`Current conversation summary:\n${context.currentSummary}`);
      }
      if (context.relevantSummaries && context.relevantSummaries.length > 0) {
        sections.push(
          [
            "Related conversation summaries:",
            ...context.relevantSummaries.map((s, i) => `${i + 1}. [room ${s.roomId}] ${s.summary}`),
          ].join("\n"),
        );
      }
      contextText = sections.join("\n\n").trim();
    } else {
      // Fallback to legacy retrieval if no context provided
      const queryVector = await this.generateEmbedding(messageText);
      const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
      let vectorResults: any[] = [];
      try {
        vectorResults = await this.chunkModel.aggregate([
          {
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryVector,
              numCandidates: 100,
              limit: 5,
              filter: { appUserGoogleId },
            },
          },
        ]);
      } catch (error: any) {
        this.logger.warn(`Vector search failed: ${error.message}`);
      }

      const recentResults = await this.chunkModel.find({
        appUserGoogleId,
        roomId,
        startTime: { $gte: last5Minutes },
      });

      contextText = [...vectorResults, ...recentResults]
        .map((chunk) => this.formatChunkForEmbedding(chunk.messages))
        .join("\n---\n");
    }

    const systemPrompt = [
      "You are a helpful Rocket.Chat assistant helping a user reply to messages.",
      "Reply as the account owner in first-person voice. Do not present yourself as a bot or AI.",
      "Use the following context from previous conversations to suggest a natural, helpful reply.",
      "",
      "Context:",
      contextText || "(no context available)",
    ].join("\n");

    const completion = await this.openai.chat.completions.create({
      model: this.openaiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Suggest a reply for this message: "${messageText}"` },
      ],
    });

    return completion.choices[0].message.content ?? "Sorry, I couldn't generate a suggestion.";
  }

  async findCachedSuggestion(appUserGoogleId: string, messageId: string): Promise<string | null> {
    const record = await this.suggestionModel.findOne({ appUserGoogleId, messageId });
    return record?.suggestion ?? null;
  }

  async saveSuggestion(
    appUserGoogleId: string,
    roomId: string,
    messageId: string,
    suggestion: string,
  ): Promise<void> {
    await this.suggestionModel.findOneAndUpdate(
      { appUserGoogleId, messageId },
      { $set: { appUserGoogleId, roomId, messageId, suggestion } },
      { upsert: true, new: true },
    );
  }
}
