"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Navbar } from "~/components/navbar";
import type { Annotation, EmbedPdfRegistry } from "~/components/document-editor";
import { Chatbot } from "~/components/chatbot";
import { OpenPaperPaperBrief } from "~/components/openpaper-paper-brief";
import { EmbedPdfFloatingTools } from "~/components/embedpdf-floating-tools";
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

export default function NotesPage() {
  const params = useParams<{ id: string }>();

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pendingChatInject, setPendingChatInject] = useState<string | null>(
    null,
  );
  const [embedDocId, setEmbedDocId] = useState<string | null>(null);
  const [embedRegistry, setEmbedRegistry] = useState<EmbedPdfRegistry | null>(
    null,
  );

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

  const updateAnnotations = api.documents.updateAnnotations.useMutation();

  useEffect(() => {
    if (doc?.annotations && Array.isArray(doc.annotations)) {
      setAnnotations(doc.annotations as Annotation[]);
    }
  }, [doc]);

  useEffect(() => {
    setEmbedDocId(null);
    setEmbedRegistry(null);
  }, [doc?.id]);

  const handleNewAnnotations = useCallback(
    (newAnns: Annotation[]) => {
      const withIds = newAnns.map((annotation) => ({
        ...annotation,
        id:
          annotation.id ??
          (globalThis.crypto?.randomUUID?.() ??
            `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      }));

      setAnnotations((prev) => {
        const updated = [...prev, ...withIds];
        updateAnnotations.mutate({
          id: params.id,
          annotations: JSON.stringify(updated),
        });
        return updated;
      });
    },
    [params.id, updateAnnotations],
  );

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

        <div className="flex h-full min-h-0 w-[min(100%,360px)] shrink-0 flex-col justify-end border-l border-sky/10 pl-3 pb-6 pt-1">
          <div className="flex h-[50%] min-h-[200px] max-h-[min(50%,26rem)] w-full min-w-0 flex-col overflow-hidden">
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
            onPendingInjectConsumed={() => setPendingChatInject(null)}
          />
          </div>
        </div>
      </div>
    </div>
  );
}
