import { z } from "zod";

/**
 * Environment variable schema — validated at startup.
 * If any variable is missing or malformed the process will crash
 * immediately with a descriptive error (fail-fast principle).
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string({
      required_error: "DATABASE_URL is required — provide a valid PostgreSQL connection string.",
    })
    .url("DATABASE_URL must be a valid URL (e.g. postgresql://user:pass@host:5432/db)"),

  PORT: z.coerce
    .number({
      required_error: "PORT is required.",
      invalid_type_error: "PORT must be a valid number.",
    })
    .int()
    .min(1)
    .max(65535)
    .default(3000),

  NODE_ENV: z
    .enum(["development", "production", "test"], {
      required_error: "NODE_ENV is required (development | production | test).",
    })
    .default("development"),

  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string({
      required_error:
        "GOOGLE_GENERATIVE_AI_API_KEY is required — get one at https://aistudio.google.com/apikey",
    })
    .min(1, "GOOGLE_GENERATIVE_AI_API_KEY cannot be empty"),

  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_REDIRECT_URI: z.string().url("GOOGLE_REDIRECT_URI must be a valid URL"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌  Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

/** Validated, type-safe environment variables. */
export const env = validateEnv();
