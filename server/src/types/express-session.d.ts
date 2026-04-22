import "express-session";
import type { SessionUser } from "../auth/session-user";

declare global {
  namespace Express {
    interface User extends SessionUser {}
  }
}

export {};
