# Chat Assistant

Chat Assistant is a full-stack workspace with:

- a Vite + React dashboard client
- a NestJS + Express authentication server for Google SSO
- a Rocket.Chat OpenAI bot that replies in direct messages

## Projects

- `client/`: frontend client
- `server/`: NestJS backend for Google OAuth and session auth
- `rocket-chat-openai-bot/`: Rocket.Chat bot service
- `rocketchat-compose/`: local Rocket.Chat docker setup

## Prerequisites

- Node.js 18+
- npm
- A Google OAuth client
- An OpenAI API key
- A Rocket.Chat server and bot user token

## Root Scripts

From the repo root:

```sh
npm install
```

Available scripts:

- `npm run dev` - run the Vite client
- `npm run dev:client` - run the Vite client
- `npm run dev:server` - run the Nest auth server
- `npm run dev:bot` - run the Rocket.Chat bot
- `npm run dev:all` - run client, server, and bot together
- `npm run build` - build the Vite client
- `npm run build:server` - build the Nest server
- `npm run rocket` - start the local Rocket.Chat stack from `rocketchat-compose`

`npm run dev:all` uses `concurrently`, so make sure root dependencies are installed first.

## Frontend

The client runs on `http://localhost:8080`.

Frontend env is optional in local development because Vite proxies `/auth` to the Nest server.
See [.env.example](/c:/Users/guyya/OneDrive/Documents/fsd/chat-assistant/.env.example:1).

Run only the client:

```sh
npm run dev:client
```

## Auth Server

The backend is a NestJS app using Express sessions and Google OAuth.
It runs on `http://localhost:3001` by default and exposes:

- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/session`
- `POST /auth/logout`

Setup:

```sh
cd server
npm install
cp .env.example .env
```

Required values in `server/.env`:

```sh
PORT=3001
CLIENT_URL=http://localhost:8080
SESSION_SECRET=replace-this-session-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
SESSION_COOKIE_NAME=chat_assistant_session
SESSION_COOKIE_SECURE=false
```

Google OAuth configuration:

- Authorized JavaScript origin: `http://localhost:3001`
- Authorized redirect URI: `http://localhost:3001/auth/google/callback`

Run only the server:

```sh
npm run dev:server
```

## Rocket.Chat Bot

The bot lives in `rocket-chat-openai-bot/` and uses token-based Rocket.Chat auth with `X-Auth-Token` and `X-User-Id`.
It ignores existing messages when it first syncs a room, so it only replies to new ones after startup.

Setup:

```sh
cd rocket-chat-openai-bot
npm install
cp .env.example .env
```

Key bot env values:

- `RC_URL`
- `ROCKET_USER_TOKEN`
- `ROCKET_USER_ID`
- `OPENAI_API_KEY`

Run only the bot:

```sh
npm run dev:bot
```

For full bot configuration, see [rocket-chat-openai-bot/README.md](/c:/Users/guyya/OneDrive/Documents/fsd/chat-assistant/rocket-chat-openai-bot/README.md:1).

## Full Local Run

Start everything together from the repo root:

```sh
npm run dev:all
```

Or run services separately:

```sh
npm run dev:server
npm run dev:client
npm run dev:bot
```

## Tech Stack

- Vite
- React
- TypeScript
- NestJS
- Express
- Google OAuth
- Rocket.Chat
- OpenAI API
- Tailwind CSS
- Radix UI
