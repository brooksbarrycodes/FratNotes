import { db } from "~/server/db";
import { getOpenPaperBearerToken } from "./auth";
import { openPaperJson } from "./fetch";

export async function ensureOpenPaperConversationForDocument(
  documentId: string,
  userId: string,
): Promise<{ bearer: string; paperId: string; conversationId: string } | null> {
  const doc = await db.document.findFirst({
    where: { id: documentId, userId },
    select: {
      openPaperPaperId: true,
      openPaperConversationId: true,
    },
  });
  const bearer = await getOpenPaperBearerToken(userId);
  if (!doc?.openPaperPaperId || !bearer) return null;

  let conversationId = doc.openPaperConversationId;
  if (!conversationId) {
    const created = await openPaperJson<{ id: string }>(
      `/api/conversation/paper/${encodeURIComponent(doc.openPaperPaperId)}`,
      bearer,
      { method: "POST" },
    );
    conversationId = created.id;
    await db.document.update({
      where: { id: documentId },
      data: { openPaperConversationId: conversationId },
    });
  }

  return {
    bearer,
    paperId: doc.openPaperPaperId,
    conversationId,
  };
}
