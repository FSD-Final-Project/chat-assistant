FROM node:20-bookworm

WORKDIR /app

# Install dependencies for root and subprojects first for better cache reuse.
COPY package*.json ./
COPY server/package*.json ./server/
COPY user-data-worker/package*.json ./user-data-worker/
COPY rocket-chat-openai-bot/package*.json ./rocket-chat-openai-bot/

RUN npm ci \
  && npm ci --prefix server \
  && npm ci --prefix user-data-worker \
  && npm ci --prefix rocket-chat-openai-bot

COPY . .

