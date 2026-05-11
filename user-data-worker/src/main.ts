import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { UserDataWorkerService } from "./user-data-worker.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number.parseInt(process.env.PORT ?? "3002", 10);
  await app.listen(port);

  const worker = app.get(UserDataWorkerService);
  void worker.start();
}

void bootstrap();
