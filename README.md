# Chat Assistant

Chat Assistant is a full-stack workspace with:

- a Vite + React dashboard client
- a NestJS + Express authentication server for Google SSO
- a NestJS worker that syncs Rocket.Chat subscriptions and messages through the main server
- a Rocket.Chat OpenAI bot that replies in direct messages

## Projects

- `client/`: frontend client
- `server/`: NestJS backend for Google OAuth and session auth
- `user-data-worker/`: NestJS worker for Rocket.Chat data syncing
- `rocket-chat-openai-bot/`: Rocket.Chat bot service
- `docker-compose.rocket.yml`: local Rocket.Chat container setup
- `docker-compose.app.yml`: local app stack for MongoDB, Ollama, server, worker, bot, and client

## Prerequisites

- Node.js 18+
- npm
- A Google OAuth client
- A Rocket.Chat server
- An OpenAI API key, or local Ollama fallback through the app compose stack
- MongoDB running locally with replica set mode enabled when using the local Rocket.Chat container

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
- `npm run dev:worker` - run the Rocket.Chat data worker
- `npm run dev:all` - run client, server, worker, and bot together
- `npm run build` - build the Vite client
- `npm run build:server` - build the Nest server
- `npm run build:worker` - build the Nest worker
- `npm run compose:rocket` - start the local Rocket.Chat container from `docker-compose.rocket.yml`
- `npm run compose:app` - start the app stack from `docker-compose.app.yml`

`npm run dev:all` starts the local client, server, worker, and bot development processes.

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
It runs on `http://localhost:3001` by default, stores users in MongoDB, encrypts Rocket.Chat credentials before saving them, and exposes:

- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/session`
- `POST /auth/logout`
- `POST /users/me/rocket-integration`
- `POST /users/internal/rocket-sync/subscriptions`
- `POST /users/internal/rocket-sync/messages`

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
USER_DATA_WORKER_URL=http://localhost:3002
MONGODB_URI=mongodb://127.0.0.1:27017/chat-assistant
RC_URL=http://localhost:3000
SESSION_SECRET=replace-this-session-secret
INTERNAL_API_KEY=replace-this-with-a-long-random-internal-key
ROCKET_CREDENTIALS_ENCRYPTION_KEY=replace-this-with-a-long-random-secret
ACCESS_TOKEN_SECRET=replace-this-with-a-long-random-access-secret
REFRESH_TOKEN_SECRET=replace-this-with-a-long-random-refresh-secret
REFRESH_TOKEN_HASH_SECRET=replace-this-with-a-long-random-refresh-hash-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
SESSION_COOKIE_NAME=chat_assistant_session
SESSION_COOKIE_SECURE=false
```

Google OAuth configuration:

- Authorized JavaScript origin: `http://localhost:3001`
- Authorized redirect URI: `http://localhost:3001/auth/google/callback`

After Google login, the client sends the user to `Rocket Integration`, where they provide their Rocket.Chat `user token` and `user id`. Those values are encrypted and stored on the user document in MongoDB.
The worker and bot request the integrated Rocket.Chat users from the main server through internal endpoints protected by `INTERNAL_API_KEY`. If Rocket.Chat returns `401`, the app disconnects that integration and clears the stored Rocket.Chat auth fields.

Run only the server:

```sh
npm run dev:server
```

## Docker Compose

This repo has two compose files:

- `docker-compose.rocket.yml` runs a local Rocket.Chat container against MongoDB on your host machine.
- `docker-compose.app.yml` runs the app services: MongoDB, Ollama, server, worker, bot, and client.

Start local Rocket.Chat:

```sh
npm run compose:rocket
```

Start the app stack:

```sh
npm run compose:app
```

When both compose files are started from this repo, the app stack defaults to `RC_URL=http://rocketchat:3000` for container-to-container access. For a different Rocket.Chat server, set `RC_URL` in the root `.env` before starting the app stack.

