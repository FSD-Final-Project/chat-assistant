import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { UserDataWorkerService } from "./user-data-worker.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [UserDataWorkerService],
})
export class AppModule {}
