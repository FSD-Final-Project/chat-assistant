import WebSocket from "ws";

import type { BotConfig, ManagedSubscription, RocketChatAuth } from "../types/bot.js";
import type { RocketChatMessage } from "../types/rocketchat.js";

type MessageHandler = (
  subscription: ManagedSubscription,
  message: RocketChatMessage,
) => Promise<void> | void;

type SubscriptionsChangedHandler = () => Promise<ManagedSubscription[]> | ManagedSubscription[];

interface DdpConnectMessage {
  msg: "connect";
  version: string;
  support: string[];
}

interface DdpPingMessage {
  msg: "ping";
}

interface DdpConnectedMessage {
  msg: "connected";
  session: string;
}

interface DdpErrorPayload {
  reason?: string;
  message?: string;
}

type DdpIncomingMessage = { msg?: string; [key: string]: unknown };

export class RocketChatRealtimeClient {
  private socket: WebSocket | null = null;
  private messageCounter = 0;
  private readonly pendingMethodResolvers = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void }
  >();
  private readonly pendingSubscriptionResolvers = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void }
  >();

  constructor(
    private readonly config: BotConfig,
    private readonly auth: RocketChatAuth,
  ) {}

  async run(
    subscriptions: ManagedSubscription[],
    onMessage: MessageHandler,
    onSubscriptionsChanged?: SubscriptionsChangedHandler,
  ): Promise<void> {
    const roomMap = new Map(subscriptions.map((subscription) => [subscription.roomId, subscription]));
    let isRefreshingSubscriptions = false;
    const socketUrl = this.getWebSocketUrl();
    const socket = new WebSocket(socketUrl);
    this.socket = socket;

    let connectedResolver: (() => void) | null = null;
    let connectedRejecter: ((error: Error) => void) | null = null;
    const connectedPromise = new Promise<void>((resolve, reject) => {
      connectedResolver = resolve;
      connectedRejecter = reject;
    });

    let closeResolver: (() => void) | null = null;
    const closePromise = new Promise<void>((resolve) => {
      closeResolver = resolve;
    });

    socket.addEventListener("open", () => {
      this.send({
        msg: "connect",
        version: "1",
        support: ["1", "pre2", "pre1"],
      } satisfies DdpConnectMessage);
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as DdpIncomingMessage;

        if (payload.msg === "ping") {
          this.send({ msg: "pong" });
          return;
        }

        if (payload.msg === "connected") {
          connectedResolver?.();
          return;
        }

        if (payload.msg === "result" && typeof payload.id === "string") {
          const resolver = this.pendingMethodResolvers.get(payload.id);
          const error = this.getDdpError(payload.error);
          if (resolver) {
            this.pendingMethodResolvers.delete(payload.id);
            if (error) {
              resolver.reject(
                new Error(error.reason ?? error.message ?? "Rocket.Chat method failed"),
              );
            } else {
              resolver.resolve();
            }
          }
          return;
        }

        if (payload.msg === "ready") {
          const subs = Array.isArray(payload.subs) ? payload.subs : [];
          for (const subId of subs) {
            if (typeof subId !== "string") {
              continue;
            }
            const resolver = this.pendingSubscriptionResolvers.get(subId);
            if (resolver) {
              this.pendingSubscriptionResolvers.delete(subId);
              resolver.resolve();
            }
          }
          return;
        }

        if (payload.msg === "nosub" && typeof payload.id === "string") {
          const resolver = this.pendingSubscriptionResolvers.get(payload.id);
          const error = this.getDdpError(payload.error);
          if (resolver) {
            this.pendingSubscriptionResolvers.delete(payload.id);
            resolver.reject(
              new Error(error?.reason ?? error?.message ?? "Rocket.Chat subscription failed"),
            );
          }
          return;
        }

        if (
          payload.msg === "changed" &&
          payload.collection === "stream-notify-user" &&
          this.isChangedFields(payload.fields) &&
          payload.fields.eventName === `${this.auth.userId}/subscriptions-changed`
        ) {
          if (onSubscriptionsChanged && !isRefreshingSubscriptions) {
            isRefreshingSubscriptions = true;
            void Promise.resolve(onSubscriptionsChanged())
              .then(async (nextSubscriptions) => {
                for (const subscription of nextSubscriptions) {
                  if (roomMap.has(subscription.roomId)) {
                    roomMap.set(subscription.roomId, subscription);
                    continue;
                  }

                  await this.subscribeToRoomMessages(subscription.roomId);
                  roomMap.set(subscription.roomId, subscription);
                  console.log(
                    `[${this.auth.email ?? this.auth.googleId}] Realtime listener added new subscription ${subscription.roomId}.`,
                  );
                }
              })
              .catch((error) => {
                console.error(
                  `[${this.auth.email ?? this.auth.googleId}] Failed to refresh subscriptions after Rocket.Chat change: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
              })
              .finally(() => {
                isRefreshingSubscriptions = false;
              });
          }
          return;
        }

        if (
          payload.msg === "changed" &&
          payload.collection === "stream-room-messages" &&
          this.isChangedFields(payload.fields)
        ) {
          const message = Array.isArray(payload.fields.args)
            ? (payload.fields.args[0] as RocketChatMessage | undefined)
            : undefined;
          const roomId = message?.rid ?? payload.fields.eventName;
          const subscription = roomMap.get(roomId);

          if (subscription && message) {
            void onMessage(subscription, message);
          }
        }
      } catch (error) {
        console.error(
          `[${this.auth.email ?? this.auth.googleId}] Failed to process realtime message: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    socket.addEventListener("error", () => {
      connectedRejecter?.(
        new Error(`Realtime socket error for '${this.auth.email ?? this.auth.googleId}'`),
      );
    });

    socket.addEventListener("close", () => {
      closeResolver?.();
    });

    await connectedPromise;
    await this.loginWithResumeToken();
    await this.subscribeToSubscriptionChanges();

    for (const subscription of subscriptions) {
      await this.subscribeToRoomMessages(subscription.roomId);
    }

    console.log(
      `[${this.auth.email ?? this.auth.googleId}] Realtime listener active for ${subscriptions.length} subscription(s) and subscription changes.`,
    );

    await closePromise;
    this.socket = null;
  }

  private async loginWithResumeToken(): Promise<void> {
    await this.callMethod("login", [{ resume: this.auth.userToken }]);
  }

  private async subscribeToRoomMessages(roomId: string): Promise<void> {
    await this.subscribe("stream-room-messages", [roomId, false]);
  }

  private async subscribeToSubscriptionChanges(): Promise<void> {
    await this.subscribe("stream-notify-user", [`${this.auth.userId}/subscriptions-changed`, false]);
  }

  private async callMethod(method: string, params: unknown[]): Promise<void> {
    const id = this.nextId("method");
    const result = new Promise<void>((resolve, reject) => {
      this.pendingMethodResolvers.set(id, { resolve, reject });
    });

    this.send({
      msg: "method",
      method,
      id,
      params,
    });

    await result;
  }

  private async subscribe(name: string, params: unknown[]): Promise<void> {
    const id = this.nextId("sub");
    const result = new Promise<void>((resolve, reject) => {
      this.pendingSubscriptionResolvers.set(id, { resolve, reject });
    });

    this.send({
      msg: "sub",
      id,
      name,
      params,
    });

    await result;
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Rocket.Chat realtime socket is not open");
    }

    this.socket.send(JSON.stringify(payload));
  }

  private nextId(prefix: string): string {
    this.messageCounter += 1;
    return `${prefix}-${this.messageCounter}`;
  }

  private getDdpError(value: unknown): DdpErrorPayload | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const typedValue = value as Record<string, unknown>;
    return {
      reason: typeof typedValue.reason === "string" ? typedValue.reason : undefined,
      message: typeof typedValue.message === "string" ? typedValue.message : undefined,
    };
  }

  private isChangedFields(
    value: unknown,
  ): value is { eventName: string; args?: unknown[] } {
    if (!value || typeof value !== "object") {
      return false;
    }

    const typedValue = value as Record<string, unknown>;
    return typeof typedValue.eventName === "string";
  }

  private getWebSocketUrl(): string {
    const normalized = this.config.rcUrl.replace(/\/+$/, "");
    if (normalized.startsWith("https://")) {
      return `${normalized.replace(/^https:\/\//, "wss://")}/websocket`;
    }

    if (normalized.startsWith("http://")) {
      return `${normalized.replace(/^http:\/\//, "ws://")}/websocket`;
    }

    throw new Error(`Unsupported Rocket.Chat URL for realtime connection: ${this.config.rcUrl}`);
  }
}
