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

      // 1. Group new messages into chunks
      await this.embeddingService.chunkMessages();

      // 2. Close chunks that have "cooled down"
      await this.embeddingService.closeColdChunks();

      // 3. Generate embeddings for closed chunks
      await this.embeddingService.processPendingEmbeddings();

      this.logger.debug("Chunk processing tick completed.");
    } catch (error) {
      this.logger.error(`Error in chunk processor tick: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
