import { type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { getEffectiveUserId } from "~/server/lib/effective-user";
import { getOpenPaperBearerToken } from "~/server/openpaper/auth";
import { isOpenPaperServerEnabled } from "~/server/openpaper/config";
import { openPaperFetch } from "~/server/openpaper/fetch";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isOpenPaperServerEnabled()) {
    return new Response(
      JSON.stringify({ error: "Open Paper integration disabled" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const session = await auth();
  const userId = await getEffectiveUserId(session);

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return new Response(
      JSON.stringify({ error: "Query must be at least 2 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const bearer = await getOpenPaperBearerToken(userId);
  if (!bearer) {
    return new Response(
      JSON.stringify({ error: "Open Paper session token required" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const limit = req.nextUrl.searchParams.get("limit") ?? "50";
  const offset = req.nextUrl.searchParams.get("offset") ?? "0";

  const path = `/api/search/local/?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;

  const upstream = await openPaperFetch(path, bearer, { method: "GET" });

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}
