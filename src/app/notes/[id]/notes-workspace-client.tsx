"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Navbar } from "~/components/navbar";
import type { Annotation, EmbedPdfRegistry } from "~/components/document-editor";
import { Chatbot } from "~/components/chatbot";
import { OpenPaperPaperBrief } from "~/components/openpaper-paper-brief";
import { EmbedPdfFloatingTools } from "~/components/embedpdf-floating-tools";
import {
  mergeAnnotationItemsIntoPayload,
  applyFratNotesAnnotationsToEmbedPdf,
} from "~/lib/embedpdf-apply-annotations";
import {
  normalizeDbAnnotations,
  serializeAnnotationsPayload,
  type AnnotationsPayload,
} from "~/lib/annotations-schema";
import { runNotesEmbedPipeline } from "~/lib/notes-embed-pipeline";
import { api } from "~/trpc/react";
import { IconArrowLeft } from "@tabler/icons-react";

const DocumentEditor = dynamic(
  () => import("~/components/document-editor").then((mod) => mod.DocumentEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-sky/15 bg-white/55 p-8 shadow-[0_24px_60px_rgba(26,26,46,0.08)] backdrop-blur-sm">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky border-t-transparent" />
          <p className="mt-4 font-display text-lg text-dark">Loading viewer…</p>
        </div>
      </div>
    ),
  },
);

