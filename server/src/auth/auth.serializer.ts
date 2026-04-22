import { Injectable } from "@nestjs/common";
import { PassportSerializer } from "@nestjs/passport";
import type { SessionUser } from "./session-user";

@Injectable()
export class AuthSerializer extends PassportSerializer {
  serializeUser(user: SessionUser, done: (err: Error | null, user: SessionUser) => void) {
    done(null, user);
  }

  deserializeUser(payload: SessionUser, done: (err: Error | null, payload: SessionUser) => void) {
    done(null, payload);
  }
}
