import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    DATABASE_URL: z.string(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    OPENPAPER_ENABLED: z.enum(["true", "false"]).optional(),
    OPENPAPER_API_URL: z.string().url().optional(),
    OPENPAPER_DEFAULT_BEARER_TOKEN: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_OLLAMA_URL: z.string().optional(),
    NEXT_PUBLIC_OPENPAPER_ENABLED: z.enum(["true", "false"]).optional(),
    NEXT_PUBLIC_OPENPAPER_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  },
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_OLLAMA_URL: process.env.NEXT_PUBLIC_OLLAMA_URL,
    OPENPAPER_ENABLED: process.env.OPENPAPER_ENABLED,
    OPENPAPER_API_URL: process.env.OPENPAPER_API_URL,
    OPENPAPER_DEFAULT_BEARER_TOKEN: process.env.OPENPAPER_DEFAULT_BEARER_TOKEN,
    NEXT_PUBLIC_OPENPAPER_ENABLED: process.env.NEXT_PUBLIC_OPENPAPER_ENABLED,
    NEXT_PUBLIC_OPENPAPER_API_URL: process.env.NEXT_PUBLIC_OPENPAPER_API_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
