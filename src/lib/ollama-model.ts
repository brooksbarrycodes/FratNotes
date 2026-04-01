import { createOllama, OllamaError } from "ai-sdk-ollama";

import { env } from "~/env";

const DEFAULT_DEV_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1:8b";

let ollamaUrlCorrectionLogged = false;

/**
 * Normalize Ollama API base URL: trim slash, localhost → 127.0.0.1, fix common typos
 * (14434→11434, https→http for local loopback on 11434 — stock Ollama is HTTP-only).
 */
export function normalizeOllamaBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);

    if (u.hostname === "localhost") {
      u.hostname = "127.0.0.1";
    }

    if (u.port === "14434") {
      u.port = "11434";
    }

    if (
      u.hostname === "127.0.0.1" &&
      u.port === "11434" &&
      u.protocol === "https:"
    ) {
      u.protocol = "http:";
    }

    const result = u.toString().replace(/\/+$/, "");
    if (
      result !== trimmed &&
      env.NODE_ENV === "development" &&
      !ollamaUrlCorrectionLogged
    ) {
      ollamaUrlCorrectionLogged = true;
      console.warn(
        `[ollama] Corrected OLLAMA_BASE_URL: ${trimmed} → ${result}`,
      );
    }
    return result;
  } catch {
    return trimmed;
  }
}

function resolveBaseUrl(): string {
  if (env.OLLAMA_BASE_URL) {
    return normalizeOllamaBaseUrl(env.OLLAMA_BASE_URL);
  }
  if (env.NODE_ENV === "production") {
    throw new Error("OLLAMA_BASE_URL is not set");
  }
  return DEFAULT_DEV_BASE_URL;
}

/**
 * Safe to show in API errors (no API key). Same URL the server uses to call Ollama.
 */
export function getOllamaBaseUrlForDisplay(): string {
  return resolveBaseUrl();
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

/**
 * True when the failure is probably transport (TCP/DNS/TLS), not bad model output or schema.
 * Avoid matching the substring "ollama" alone — OllamaError is used for many non-network cases.
 */
export function isLikelyOllamaTransportFailure(error: unknown): boolean {
  const combined = collectChainStrings(error)
    .join(" ")
    .toLowerCase();

  if (OllamaError.isOllamaError(error)) {
    const msg = error.message.toLowerCase();
    if (
      /model.*not found|not found/i.test(msg) &&
      !combined.includes("econnrefused") &&
      !combined.includes("fetch failed")
    ) {
      return false;
    }
  }

  return (
    combined.includes("econnrefused") ||
    combined.includes("enotfound") ||
    combined.includes("etimedout") ||
    combined.includes("eai_again") ||
    combined.includes("econnreset") ||
    combined.includes("fetch failed") ||
    combined.includes("failed to fetch") ||
    combined.includes("socket hang up") ||
    combined.includes("network error") ||
    combined.includes("getaddrinfo") ||
    combined.includes("certificate") ||
    combined.includes("ssl") ||
    combined.includes("tls") ||
    combined.includes("11434")
  );
}

/** Production deployments must set OLLAMA_BASE_URL; local dev can omit (defaults to localhost). */
export function isOllamaConfiguredForDeployment(): boolean {
  return env.NODE_ENV !== "production" || Boolean(env.OLLAMA_BASE_URL);
}

let cachedProvider: {
  key: string;
  provider: ReturnType<typeof createOllama>;
} | null = null;

function getOllamaProvider(): ReturnType<typeof createOllama> {
  const baseURL = resolveBaseUrl();
  const key = `${baseURL}\0${env.OLLAMA_API_KEY ?? ""}`;
  if (!cachedProvider || cachedProvider.key !== key) {
    cachedProvider = {
      key,
      provider: createOllama({
        baseURL,
        ...(env.OLLAMA_API_KEY ? { apiKey: env.OLLAMA_API_KEY } : {}),
      }),
    };
  }
  return cachedProvider.provider;
}

export function getOllamaLanguageModel() {
  const modelId = env.OLLAMA_MODEL ?? DEFAULT_MODEL;
  return getOllamaProvider()(modelId);
}
