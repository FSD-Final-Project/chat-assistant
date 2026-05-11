declare module "ws" {
  export default class WebSocket {
    static readonly OPEN: number;
    readonly readyState: number;

    constructor(url: string);

    addEventListener(
      type: "open" | "error" | "close",
      listener: () => void,
    ): void;

    addEventListener(
      type: "message",
      listener: (event: { data: unknown }) => void,
    ): void;

    send(data: string): void;
  }
}
