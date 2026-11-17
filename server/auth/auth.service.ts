import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { config } from "../config.js";
import { prisma } from "../db/prisma.js";

const jwtSecret = new TextEncoder().encode(config.JWT_SECRET);
const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_DAYS = 30;
const DUMMY_PASSWORD_HASH = await bcrypt.hash(
  randomBytes(32).toString("hex"),
  12,
);

export type PublicUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export type AuthResult = { user: PublicUser; tokens: AuthTokens };

const hashRefreshToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const createAccessToken = (userId: string, sessionId: string) =>
  new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
    .sign(jwtSecret);

const newRefreshToken = () => randomBytes(32).toString("base64url");

const refreshExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
  return expiresAt;
};

async function createSession(userId: string): Promise<AuthTokens> {
  const refreshToken = newRefreshToken();
  const refreshExpiresAt = refreshExpiry();
  const session = await prisma.authSession.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
    },
    select: { id: true },
  });

  return {
    accessToken: await createAccessToken(userId, session.id),
    refreshToken,
    refreshExpiresAt,
  };
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      disabledAt: true,
    },
  });

  const passwordMatches = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !passwordMatches || user.disabledAt) return null;

  return {
    user: { id: user.id, email: user.email, name: user.name },
    tokens: await createSession(user.id),
  };
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (transaction) => {
    const newUser = await transaction.user.create({
      data: { name, email, passwordHash },
      select: { id: true, email: true, name: true },
    });
    const workspace = await transaction.workspace.create({
      data: {
        name: `${name}'s workspace`.slice(0, 100),
        slug: `workspace-${randomUUID()}`,
        createdById: newUser.id,
      },
      select: { id: true },
    });
    await transaction.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: newUser.id,
        role: "OWNER",
      },
    });

    return newUser;
  });

  return {
    user,
    tokens: await createSession(user.id),
  };
}

export async function refreshSession(
  currentRefreshToken: string,
): Promise<{ user: PublicUser; tokens: AuthTokens } | null> {
  const currentHash = hashRefreshToken(currentRefreshToken);
  const session = await prisma.authSession.findUnique({
    where: { refreshTokenHash: currentHash },
    include: {
      user: {
        select: { id: true, email: true, name: true, disabledAt: true },
      },
    },
  });

  const now = new Date();
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    session.user.disabledAt
  ) {
    return null;
  }

  const refreshToken = newRefreshToken();
  const refreshExpiresAt = refreshExpiry();
  const updated = await prisma.authSession.updateMany({
    where: {
      id: session.id,
      refreshTokenHash: currentHash,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
    },
  });

  if (updated.count !== 1) return null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    tokens: {
      accessToken: await createAccessToken(session.user.id, session.id),
      refreshToken,
      refreshExpiresAt,
    },
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: {
      refreshTokenHash: hashRefreshToken(refreshToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export async function getSessionUser(
  userId: string,
  sessionId: string,
): Promise<PublicUser | null> {
  const session = await prisma.authSession.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { disabledAt: null },
    },
    select: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return session?.user ?? null;
}

export async function verifyAccessToken(
  token: string,
): Promise<{ userId: string; sessionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret, {
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      return null;
    }

    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export const accessTokenMaxAge = ACCESS_TOKEN_SECONDS * 1000;
