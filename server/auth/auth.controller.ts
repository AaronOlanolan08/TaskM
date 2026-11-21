import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import {
  accessTokenMaxAge,
  getSessionUser,
  login,
  loginWithGoogle,
  register,
  refreshSession,
  revokeRefreshToken,
} from "./auth.service.js";
import { config } from "../config.js";

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
const GOOGLE_STATE_COOKIE = "taskm_google_state";
const GOOGLE_NONCE_COOKIE = "taskm_google_nonce";
const GOOGLE_COOKIE_MAX_AGE = 10 * 60 * 1000;
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

function googleCookieOptions() {
  return {
    ...cookieOptions,
    path: "/api/auth/google",
    maxAge: GOOGLE_COOKIE_MAX_AGE,
  };
}

function clearGoogleCookies(response: Response) {
  response.clearCookie(GOOGLE_STATE_COOKIE, googleCookieOptions());
  response.clearCookie(GOOGLE_NONCE_COOKIE, googleCookieOptions());
}

function redirectToLogin(response: Response, error: string) {
  const url = new URL("/login", config.APP_ORIGIN);
  url.searchParams.set("google_error", error);
  response.redirect(url.toString());
}

function getGoogleOAuthConfig() {
  if (!config.GOOGLE_OAUTH_ENABLED || !config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    return null;
  }
  return {
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.GOOGLE_REDIRECT_URI,
  };
}

export function googleAuthStartController(
  _request: Request,
  response: Response,
): void {
  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    redirectToLogin(response, "not_configured");
    return;
  }

  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  response.cookie(GOOGLE_STATE_COOKIE, state, googleCookieOptions());
  response.cookie(GOOGLE_NONCE_COOKIE, nonce, googleCookieOptions());

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: oauthConfig.clientId,
    redirect_uri: oauthConfig.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
  }).toString();
  response.redirect(url.toString());
}

export async function googleAuthCallbackController(
  request: Request,
  response: Response,
): Promise<void> {
  const oauthConfig = getGoogleOAuthConfig();
  const state = request.query.state;
  const storedState = request.cookies[GOOGLE_STATE_COOKIE];
  const nonce = request.cookies[GOOGLE_NONCE_COOKIE];
  clearGoogleCookies(response);

  if (
    !oauthConfig ||
    typeof state !== "string" ||
    typeof storedState !== "string" ||
    Buffer.byteLength(state) !== Buffer.byteLength(storedState) ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(storedState)) ||
    typeof nonce !== "string"
  ) {
    redirectToLogin(response, "failed");
    return;
  }

  if (typeof request.query.error === "string") {
    redirectToLogin(response, "cancelled");
    return;
  }

  const code = request.query.code;
  if (typeof code !== "string") {
    redirectToLogin(response, "failed");
    return;
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: oauthConfig.redirectUri,
    }),
  });
  const tokenBody: unknown = await tokenResponse.json();
  if (
    !tokenResponse.ok ||
    typeof tokenBody !== "object" ||
    tokenBody === null ||
    !("id_token" in tokenBody) ||
    typeof tokenBody.id_token !== "string"
  ) {
    redirectToLogin(response, "failed");
    return;
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(tokenBody.id_token, googleKeys, {
      algorithms: ["RS256"],
      audience: oauthConfig.clientId,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    }));
  } catch {
    redirectToLogin(response, "failed");
    return;
  }

  if (
    payload.nonce !== nonce ||
    payload.email_verified !== true ||
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    payload.sub.length > 255 ||
    typeof payload.email !== "string"
  ) {
    redirectToLogin(response, "failed");
    return;
  }

  const parsedEmail = z.string().trim().email().max(320).safeParse(payload.email);
  if (!parsedEmail.success) {
    redirectToLogin(response, "failed");
    return;
  }

  const name =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : parsedEmail.data.split("@")[0];
  const profile = {
    sub: payload.sub,
    email: parsedEmail.data.toLowerCase(),
    name: name.slice(0, 120),
    ...(typeof payload.picture === "string" ? { picture: payload.picture } : {}),
  };

  let result;
  try {
    result = await loginWithGoogle(profile);
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
    result = await loginWithGoogle(profile);
  }

  if (!result) {
    redirectToLogin(response, "account_unavailable");
    return;
  }

  setAuthCookies(response, result.tokens);
  response.redirect(new URL("/home", config.APP_ORIGIN).toString());
}

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
