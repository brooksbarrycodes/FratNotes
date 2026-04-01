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
    AI_PROVIDER: z.enum(["ollama", "openai"]).optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().optional(),
    OPENAI_BASE_URL: z.string().url().optional(),
    OLLAMA_BASE_URL: z.string().url().optional(),
    OLLAMA_MODEL: z.string().optional(),
    OLLAMA_API_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_OPENPAPER_ENABLED: z.enum(["true", "false"]).optional(),
    NEXT_PUBLIC_OPENPAPER_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
    NEXT_PUBLIC_AI_CHAT_LABEL: z.string().optional(),
  },
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    AI_PROVIDER: process.env.AI_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL,
    OLLAMA_API_KEY: process.env.OLLAMA_API_KEY,
    OPENPAPER_ENABLED: process.env.OPENPAPER_ENABLED,
    OPENPAPER_API_URL: process.env.OPENPAPER_API_URL,
    OPENPAPER_DEFAULT_BEARER_TOKEN: process.env.OPENPAPER_DEFAULT_BEARER_TOKEN,
    NEXT_PUBLIC_OPENPAPER_ENABLED: process.env.NEXT_PUBLIC_OPENPAPER_ENABLED,
    NEXT_PUBLIC_OPENPAPER_API_URL: process.env.NEXT_PUBLIC_OPENPAPER_API_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_AI_CHAT_LABEL: process.env.NEXT_PUBLIC_AI_CHAT_LABEL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
