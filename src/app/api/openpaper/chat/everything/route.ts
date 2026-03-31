import { type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { getEffectiveUserId } from "~/server/lib/effective-user";
import { getOpenPaperBearerToken } from "~/server/openpaper/auth";
import { isOpenPaperServerEnabled } from "~/server/openpaper/config";
import { openPaperFetch } from "~/server/openpaper/fetch";

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
    conversationId: string;
    userQuery: string;
    userReferences?: string[];
  };

  if (!body.conversationId?.trim() || !body.userQuery?.trim()) {
    return new Response(
      JSON.stringify({ error: "conversationId and userQuery required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const bearer = await getOpenPaperBearerToken(userId);
  if (!bearer) {
    return new Response(
      JSON.stringify({ error: "Set Open Paper session token in settings or env." }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const upstream = await openPaperFetch("/api/message/chat/everything", bearer, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      conversation_id: body.conversationId,
      user_query: body.userQuery,
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

