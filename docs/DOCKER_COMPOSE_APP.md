# Docker Compose App Stack

This stack runs:
- `client` (Vite) on `http://localhost:8080`
- `server` (Nest) on `http://localhost:3001`
- `worker`
- `bot` (OpenAI primary, Ollama fallback)
- `mongo`
- `ollama`

## 1) Configure env

Copy:

```bash
cp .env.compose.example .env.compose
```

Edit `.env.compose` and set at least:
- `SESSION_SECRET`
- `INTERNAL_API_KEY`
- `ROCKET_CREDENTIALS_ENCRYPTION_KEY`
- `MASTER_PASSWORD`

Optional:
- `OPENAI_API_KEY` (if unset/invalid, bot falls back to Ollama)

## 2) Start stack

```bash
docker compose --env-file .env.compose -f docker-compose.app.yml up -d --build
```

On first run, `ollama-model-init` pulls `OLLAMA_MODEL` (default `llama3.2:3b`).

## 3) Verify

```bash
docker compose --env-file .env.compose -f docker-compose.app.yml ps
docker compose --env-file .env.compose -f docker-compose.app.yml logs -f server bot worker client
```

## 4) Login + integration

1. Open `http://localhost:8080/login`
2. Login with the master password from `.env.compose`
3. Go to `/rocket-integration` and save Rocket user token + user id

## Notes

- Client proxy inside container is set via `VITE_API_TARGET=http://server:3001`.
- Bot uses:
  - OpenAI: `OPENAI_API_KEY` + `OPENAI_MODEL`
  - Fallback: `OLLAMA_BASE_URL=http://ollama:11434/v1`, `OLLAMA_MODEL`
- To stop:

```bash
docker compose --env-file .env.compose -f docker-compose.app.yml down
```

