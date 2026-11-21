import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
}).superRefine((values, context) => {
  if (Boolean(values.GOOGLE_CLIENT_ID) !== Boolean(values.GOOGLE_CLIENT_SECRET)) {
    context.addIssue({
      code: "custom",
      message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
      path: ["GOOGLE_CLIENT_ID"],
    });
  }
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  const missingOrInvalid = result.error.issues.map((issue) => issue.path.join("."));
  throw new Error(`Invalid server configuration: ${missingOrInvalid.join(", ")}`);
}

export const config = {
  ...result.data,
  GOOGLE_REDIRECT_URI:
    result.data.GOOGLE_REDIRECT_URI ??
    `http://localhost:${result.data.PORT}/api/auth/google/callback`,
  GOOGLE_OAUTH_ENABLED: Boolean(
    result.data.GOOGLE_CLIENT_ID && result.data.GOOGLE_CLIENT_SECRET,
  ),
};
