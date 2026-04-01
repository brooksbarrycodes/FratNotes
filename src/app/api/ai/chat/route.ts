import { type NextRequest, NextResponse } from "next/server";
import { streamText, type ModelMessage } from "ai";

import { CHAT_SYSTEM_PROMPT } from "~/lib/ai-prompts";
import { getChatVoiceInstruction } from "~/lib/chat-voice";
import {
  getAiNotConfiguredMessage,
  getAppLanguageModel,
  isAiConfigured,
} from "~/lib/app-language-model";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: getAiNotConfiguredMessage() }, { status: 503 });
  }

  const body = (await req.json()) as {
    messages: ModelMessage[];
    documentText: string;
    chatVoice?: string;
  };

  const voiceInstruction = getChatVoiceInstruction(body.chatVoice ?? "frat_bro");

  const result = streamText({
    model: getAppLanguageModel(),
    system: CHAT_SYSTEM_PROMPT(body.documentText, voiceInstruction),
    messages: body.messages,
  });

  return result.toUIMessageStreamResponse();
}
