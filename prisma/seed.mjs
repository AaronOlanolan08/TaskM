import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;
const email = "demo@taskm.local";
const name = "Taskm Demo";
const workspaceName = "Taskm Demo";
const workspaceSlug = "taskm-demo";
const passwordKey = "SEED_USER_PASSWORD";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in .env before seeding.");
}

if (!process.env[passwordKey]) {
  const generatedPassword = randomBytes(24).toString("base64url");
  const envPath = resolve(".env");
  const envContents = await readFile(envPath, "utf8");
  const setting = new RegExp(`^${passwordKey}\\s*=.*$`, "m");
  const updatedContents = setting.test(envContents)
    ? envContents.replace(setting, `${passwordKey}=${generatedPassword}`)
    : `${envContents.trimEnd()}\n${passwordKey}=${generatedPassword}\n`;
  await writeFile(envPath, updatedContents, "utf8");
  process.env[passwordKey] = generatedPassword;
  console.log(`Generated and saved a local demo password: ${generatedPassword}`);
}

const password = process.env[passwordKey];
if (password.length < 12) {
  throw new Error(`${passwordKey} must be at least 12 characters long.`);
}

const passwordHash = await bcrypt.hash(password, 12);
const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  await client.query("BEGIN");

  const userResult = await client.query(
    `INSERT INTO "User" ("id", "email", "name", "passwordHash", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("email") DO UPDATE
     SET "name" = EXCLUDED."name",
         "passwordHash" = EXCLUDED."passwordHash",
         "updatedAt" = CURRENT_TIMESTAMP
     RETURNING "id"`,
    ["a2db4b1f-c239-4ded-a202-26d9545418e3", email, name, passwordHash],
  );
  const userId = userResult.rows[0].id;

  const workspaceResult = await client.query(
    `INSERT INTO "Workspace" ("id", "name", "slug", "createdById", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("slug") DO UPDATE
     SET "name" = EXCLUDED."name",
         "createdById" = EXCLUDED."createdById",
         "updatedAt" = CURRENT_TIMESTAMP
     RETURNING "id"`,
    [
      "e10fc155-c289-4088-806d-32a6740e795a",
      workspaceName,
      workspaceSlug,
      userId,
    ],
  );
  const workspaceId = workspaceResult.rows[0].id;

  await client.query(
    `INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role", "joinedAt")
     VALUES ($1, $2, 'OWNER'::"WorkspaceRole", CURRENT_TIMESTAMP)
     ON CONFLICT ("workspaceId", "userId") DO UPDATE
     SET "role" = EXCLUDED."role"`,
    [workspaceId, userId],
  );

  await client.query("COMMIT");
  console.log(`Seeded ${email} with a bcrypt password hash.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
