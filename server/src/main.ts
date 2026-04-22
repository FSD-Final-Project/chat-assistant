import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import session from "express-session";
import passport from "passport";
import { AppModule } from "./app.module";

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

  app.use(
    session({
      name: process.env.SESSION_COOKIE_NAME ?? "chat_assistant_session",
      secret: getRequiredEnv("SESSION_SECRET"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.SESSION_COOKIE_SECURE === "true",
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  const port = Number.parseInt(process.env.PORT ?? "3001", 10);
  await app.listen(port);
}

void bootstrap();
