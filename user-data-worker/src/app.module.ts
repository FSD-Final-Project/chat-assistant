import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { resolve } from "node:path";
import { UserDataWorkerController } from "./user-data-worker.controller";
import { UserDataWorkerService } from "./user-data-worker.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "user-data-worker/.env"),
        resolve(process.cwd(), "../user-data-worker/.env"),
      ],
    }),
  ],
  controllers: [UserDataWorkerController],
  providers: [UserDataWorkerService],
})
export class AppModule {}
