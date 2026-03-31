import { type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { getEffectiveUserId } from "~/server/lib/effective-user";
import { isOpenPaperServerEnabled } from "~/server/openpaper/config";
import { openPaperFetch } from "~/server/openpaper/fetch";
import { ensureOpenPaperConversationForDocument } from "~/server/openpaper/conversation";
import { openPaperVoicePrefix } from "~/lib/chat-voice";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!isOpenPaperServerEnabled()) {
    return new Response(JSON.stringify({ error: "Open Paper integration disabled" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await auth();
  const userId = await getEffectiveUserId(session);

  const body = (await req.json()) as {
    documentId: string;
    userQuery: string;
    userReferences?: string[];
    chatVoice?: string;
  };

  if (!body.documentId?.trim() || !body.userQuery?.trim()) {
    return new Response(JSON.stringify({ error: "documentId and userQuery required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ctx = await ensureOpenPaperConversationForDocument(body.documentId, userId);
  if (!ctx) {
    return new Response(
      JSON.stringify({
        error:
          "Open Paper paper not linked yet. Configure session token and wait for sync, or use local chat.",
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );
  }

  const queryWithVoice =
    openPaperVoicePrefix(body.chatVoice ?? "frat_bro") + body.userQuery;

  const upstream = await openPaperFetch("/api/message/chat/paper", ctx.bearer, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      paper_id: ctx.paperId,
      conversation_id: ctx.conversationId,
      user_query: queryWithVoice,
      user_references: body.userReferences,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return new Response(text || upstream.statusText, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
