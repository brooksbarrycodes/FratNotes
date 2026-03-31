import { db } from "~/server/db";
import { getOpenPaperBearerToken } from "./auth";
import { isOpenPaperServerEnabled } from "./config";
import { openPaperFetch, openPaperJson } from "./fetch";

const ENDPOINT_UPLOAD = "/api/paper/upload/";
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90;

type UploadStartResponse = { job_id?: string; message?: string };

type UploadStatusResponse = {
  job_id: string;
  status: string;
  paper_id: string | null;
};

type PaperPayload = {
  id?: string;
  summary?: string | null;
  abstract?: string | null;
  starter_questions?: string[] | null;
};

type ConversationCreateResponse = {
  id: string;
  title?: string | null;
  messages?: unknown[];
};

/**
 * Fire-and-forget: upload PDF to Open Paper, poll until paper exists, create conversation, cache brief/questions.
 */
export async function startOpenPaperDocumentSync(input: {
  documentId: string;
  userId: string;
  pdfBuffer: Buffer;
  filename: string;
}): Promise<void> {
  if (!isOpenPaperServerEnabled()) return;

  const bearer = await getOpenPaperBearerToken(input.userId);
  if (!bearer) {
    console.warn(
      "[Open Paper] sync skipped: set User.openPaperSessionToken or OPENPAPER_DEFAULT_BEARER_TOKEN",
    );
    return;
  }

  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(input.pdfBuffer)], {
      type: "application/pdf",
    });
    form.append("file", blob, input.filename);

    const startRes = await openPaperFetch(ENDPOINT_UPLOAD, bearer, {
      method: "POST",
      body: form,
    });

    if (!startRes.ok) {
      const err = await startRes.text();
      console.error("[Open Paper] upload failed:", startRes.status, err.slice(0, 400));
      return;
    }

    const startJson = (await startRes.json()) as UploadStartResponse;
    const jobId = startJson.job_id;
    if (!jobId) {
      console.error("[Open Paper] no job_id in upload response");
      return;
    }

    await db.document.update({
      where: { id: input.documentId },
      data: { openPaperUploadJobId: jobId },
    });

    let paperId: string | null = null;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const status = await openPaperJson<UploadStatusResponse>(
        `/api/paper/upload/status/${jobId}`,
        bearer,
      );
      if (status.paper_id) {
        paperId = status.paper_id;
        break;
      }
      if (status.status?.toLowerCase() === "failed") {
        console.error("[Open Paper] upload job failed");
        return;
      }
    }

    if (!paperId) {
      console.warn("[Open Paper] timed out waiting for paper_id (jobs/S3 may be offline)");
      return;
    }

    await db.document.update({
      where: { id: input.documentId },
      data: { openPaperPaperId: paperId },
    });

    let brief = "";
    let starterJson = "[]";
    try {
      const paper = await openPaperJson<PaperPayload>(
        `/api/paper?id=${encodeURIComponent(paperId)}`,
        bearer,
      );
      brief =
        (paper.summary && paper.summary.trim()) ||
        (paper.abstract && paper.abstract.trim()) ||
        "";
      starterJson = JSON.stringify(paper.starter_questions ?? []);
    } catch (e) {
      console.warn("[Open Paper] could not fetch paper metadata:", e);
    }

    let conversationId: string | null = null;
    try {
      const conv = await openPaperJson<ConversationCreateResponse>(
        `/api/conversation/paper/${encodeURIComponent(paperId)}`,
        bearer,
        { method: "POST" },
      );
      conversationId = conv.id;
    } catch (e) {
      console.warn("[Open Paper] could not create conversation:", e);
    }

    await db.document.update({
      where: { id: input.documentId },
      data: {
        paperBrief: brief,
        starterQuestionsJson: starterJson,
        ...(conversationId ? { openPaperConversationId: conversationId } : {}),
      },
    });
  } catch (e) {
    console.error("[Open Paper] sync error:", e);
  }
}
