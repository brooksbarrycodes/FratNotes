import { type NextRequest } from "next/server";
import { streamText, type ModelMessage } from "ai";
import { ollama } from "ai-sdk-ollama";
import { CHAT_SYSTEM_PROMPT } from "~/lib/ai-prompts";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    messages: ModelMessage[];
    documentText: string;
  };

  const result = streamText({
    model: ollama("llama3.1:8b"),
    system: CHAT_SYSTEM_PROMPT(body.documentText),
    messages: body.messages,
  });

  return result.toUIMessageStreamResponse();
}
