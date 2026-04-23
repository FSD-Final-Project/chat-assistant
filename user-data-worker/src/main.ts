import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { UserDataWorkerService } from "./user-data-worker.service";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const worker = app.get(UserDataWorkerService);
  await worker.start();
}

void bootstrap();
