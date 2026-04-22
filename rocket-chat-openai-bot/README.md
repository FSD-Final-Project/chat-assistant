# Rocket.Chat OpenAI DM Bot

This project runs a bot user for Rocket.Chat.
When someone sends a DM to the bot user, it replies using an OpenAI model and keeps short per-room context.

## 1. Prerequisites

- Rocket.Chat running (for this repo you can use `rocketchat-compose`)
- A Rocket.Chat bot user (example: `bot`)
- OpenAI API key
- Node.js 18+

## 2. Configure

```bash
cd rocket-chat-openai-bot
cp .env.example .env
```

Set values in `.env`:

- `RC_URL`: Rocket.Chat URL (example: `http://localhost:3000`)
- `ROCKET_USER_TOKEN`: Rocket.Chat personal access token or auth token for the bot user
- `ROCKET_USER_ID`: Rocket.Chat user id for that same bot user
- `OPENAI_API_KEY`: your OpenAI key
- `OPENAI_MODEL`: model name (default: `gpt-4.1-mini`)
- `SYSTEM_PROMPT`: assistant behavior
- `POLL_INTERVAL_MS`: polling interval
- `MAX_CONTEXT_MESSAGES`: number of recent turns to keep per DM room
- `BOT_TRIGGER_PREFIX`: optional trigger prefix (empty means reply to every DM)
- `MIRROR_USER_STYLE`: if `true`, bot tries to match your writing style
- `MIRROR_STYLE_SAMPLE_SIZE`: how many recent user messages are used for style matching
- `SPEAK_AS_USER`: if `true`, replies in your voice and avoids bot/AI wording

## 3. Run

Development (TypeScript watch mode):

```bash
npm install
npm run dev
```

Production:

```bash
npm run build
npm start
```

## 4. Test in Rocket.Chat

1. Log into Rocket.Chat as a regular user.
2. Open a direct message with the bot user.
3. Send a message.
4. The bot should answer in the same DM room.

## Notes

- This version uses token-based Rocket.Chat REST auth with `X-Auth-Token` and `X-User-Id`.
- This version uses REST polling (`im.list` + `im.messages`) for simplicity.
- It ignores bot's own messages to prevent reply loops.
- Context is kept in memory and resets when the process restarts.

## Project Structure

```text
src/
  clients/      # external API clients (Rocket.Chat)
  config/       # env loading and validation
  services/     # bot orchestration and OpenAI reply generation
  state/        # runtime bot state
  types/        # shared TypeScript types
  utils/        # small reusable helpers
  main.ts       # application entrypoint
```
