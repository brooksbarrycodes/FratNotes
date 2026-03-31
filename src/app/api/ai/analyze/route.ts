import { type NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { ollama } from "ai-sdk-ollama";
import { ANALYZE_SYSTEM_PROMPT } from "~/lib/ai-prompts";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text: string };

    const result = streamText({
      model: ollama("llama3.1:8b"),
      system: ANALYZE_SYSTEM_PROMPT,
      prompt: `Analyze the following text and return annotation JSON:\n\n${body.text}`,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI analyze error:", error);
    return NextResponse.json(
      { error: "Failed to analyze document" },
      { status: 500 },
    );
  }
}