## Local Rocket.Chat

The root `docker-compose.rocket.yml` runs Rocket.Chat on `http://localhost:3000` and connects it to MongoDB running on your host machine.

Setup:

```sh
cp .env.example .env
```

Root `.env`:

```sh
MONGO_HOST=host.docker.internal
```

`MONGO_HOST` must be the hostname or IP address that the Rocket.Chat container can use to reach the MongoDB host. `0.0.0.0` is only valid for MongoDB's bind address; do not use it as `MONGO_HOST`.

For Docker Desktop, `host.docker.internal` is the portable default. If the local MongoDB replica set was initialized with a specific host IP, use that same IP instead:

```sh
MONGO_HOST=192.168.56.1
```

MongoDB must run with replica set mode enabled. In `mongod.cfg`:

```yaml
net:
  port: 27017
  bindIp: 0.0.0.0

replication:
  replSetName: rs0
```

After restarting MongoDB, initialize the replica set once with the same host that Rocket.Chat will use:

```js
rs.initiate({
  _id: 'rs0',
  members: [{ _id: 0, host: '192.168.56.1:27017' }],
});
```

Start Rocket.Chat:

```sh
npm run compose:rocket
```

## User Data Worker

The worker lives in `user-data-worker/`. It polls Rocket.Chat using the integrated users returned by the main server, then persists subscriptions and messages back through internal main-server endpoints.

Setup:

```sh
cd user-data-worker
npm install
cp .env.example .env
```

Required values in `user-data-worker/.env`:

```sh
MAIN_SERVER_URL=http://localhost:3001
INTERNAL_API_KEY=replace-this-with-the-same-internal-key-used-by-server
RC_URL=http://localhost:3000
FULL_SUBSCRIPTIONS_SYNC_INTERVAL_MS=3600000
INCREMENTAL_SUBSCRIPTIONS_SYNC_INTERVAL_MS=900000
RC_REQUEST_INTERVAL_MS=500
RC_RETRY_BACKOFF_MS=5000
MAIN_SERVER_BATCH_SIZE=25
OPENAI_API_KEY=your-openai-api-key
SUMMARY_MODEL=gpt-4.1-mini
EMBEDDING_MODEL=text-embedding-3-small
SUMMARY_SOURCE_MESSAGE_LIMIT=100
```

The worker reconciles Rocket.Chat subscriptions with the app database. When a subscription disappears from Rocket.Chat, the worker removes that subscription and its saved summarization data from the app database. While a sync is pending or running, the preferences page warns the user that the displayed data may be stale.

Run only the worker:

```sh
npm run dev:worker
```

## Rocket.Chat Bot

The bot lives in `rocket-chat-openai-bot/`. It does not use a single static Rocket.Chat token from `.env`; it asks the main server for every user with a saved Rocket.Chat integration, then starts a runner for each integrated user.
It ignores existing messages when it first syncs a room, so it only replies to new ones after startup.

Setup:

```sh
cd rocket-chat-openai-bot
npm install
cp .env.example .env
```

Key bot env values:

- `RC_URL`
- `MAIN_SERVER_URL`
- `INTERNAL_API_KEY`
- `OPENAI_API_KEY`, or Ollama fallback settings
- `OPENAI_MODEL`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

Run only the bot:

```sh
npm run dev:bot
```

For full bot configuration, see [rocket-chat-openai-bot/README.md](/c:/Users/guyya/OneDrive/Documents/fsd/chat-assistant/rocket-chat-openai-bot/README.md:1).

## Full Local Run

For the local Docker path, start Rocket.Chat first and then the app stack:

```sh
npm run compose:rocket
npm run compose:app
```

Start everything together from the repo root:

```sh
npm run dev:all
```

Or run services separately:

```sh
npm run dev:server
npm run dev:worker
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
- MongoDB
- Rocket.Chat
- OpenAI API
- Tailwind CSS
- Radix UI
