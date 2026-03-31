"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Navbar } from "~/components/navbar";
import type {
  Annotation,
  Stroke,
  ToolMode,
} from "~/components/document-editor";
import { Chatbot } from "~/components/chatbot";
import { PdfExportButton } from "~/components/pdf-export-button";
import { api } from "~/trpc/react";
import {
  IconPalette,
  IconSparkles,
  IconEraser,
  IconArrowLeft,
  IconPencil,
  IconHighlight,
  IconUnderline,
  IconNote,
  IconArrowBackUp,
} from "@tabler/icons-react";

const DRAW_COLORS = [
  { name: "Sky", value: "#87CEFA" },
  { name: "Flame", value: "#FF9800" },
  { name: "Dark", value: "#1A1A2E" },
];

const DocumentEditor = dynamic(
  () => import("~/components/document-editor").then((mod) => mod.DocumentEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[2rem] border border-sky/15 bg-white/55 p-8 text-center shadow-[0_24px_60px_rgba(26,26,46,0.08)] backdrop-blur-sm">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky border-t-transparent" />
        <p className="mt-4 font-display text-lg text-dark">
          Preparing your printed-paper workspace...
        </p>
      </div>
    ),
  },
);

export default function NotesPage() {
  const params = useParams<{ id: string }>();

  const exportRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState<ToolMode>("highlight");
  const [drawColor, setDrawColor] = useState("#87CEFA");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState("");
  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState(false);
  const [history, setHistory] = useState<
    Array<{ annotations: Annotation[]; strokes: Stroke[] }>
  >([]);

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
  const updateDrawing = api.documents.updateDrawingData.useMutation();

  useEffect(() => {
    if (doc?.annotations && Array.isArray(doc.annotations)) {
      setAnnotations(doc.annotations as Annotation[]);
    }
    if (doc?.drawingData && Array.isArray(doc.drawingData)) {
      setStrokes(doc.drawingData as typeof strokes);
    }
  }, [doc]);

  const handleAnalyze = useCallback(async () => {
    if (!doc?.extractedText) return;
    setIsAnalyzing(true);
    setAnalyzeProgress("AI is reading your document...");

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: doc.extractedText }),
      });

      if (!response.ok) throw new Error("Analysis failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setAnalyzeProgress("AI is marking up the page...");
      }

      const textMatch = fullText.match(/\[[\s\S]*\]/);
      if (textMatch) {
        const parsed = JSON.parse(textMatch[0]) as Annotation[];
        const nextAnnotations = [
          ...annotations,
          ...parsed.map((annotation) => ({
            ...annotation,
            id:
              annotation.id ??
              (globalThis.crypto?.randomUUID?.() ??
                `${Date.now()}-${Math.random().toString(16).slice(2)}`),
          })),
        ];

        setAnnotations(nextAnnotations);
        updateAnnotations.mutate({
          id: params.id,
          annotations: JSON.stringify(nextAnnotations),
        });
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setAnalyzeProgress("Analysis failed. Make sure Ollama is running.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [doc, params.id, annotations, updateAnnotations]);

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

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-49), { annotations, strokes }]);
  }, [annotations, strokes]);

  const handleAnnotationsChange = useCallback(
    (nextAnnotations: Annotation[]) => {
      pushHistory();
      setAnnotations(nextAnnotations);
      updateAnnotations.mutate({
        id: params.id,
        annotations: JSON.stringify(nextAnnotations),
      });
    },
    [params.id, updateAnnotations, pushHistory],
  );

  const handleStrokesChange = useCallback(
    (newStrokes: typeof strokes) => {
      pushHistory();
      setStrokes(newStrokes);
      updateDrawing.mutate({
        id: params.id,
        drawingData: JSON.stringify(newStrokes),
      });
    },
    [params.id, updateDrawing, pushHistory],
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1]!;
    setHistory((h) => h.slice(0, -1));
    setAnnotations(prev.annotations);
    setStrokes(prev.strokes);
    updateAnnotations.mutate({
      id: params.id,
      annotations: JSON.stringify(prev.annotations),
    });
    updateDrawing.mutate({
      id: params.id,
      drawingData: JSON.stringify(prev.strokes),
    });
  }, [history, params.id, updateAnnotations, updateDrawing]);

  const handleClearDrawing = () => {
    pushHistory();
    setStrokes([]);
    updateDrawing.mutate({ id: params.id, drawingData: "[]" });
  };

  useEffect(() => {
    if (
      doc?.extractedText &&
      (!Array.isArray(doc.annotations) || doc.annotations.length === 0) &&
      annotations.length === 0 &&
      !isAnalyzing &&
      !hasAutoAnalyzed
    ) {
      setHasAutoAnalyzed(true);
      void handleAnalyze();
    }
  }, [
    annotations.length,
    doc?.annotations,
    doc?.extractedText,
    handleAnalyze,
    hasAutoAnalyzed,
    isAnalyzing,
  ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo]);

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

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <div className="border-b border-sky/10 bg-white/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <h1 className="line-clamp-1 max-w-md font-display text-lg font-semibold text-dark">
            {doc.title}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="flex items-center gap-2 rounded-xl bg-sky px-4 py-2 font-display text-sm font-semibold text-white shadow-md transition-all hover:bg-sky-dark active:scale-95 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {analyzeProgress}
                </>
              ) : (
                <>
                  <IconSparkles className="h-4 w-4" />
                  AI Analyze
                </>
              )}
            </button>
            <PdfExportButton targetRef={exportRef} title={doc.title} />
          </div>
        </div>
      </div>

      {/* Floating toolbar */}
      <div className="fixed left-4 top-1/2 z-50 flex -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-sky/15 bg-white/90 p-1.5 shadow-[0_16px_40px_rgba(26,26,46,0.12)] backdrop-blur-md">
        {(
          [
            { id: "highlight", icon: IconHighlight, label: "Highlight" },
            { id: "underline", icon: IconUnderline, label: "Underline" },
            { id: "note", icon: IconNote, label: "Note" },
            { id: "draw", icon: IconPencil, label: "Draw" },
            { id: "erase", icon: IconEraser, label: "Erase" },
          ] as const
        ).map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id as ToolMode)}
            className={`group/btn relative rounded-xl p-2.5 transition-all ${
              activeTool === tool.id
                ? "bg-sky/15 text-sky"
                : "text-dark/40 hover:bg-cream hover:text-dark/70"
            }`}
            title={tool.label}
          >
            <tool.icon className="h-5 w-5" />
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg bg-dark/80 px-2 py-1 font-body text-[11px] font-medium text-white opacity-0 transition-opacity group-hover/btn:opacity-100">
              {tool.label}
            </span>
          </button>
        ))}

        <div className="my-1 h-px w-6 bg-sky/15" />

        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="group/btn relative rounded-xl p-2.5 text-dark/40 transition-all hover:bg-cream hover:text-dark/70 disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <IconArrowBackUp className="h-5 w-5" />
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg bg-dark/80 px-2 py-1 font-body text-[11px] font-medium text-white opacity-0 transition-opacity group-hover/btn:opacity-100">
            Undo
          </span>
        </button>

        <div className="my-1 h-px w-6 bg-sky/15" />

        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="group/btn relative rounded-xl p-2.5 text-dark/40 transition-all hover:bg-cream hover:text-dark/70"
            title="Color"
          >
            <IconPalette className="h-5 w-5" style={{ color: drawColor }} />
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg bg-dark/80 px-2 py-1 font-body text-[11px] font-medium text-white opacity-0 transition-opacity group-hover/btn:opacity-100">
              Color
            </span>
          </button>

          {showColorPicker && (
            <div className="absolute left-full top-0 z-50 ml-2 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-lg">
              {DRAW_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => {
                    setDrawColor(c.value);
                    setShowColorPicker(false);
                  }}
                  className={`h-7 w-7 rounded-full ring-offset-1 transition-all hover:scale-110 ${
                    drawColor === c.value ? "ring-2" : "ring-1 ring-dark/10"
                  }`}
                  style={{
                    backgroundColor: c.value,
                    ["--tw-ring-color" as string]:
                      drawColor === c.value ? c.value : undefined,
                  }}
                  title={c.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] gap-4 py-6 pl-16 pr-6">
        <div className="relative min-w-0 flex-1" ref={exportRef}>
          <DocumentEditor
            pdfBase64={doc.originalPdf}
            annotations={annotations}
            strokes={strokes}
            activeTool={activeTool}
            activeColor={drawColor}
            onAnnotationsChange={handleAnnotationsChange}
            onStrokesChange={handleStrokesChange}
          />
        </div>

        <div className="h-[calc(100vh-140px)] w-[380px] shrink-0 sticky top-[140px]">
          <Chatbot
            documentText={doc.extractedText}
            onNewAnnotations={handleNewAnnotations}
          />
        </div>
      </div>
    </div>
  );
}
