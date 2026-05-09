import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EmbeddingService } from "./embedding.service";

@Injectable()
export class ChunkProcessorService {
  private readonly logger = new Logger(ChunkProcessorService.name);
  private isProcessing = false;

  constructor(private readonly embeddingService: EmbeddingService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    if (this.isProcessing) {
      this.logger.debug("Chunk processor is already running, skipping this tick.");
      return;
    }

    this.isProcessing = true;
    try {
      this.logger.debug("Starting chunk processing tick...");

      this.logger.debug("1. Grouping new messages into chunks...");
      await this.embeddingService.chunkMessages();
      this.logger.debug("1. Completed message chunking.");

      this.logger.debug("2. Closing cold chunks...");
      await this.embeddingService.closeColdChunks();
      this.logger.debug("2. Completed closing cold chunks.");

      this.logger.debug("3. Processing pending embeddings...");
      await this.embeddingService.processPendingEmbeddings();
      this.logger.debug("3. Completed processing pending embeddings.");

      this.logger.debug("Chunk processing tick completed.");
    } catch (error) {
      this.logger.error(`Error in chunk processor tick: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