export default function NotesWorkspaceClient() {
  const params = useParams<{ id: string }>();

  const [annotationsPayload, setAnnotationsPayload] =
    useState<AnnotationsPayload | null>(null);
  const [applyStatus, setApplyStatus] = useState<{
    failures: { targetText: string; reason: string }[];
  } | null>(null);
  const [pendingChatInject, setPendingChatInject] = useState<string | null>(
    null,
  );
  const [embedDocId, setEmbedDocId] = useState<string | null>(null);
  const [embedRegistry, setEmbedRegistry] = useState<EmbedPdfRegistry | null>(
    null,
  );
  const payloadRef = useRef<AnnotationsPayload | null>(null);
  const annotationsSnapRef = useRef<unknown>(null);
  /** One successful pipeline per `${docId}:${embedDocId}` per page load. */
  const pipelineCompletedKeyRef = useRef<string | null>(null);
  /** Prevents overlapping runs for the same key (e.g. Strict Mode remount). */
  const pipelineInFlightKeyRef = useRef<string | null>(null);

  const useOpenPaperChat =
    process.env.NEXT_PUBLIC_OPENPAPER_ENABLED === "true";

  const {
    data: doc,
    isLoading,
    isError,
    error,
  } = api.documents.getById.useQuery(
    { id: params.id },
    { enabled: !!params.id, retry: 1 },
  );

  const utils = api.useUtils();
  const updateAnnotations = api.documents.updateAnnotations.useMutation();

  const utilsRef = useRef(utils);
  const updateAnnotationsRef = useRef(updateAnnotations);
  utilsRef.current = utils;
  updateAnnotationsRef.current = updateAnnotations;

  useEffect(() => {
    pipelineCompletedKeyRef.current = null;
    pipelineInFlightKeyRef.current = null;
  }, [doc?.id]);

  useEffect(() => {
    if (doc?.annotations) {
      const n = normalizeDbAnnotations(doc.annotations);
      setAnnotationsPayload(n);
      payloadRef.current = n;
    }
  }, [doc?.id, doc?.annotations]);

  useEffect(() => {
    payloadRef.current = annotationsPayload;
  }, [annotationsPayload]);

  useEffect(() => {
    if (doc?.annotations !== undefined) {
      annotationsSnapRef.current = doc.annotations;
    }
  }, [doc?.id, doc?.annotations]);

  useEffect(() => {
    setEmbedDocId(null);
    setEmbedRegistry(null);
  }, [doc?.id]);

  const handleNewAnnotations = useCallback(
    async (newAnns: Annotation[]) => {
      const withIds = newAnns.map((annotation) => ({
        ...annotation,
        id:
          annotation.id ??
          (globalThis.crypto?.randomUUID?.() ??
            `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      }));

      const base = payloadRef.current ?? normalizeDbAnnotations([]);
      const merged = mergeAnnotationItemsIntoPayload(base, withIds);
      setAnnotationsPayload(merged);
      payloadRef.current = merged;

      await updateAnnotationsRef.current.mutateAsync({
        id: params.id,
        annotations: serializeAnnotationsPayload(merged),
      });

      if (embedRegistry && embedDocId) {
        const apply = await applyFratNotesAnnotationsToEmbedPdf({
          registry: embedRegistry,
          documentId: embedDocId,
          payload: merged,
          extractedText: doc?.extractedText ?? "",
        });
        const withEmbed: AnnotationsPayload = {
          ...merged,
          meta: {
            ...merged.meta,
            embedPdfAnnotationIds: apply.createdIds,
          },
        };
        setAnnotationsPayload(withEmbed);
        payloadRef.current = withEmbed;
        await updateAnnotationsRef.current.mutateAsync({
          id: params.id,
          annotations: serializeAnnotationsPayload(withEmbed),
        });
        await utilsRef.current.documents.getById.invalidate({ id: params.id });
        if (apply.failures.length > 0) {
          setApplyStatus({ failures: apply.failures });
        }
      }
    },
    [params.id, embedRegistry, embedDocId, doc?.extractedText],
  );

  const consumePendingChatInject = useCallback(() => {
    setPendingChatInject(null);
  }, []);

  useEffect(() => {
    if (!embedRegistry || !embedDocId || !doc) return;

    const pipelineKey = `${doc.id}:${embedDocId}`;
    if (pipelineCompletedKeyRef.current === pipelineKey) return;
    if (pipelineInFlightKeyRef.current === pipelineKey) return;
    pipelineInFlightKeyRef.current = pipelineKey;

    let cancelled = false;
    const docId = doc.id;
    const extractedText = doc.extractedText;

    void (async () => {
      const initial = normalizeDbAnnotations(
        annotationsSnapRef.current ?? doc.annotations,
      );

      const fetchStudyPass = async (text: string): Promise<AnnotationsPayload | null> => {
        const res = await fetch("/api/ai/analyze", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          payload?: AnnotationsPayload;
          error?: string;
        };
        if (cancelled) return null;
        if (!res.ok || !data.ok || !data.payload) {
          if (data.error) {
            setApplyStatus({
              failures: [{ targetText: "", reason: data.error }],
            });
          }
          return null;
        }
        await updateAnnotationsRef.current.mutateAsync({
          id: docId,
          annotations: serializeAnnotationsPayload(data.payload),
        });
        if (cancelled) return null;
        await utilsRef.current.documents.getById.invalidate({ id: docId });
        return data.payload;
      };

      try {
        const { payload, failures } = await runNotesEmbedPipeline({
          registry: embedRegistry,
          documentId: embedDocId,
          extractedText,
          initialPayload: initial,
          fetchStudyPass,
        });

        if (cancelled) return;

        setAnnotationsPayload(payload);
        payloadRef.current = payload;

        await updateAnnotationsRef.current.mutateAsync({
          id: docId,
          annotations: serializeAnnotationsPayload(payload),
        });
        if (cancelled) return;
        await utilsRef.current.documents.getById.invalidate({ id: docId });

        if (failures.length > 0) {
          setApplyStatus({ failures });
        }
      } catch (e) {
        if (!cancelled) {
          setApplyStatus({
            failures: [
              {
                targetText: "",
                reason:
                  e instanceof Error ? e.message : "Study pass pipeline failed",
              },
            ],
          });
        }
      } finally {
        if (pipelineInFlightKeyRef.current === pipelineKey) {
          pipelineInFlightKeyRef.current = null;
        }
        if (!cancelled) {
          pipelineCompletedKeyRef.current = pipelineKey;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embedRegistry, embedDocId, doc?.id, doc?.extractedText]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky border-t-transparent" />
          <p className="font-body text-sm text-dark/50">Loading document...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="rounded-2xl border border-flame/20 bg-white/70 p-8 text-center shadow-sm">
          <p className="font-display text-xl text-dark">
            We couldn&apos;t load that document.
          </p>
          <p className="mt-2 font-body text-sm text-dark/60">
            {error.message}
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky px-4 py-2 font-display text-sm font-semibold text-white"
          >
            <IconArrowLeft className="h-4 w-4" />
            Back to upload
          </Link>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="rounded-2xl border border-sky/20 bg-white/70 p-8 text-center shadow-sm">
          <p className="font-display text-xl text-dark">Document not found</p>
          <p className="mt-2 font-body text-sm text-dark/60">
            Try uploading the PDF again to generate a fresh notes workspace.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky px-4 py-2 font-display text-sm font-semibold text-white"
          >
            <IconArrowLeft className="h-4 w-4" />
            Back to upload
          </Link>
        </div>
      </div>
    );
  }

  const safeFileName = doc.title.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 120);

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-cream">
      <Navbar />

      <div className="shrink-0 border-b border-sky/10 bg-white/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center px-6 py-2">
          <h1 className="line-clamp-1 font-display text-base font-semibold text-dark">
            {doc.title}
          </h1>
        </div>
      </div>

      <EmbedPdfFloatingTools documentId={embedDocId} registry={embedRegistry} />

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 gap-3 px-4 pb-0 pt-2 pl-14 pr-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <OpenPaperPaperBrief
            brief={doc.paperBrief ?? ""}
            syncLabel={
              doc.openPaperPaperId ? "Open Paper sync" : undefined
            }
          />
          {applyStatus && applyStatus.failures.length > 0 && (
            <div className="flex shrink-0 items-start justify-between gap-2 rounded-xl border border-flame/25 bg-white/90 px-3 py-2 shadow-sm">
              <div className="min-w-0">
                <p className="font-display text-xs font-semibold text-dark">
                  Annotation placement
                </p>
                <ul className="mt-1 max-h-24 list-inside list-disc overflow-y-auto font-body text-[11px] text-dark/70">
                  {applyStatus.failures.slice(0, 8).map((f, i) => (
                    <li key={i}>
                      {f.targetText
                        ? `"${f.targetText.slice(0, 48)}${f.targetText.length > 48 ? "…" : ""}": ${f.reason}`
                        : f.reason}
                    </li>
                  ))}
                  {applyStatus.failures.length > 8 ? (
                    <li>…and {applyStatus.failures.length - 8} more</li>
                  ) : null}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setApplyStatus(null)}
                className="shrink-0 rounded-lg px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-wider text-dark/50 hover:bg-cream hover:text-dark"
              >
                Dismiss
              </button>
            </div>
          )}
          <DocumentEditor
            pdfBase64={doc.originalPdf}
            exportFileName={`${safeFileName || "document"}.pdf`}
            onEmbedReady={({ documentId, registry }) => {
              setEmbedDocId(documentId);
              setEmbedRegistry(registry);
            }}
            onQuickExplain={(text) => {
              setPendingChatInject(`Explain this: "${text}"`);
            }}
          />
        </div>

        <div className="flex h-full min-h-0 w-[min(100%,400px)] shrink-0 flex-col justify-end border-l border-sky/10 pl-3 pb-6 pt-1">
          <div className="flex h-[min(56vh,34rem)] min-h-[260px] w-full min-w-0 flex-col overflow-hidden">
            <Chatbot
              documentText={doc.extractedText}
              onNewAnnotations={handleNewAnnotations}
              documentId={doc.id}
              useOpenPaper={useOpenPaperChat}
              starterQuestions={
                Array.isArray(doc.starterQuestions)
                  ? (doc.starterQuestions as string[])
                  : []
              }
              pendingInject={pendingChatInject}
              onPendingInjectConsumed={consumePendingChatInject}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
