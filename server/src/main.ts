import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import passport from "passport";
import { AppModule } from "./app.module";
import { AuthService } from "./auth/auth.service";
import { createAuthMiddleware } from "./auth/auth.middleware";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const clientUrl = getRequiredEnv("CLIENT_URL");

  app.enableCors({
    origin: clientUrl,
    credentials: true,
  });

  app.use(passport.initialize());
  app.use(createAuthMiddleware(app.get(AuthService)));

  const port = Number.parseInt(process.env.PORT ?? "3001", 10);
  await app.listen(port);
}

void bootstrap();
// Triggering restart to pick up new routes and .env changes
