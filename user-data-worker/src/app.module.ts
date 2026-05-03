import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { resolve } from "node:path";
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
  providers: [UserDataWorkerService],
})
export class AppModule {}
