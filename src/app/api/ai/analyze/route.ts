import { type NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";

import { env } from "~/env";
import {
  aiStudyPassResponseSchema,
  type AnnotationsPayload,
} from "~/lib/annotations-schema";
import { STUDY_PASS_SYSTEM_PROMPT } from "~/lib/ai-study-pass-prompt";
import {
  getAiNotConfiguredMessage,
  getAppLanguageModel,
  isAiConfigured,
  mapOpenAiAnalyzeError,
  resolveAiProvider,
} from "~/lib/app-language-model";
import {
  MAX_STUDY_PASS_CHARS,
  normalizeAiStudyPassPayload,
} from "~/lib/study-pass-normalize";
import {
  getOllamaBaseUrlForDisplay,
  isLikelyOllamaTransportFailure,
} from "~/lib/ollama-model";

export const runtime = "nodejs";
export const maxDuration = 120;

function collectErrorStrings(error: unknown, out: string[] = []): string[] {
  if (error instanceof Error) {
    out.push(error.message);
    if (error.cause !== undefined) collectErrorStrings(error.cause, out);
  } else if (error != null) {
    out.push(String(error));
  }
  return out;
}

function extractJsonValue(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  const inner = fenced ? fenced[1]!.trim() : trimmed;
  const objStart = inner.indexOf("{");
  const objEnd = inner.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    return JSON.parse(inner.slice(objStart, objEnd + 1)) as unknown;
  }
  return JSON.parse(inner) as unknown;
}

function buildStudyPassUserPrompt(source: string, truncated: boolean): string {
  const tail = truncated
    ? "\n\nNote: The source was truncated to the beginning due to length; prioritize the visible portion."
    : "";
  return `Source document text:\n---\n${source}\n---\nProduce the JSON object now.${tail}`;
}

function finalizePayload(data: AnnotationsPayload): AnnotationsPayload {
  return {
    ...data,
    meta: {
      ...data.meta,
      aiPassAt: new Date().toISOString(),
    },
  };
}

function tryValidateAfterNormalize(parsed: unknown): {
  ok: true;
  data: AnnotationsPayload;
} | {
  ok: false;
  normalized: unknown;
  error: import("zod").ZodError;
} {
  const normalized = normalizeAiStudyPassPayload(parsed);
  const validated = aiStudyPassResponseSchema.safeParse(normalized);
  if (validated.success) {
    return { ok: true, data: validated.data };
  }
  return { ok: false, normalized, error: validated.error };
}

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: getAiNotConfiguredMessage() }, { status: 503 });
  }

  try {
    const body = (await req.json()) as { text?: string };
    const text = body.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Missing or empty text" },
        { status: 400 },
      );
    }

    const truncated = text.length > MAX_STUDY_PASS_CHARS;
    const source = truncated ? text.slice(0, MAX_STUDY_PASS_CHARS) : text;
    const userPrompt = buildStudyPassUserPrompt(source, truncated);

    const model = getAppLanguageModel();
    const provider = resolveAiProvider();

    let parsed: unknown | undefined;

    if (provider === "openai") {
      try {
        const structured = await generateText({
          model,
          system: STUDY_PASS_SYSTEM_PROMPT,
          prompt: userPrompt,
          output: Output.object({
            schema: aiStudyPassResponseSchema,
            name: "FratNotesStudyPass",
            description: "PDF study annotations v2 with legend and items",
          }),
        });
        if (structured.output) {
          parsed = structured.output as unknown;
        }
      } catch {
        // OpenRouter / some models may not support structured output; fall back.
      }
    }

    if (parsed === undefined) {
      const { text: raw } = await generateText({
        model,
        system: STUDY_PASS_SYSTEM_PROMPT,
        prompt: userPrompt,
      });

      try {
        parsed = extractJsonValue(raw);
      } catch {
        return NextResponse.json(
          { error: "Model returned non-JSON output", raw: raw.slice(0, 500) },
          { status: 422 },
        );
      }
    }

    let attempt = tryValidateAfterNormalize(parsed);
    if (!attempt.ok) {
      const firstError = attempt.error;
      const repair = await generateText({
        model,
        system: `You return ONLY valid JSON (no markdown fences) that matches FratNotes study-pass v2: version 2, legend array with id, label, #RRGGBB color, appliesTo; items with type highlight|underline|margin-note, targetText, color, categoryId for highlight/underline matching legend ids.`,
        prompt: `Fix the JSON below. Schema issues:\n${JSON.stringify(firstError.flatten().fieldErrors, null, 2).slice(0, 3500)}\n\nJSON:\n${JSON.stringify(attempt.normalized).slice(0, 14000)}`,
      });
      try {
        parsed = extractJsonValue(repair.text);
        attempt = tryValidateAfterNormalize(parsed);
      } catch {
        return NextResponse.json(
          {
            error: "Invalid study-pass schema",
            details: firstError.flatten(),
            hint: "Repair pass returned non-JSON",
          },
          { status: 422 },
        );
      }
    }

    if (!attempt.ok) {
      const dev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          error: "Invalid study-pass schema",
          details: attempt.error.flatten(),
          ...(dev
            ? {
                firstIssues: attempt.error.issues.slice(0, 8).map((i) => ({
                  path: i.path.join("."),
                  message: i.message,
                })),
              }
            : {}),
        },
        { status: 422 },
      );
    }

    const payload = finalizePayload(attempt.data);

    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    console.error("AI analyze error:", error);

    if (resolveAiProvider() === "openai") {
      const openMsg = mapOpenAiAnalyzeError(error);
      if (openMsg) {
        return NextResponse.json({ error: openMsg }, { status: 503 });
      }
    } else if (isLikelyOllamaTransportFailure(error)) {
      const base = getOllamaBaseUrlForDisplay();
      const modelName = env.OLLAMA_MODEL ?? "llama3.1:8b";
      const fromEnv = Boolean(env.OLLAMA_BASE_URL);
      const prod = `AI service unreachable at ${base}. Confirm OLLAMA_BASE_URL and that the host runs Ollama (on that machine: ollama pull ${modelName}).`;
      const dev = fromEnv
        ? `Could not reach Ollama at ${base}. Your .env sets OLLAMA_BASE_URL — use a real reachable URL, or remove it to use local http://127.0.0.1:11434. Then: ollama pull ${modelName}`
        : `Could not reach Ollama at ${base}. Start the Ollama app and ensure it listens on port 11434, then: ollama pull ${modelName}`;
      return NextResponse.json(
        { error: env.NODE_ENV === "production" ? prod : dev },
        { status: 503 },
      );
    }

    const dev = process.env.NODE_ENV === "development";
    const messages = collectErrorStrings(error);
    return NextResponse.json(
      {
        error: "Failed to analyze document",
        ...(dev
          ? {
              debugMessage: messages[0],
              debugDetails: messages.slice(0, 5),
            }
          : {}),
      },
      { status: 500 },
    );
  }
}
