import type { NextFunction, Request, Response } from "express";
import { getSessionUser, verifyAccessToken } from "./auth.service.js";

const ACCESS_COOKIE = "taskm_access";

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const token = request.cookies[ACCESS_COOKIE];
  if (typeof token !== "string") {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  const claims = await verifyAccessToken(token);
  if (!claims) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  const user = await getSessionUser(claims.userId, claims.sessionId);
  if (!user) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  request.auth = claims;
  next();
}
