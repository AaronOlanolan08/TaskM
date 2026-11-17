import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  accessTokenMaxAge,
  getSessionUser,
  login,
  register,
  refreshSession,
  revokeRefreshToken,
} from "./auth.service.js";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z
    .string()
    .min(1)
    .max(72)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

const registrationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z
    .string()
    .min(8)
    .max(72)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

const ACCESS_COOKIE = "taskm_access";
const REFRESH_COOKIE = "taskm_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

function setAuthCookies(
  response: Response,
  tokens: {
    accessToken: string;
    refreshToken: string;
    refreshExpiresAt: Date;
  },
) {
  response.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieOptions,
    path: "/api",
    maxAge: accessTokenMaxAge,
  });
  response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieOptions,
    path: REFRESH_COOKIE_PATH,
    expires: tokens.refreshExpiresAt,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

function clearAuthCookies(response: Response) {
  response.clearCookie(ACCESS_COOKIE, { ...cookieOptions, path: "/api" });
  response.clearCookie(REFRESH_COOKIE, {
    ...cookieOptions,
    path: REFRESH_COOKIE_PATH,
  });
}

export async function loginController(
  request: Request,
  response: Response,
): Promise<void> {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Enter a valid email and password." });
    return;
  }

  const result = await login(parsed.data.email, parsed.data.password);
  if (!result) {
    response.status(401).json({ error: "Invalid email or password." });
    return;
  }

  setAuthCookies(response, result.tokens);
  response.json({ user: result.user });
}

export async function registerController(
  request: Request,
  response: Response,
): Promise<void> {
  const parsed = registrationSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Enter a name, valid email, and password of at least 8 characters." });
    return;
  }

  try {
    const result = await register(
      parsed.data.name,
      parsed.data.email,
      parsed.data.password,
    );
    setAuthCookies(response, result.tokens);
    response.status(201).json({ user: result.user });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      response.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    throw error;
  }
}

export async function refreshController(
  request: Request,
  response: Response,
): Promise<void> {
  const refreshToken = request.cookies[REFRESH_COOKIE];
  if (typeof refreshToken !== "string") {
    clearAuthCookies(response);
    response.status(401).json({ error: "Your session has expired. Sign in again." });
    return;
  }

  const result = await refreshSession(refreshToken);
  if (!result) {
    clearAuthCookies(response);
    response.status(401).json({ error: "Your session has expired. Sign in again." });
    return;
  }

  setAuthCookies(response, result.tokens);
  response.json({ user: result.user });
}

export async function logoutController(
  request: Request,
  response: Response,
): Promise<void> {
  const refreshToken = request.cookies[REFRESH_COOKIE];
  if (typeof refreshToken === "string") {
    await revokeRefreshToken(refreshToken);
  }
  clearAuthCookies(response);
  response.status(204).end();
}

export async function meController(
  request: Request,
  response: Response,
): Promise<void> {
  const auth = request.auth;
  if (!auth) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  const user = await getSessionUser(auth.userId, auth.sessionId);
  if (!user) {
    clearAuthCookies(response);
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  response.json({ user });
}
