import { createOpenAI } from "@ai-sdk/openai";

import { env } from "~/env";
import {
  getOllamaBaseUrlForDisplay,
  getOllamaLanguageModel,
  isOllamaConfiguredForDeployment,
} from "~/lib/ollama-model";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export type AiBackend = "openai" | "ollama";

/**
 * Explicit AI_PROVIDER wins; if unset and OPENAI_API_KEY is set, use OpenAI; else Ollama.
 */
export function resolveAiProvider(): AiBackend {
  if (env.AI_PROVIDER === "openai") return "openai";
  if (env.AI_PROVIDER === "ollama") return "ollama";
  if (env.OPENAI_API_KEY?.trim()) return "openai";
  return "ollama";
}

/** True when the active provider has the credentials / URLs it needs. */
export function isAiConfigured(): boolean {
  const p = resolveAiProvider();
  if (p === "openai") return Boolean(env.OPENAI_API_KEY?.trim());
  return isOllamaConfiguredForDeployment();
}

export function getAiNotConfiguredMessage(): string {
  return (
    "AI is not configured — set OPENAI_API_KEY (recommended) with AI_PROVIDER=openai, " +
    "or for self-hosted inference set AI_PROVIDER=ollama and OLLAMA_BASE_URL in production."
  );
}

function collectChainStrings(error: unknown, out: string[] = []): string[] {
  if (error instanceof Error) {
    out.push(error.message);
    if (error.cause !== undefined) collectChainStrings(error.cause, out);
  } else if (error instanceof AggregateError) {
    for (const e of error.errors) collectChainStrings(e, out);
  } else if (error != null) {
    out.push(String(error));
  }
  return out;
}

/** Short hint for logs / errors (no secrets). */
export function getAiConfigHintForErrors(): string {
  const p = resolveAiProvider();
  if (p === "openai") {
    const m = env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
    return `OpenAI-compatible API (model ${m})`;
  }
  return `Ollama at ${getOllamaBaseUrlForDisplay()}`;
}

let openAiCache: {
  key: string;
  model: ReturnType<ReturnType<typeof createOpenAI>>;
} | null = null;

function getOpenAiLanguageModel() {
  const apiKey = env.OPENAI_API_KEY ?? "";
  const baseURL = env.OPENAI_BASE_URL;
  const modelName = env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const key = `${apiKey}\0${baseURL ?? ""}\0${modelName}`;
  if (!openAiCache || openAiCache.key !== key) {
    const provider = createOpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
    openAiCache = {
      key,
      model: provider(modelName),
    };
  }
  return openAiCache.model;
}

export function getAppLanguageModel() {
  const p = resolveAiProvider();
  if (p === "openai") return getOpenAiLanguageModel();
  return getOllamaLanguageModel();
}

/**
 * Map common OpenAI / compatible API failures to safe user-facing messages (503).
 * Returns null to fall through to generic 500 handling.
 */
export function mapOpenAiAnalyzeError(error: unknown): string | null {
  const s = collectChainStrings(error)
    .join(" ")
    .toLowerCase();

  if (
    s.includes("401") ||
    s.includes("unauthorized") ||
    s.includes("invalid api key") ||
    s.includes("incorrect api key")
  ) {
    return "OpenAI API rejected the request — check OPENAI_API_KEY.";
  }
  if (s.includes("429") || s.includes("rate limit") || s.includes("too many requests")) {
    return "OpenAI rate limit — try again in a moment.";
  }
  if (
    s.includes("insufficient_quota") ||
    s.includes("billing") ||
    s.includes("exceeded your current quota") ||
    s.includes("insufficient credits") ||
    s.includes("purchase more") ||
    s.includes("never purchased credits")
  ) {
    return "AI provider quota or credits — add credits or billing on your API account (e.g. OpenRouter settings).";
  }
  if (
    s.includes("econnrefused") ||
    s.includes("enotfound") ||
    s.includes("etimedout") ||
    s.includes("fetch failed") ||
    s.includes("failed to fetch") ||
    s.includes("getaddrinfo") ||
    s.includes("network") ||
    s.includes("socket hang up")
  ) {
    return "Could not reach the OpenAI API — check network or OPENAI_BASE_URL (e.g. OpenRouter).";
  }
  return null;
}
