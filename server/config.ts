import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  const missingOrInvalid = result.error.issues.map((issue) => issue.path.join("."));
  throw new Error(`Invalid server configuration: ${missingOrInvalid.join(", ")}`);
}

export const config = result.data;
