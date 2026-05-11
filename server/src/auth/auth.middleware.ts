import type { Request, Response, NextFunction } from "express";
import type { AuthService } from "./auth.service";

export function createAuthMiddleware(authService: AuthService) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const user = await authService.authenticateRequest(request, response);
      if (user) {
        request.user = user;
      }
    } catch {
      authService.clearAuthCookies(response);
    }

    next();
  };
}
