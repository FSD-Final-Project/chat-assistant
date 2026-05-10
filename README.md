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
- `docker-compose.yml`: local Rocket.Chat container setup

## Prerequisites

- Node.js 18+
- npm
- A Google OAuth client
- An OpenAI API key
- A Rocket.Chat server and bot user token
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
- `npm run rocket` - start the local Rocket.Chat container from `docker-compose.yml`

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
MONGODB_URI=mongodb://127.0.0.1:27017/chat-assistant
SESSION_SECRET=replace-this-session-secret
ROCKET_CREDENTIALS_ENCRYPTION_KEY=replace-this-with-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
SESSION_COOKIE_NAME=chat_assistant_session
SESSION_COOKIE_SECURE=false
```

Google OAuth configuration:

- Authorized JavaScript origin: `http://localhost:3001`
- Authorized redirect URI: `http://localhost:3001/auth/google/callback`

After Google login, the client sends the user to `Rocket Integration`, where they must provide their Rocket.Chat `user token` and `user id`. Those values are encrypted and stored on the user document in MongoDB.
The main server no longer pulls Rocket.Chat history itself; the worker service does that over internal HTTPS requests.

Run only the server:

```sh
npm run dev:server
```

## Local Rocket.Chat

The root `docker-compose.yml` runs Rocket.Chat on `http://localhost:3000` and connects it to MongoDB running on your host machine.

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
  _id: "rs0",
  members: [
    { _id: 0, host: "192.168.56.1:27017" }
  ]
})
```

Start Rocket.Chat:

```sh
npm run rocket
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
RC_URL=https://open.rocket.chat
POLL_INTERVAL_MS=30000
RC_REQUEST_INTERVAL_MS=500
RC_RETRY_BACKOFF_MS=5000
```

Run only the worker:

```sh
npm run dev:worker
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
