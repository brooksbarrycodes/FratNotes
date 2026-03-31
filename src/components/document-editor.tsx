"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  PdfHighlighter,
  Popup,
} from "react-pdf-highlighter";
import type {
  IHighlight,
  ScaledPosition,
  Content,
  LTWHP,
  Scaled,
} from "react-pdf-highlighter";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { getStroke } from "perfect-freehand";
import { IconTrash } from "@tabler/icons-react";
import "react-pdf-highlighter/dist/style.css";

const WORKER_SRC =
  "https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

function usePdfDocument(pdfBase64: string) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    GlobalWorkerOptions.workerSrc = WORKER_SRC;

    let cancelled = false;

    const binaryString = atob(pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const task = getDocument({ data: bytes });

    task.promise
      .then((doc) => {
        if (!cancelled) setPdfDocument(doc);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPdfError(String(err));
      });

    return () => {
      cancelled = true;
      task.destroy().catch(() => {});
    };
  }, [pdfBase64]);

  return { pdfDocument, pdfError };
}

const PDF_VIEWBOX = 1000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return "";

  const d = stroke.reduce((acc, [x, y], index, array) => {
    const currentX = x ?? 0;
    const currentY = y ?? 0;

    if (index === 0) return `M ${currentX} ${currentY}`;

    const previousPoint = array[index - 1];
    const prevX = previousPoint?.[0] ?? currentX;
    const prevY = previousPoint?.[1] ?? currentY;
    const midpointX = (prevX + currentX) / 2;
    const midpointY = (prevY + currentY) / 2;

    return `${acc} Q ${prevX} ${prevY}, ${midpointX} ${midpointY}`;
  }, "");

  return `${d} Z`;
}

function getStrokePath(points: StrokePoint[]) {
  if (points.length < 2) return "";

  const strokePoints = getStroke(
    points.map((point) => [
      point.x * PDF_VIEWBOX,
      point.y * PDF_VIEWBOX,
      point.pressure ?? 0.5,
    ]),
    {
      size: 6,
      thinning: 0.55,
      smoothing: 0.6,
      streamline: 0.45,
    },
  );

  return getSvgPathFromStroke(strokePoints);
}

export type ToolMode = "highlight" | "underline" | "note" | "draw" | "erase";

export interface AnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayPoint {
  x: number;
  y: number;
}

export interface Annotation {
  id?: string;
  type: "highlight" | "underline" | "margin-note";
  color: string;
  targetText?: string;
  note?: string;
  pageIndex?: number;
  rects?: AnnotationRect[];
  notePosition?: OverlayPoint;
  scaledPosition?: ScaledPosition;
  content?: Content;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface Stroke {
  id: string;
  pageIndex: number;
  points: StrokePoint[];
  color: string;
}

interface DocumentEditorProps {
  pdfBase64: string;
  annotations: Annotation[];
  strokes: Stroke[];
  activeTool: ToolMode;
  activeColor: string;
  onAnnotationsChange: (annotations: Annotation[]) => void;
  onStrokesChange: (strokes: Stroke[]) => void;
}

function annotationToHighlight(ann: Annotation): IHighlight | null {
  if (!ann.id || !ann.scaledPosition) return null;
  return {
    id: ann.id,
    position: ann.scaledPosition,
    content: ann.content ?? { text: ann.targetText ?? "" },
    comment: { text: "", emoji: "" },
  };
}

function UnderlineRects({
  rects,
  color,
  onClick,
}: {
  rects: LTWHP[];
  color: string;
  onClick?: () => void;
}) {
  return (
    <div style={{ position: "absolute" }}>
      {rects.map((rect, i) => (
        <div
          key={i}
          onClick={onClick}
          style={{
            position: "absolute",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            borderBottom: `3px solid ${color}`,
            cursor: onClick ? "pointer" : "default",
            mixBlendMode: "multiply",
          }}
        />
      ))}
    </div>
  );
}

/** Drop rects outside the user's vertical drag band (mitigates PDF.js / native Range expansion in line gaps and margins). */
function filterScaledRectsByDragBand(
  position: ScaledPosition,
  pageEl: HTMLElement,
  minPageY: number,
  maxPageY: number,
): ScaledPosition | null {
  const rects = position.rects;
  if (rects.length === 0) return null;

  const pr = pageEl.getBoundingClientRect();
  const bandMin = Math.min(minPageY, maxPageY);
  const bandMax = Math.max(minPageY, maxPageY);

  const avgH =
    rects.reduce((s, r) => s + (r.y2 - r.y1), 0) / rects.length;
  const marginY = Math.max(avgH * 1.5, 3);

  const filtered = rects.filter((rect) => {
    const topPx = (pr.height * rect.y1) / rect.height;
    const botPx = (pr.height * rect.y2) / rect.height;
    const midY = (topPx + botPx) / 2;
    return midY >= bandMin - marginY && midY <= bandMax + marginY;
  });

  if (filtered.length === 0) return null;

  const bx1 = Math.min(...filtered.map((r) => r.x1));
  const by1 = Math.min(...filtered.map((r) => r.y1));
  const bx2 = Math.max(...filtered.map((r) => r.x2));
  const by2 = Math.max(...filtered.map((r) => r.y2));

  const br: Scaled = {
    ...position.boundingRect,
    x1: bx1,
    y1: by1,
    x2: bx2,
    y2: by2,
  };

  return {
    ...position,
    rects: filtered,
    boundingRect: br,
  };
}

function HighlightRects({
  rects,
  color,
  onClick,
}: {
  rects: LTWHP[];
  color: string;
  onClick?: () => void;
}) {
  return (
    <div style={{ position: "absolute", opacity: 1 }}>
      {rects.map((rect, i) => (
        <div
          key={i}
          onClick={onClick}
          style={{
            position: "absolute",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            backgroundColor: `${color}55`,
            cursor: onClick ? "pointer" : "default",
            mixBlendMode: "multiply",
          }}
        />
      ))}
    </div>
  );
}

export function DocumentEditor({
  pdfBase64,
  annotations,
  strokes,
  activeTool,
  activeColor,
  onAnnotationsChange,
  onStrokesChange,
}: DocumentEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [currentStroke, setCurrentStroke] = useState<{
    pageIndex: number;
    points: StrokePoint[];
  } | null>(null);
  const [draggingNote, setDraggingNote] = useState<{
    id: string;
    pageIndex: number;
    startX: number;
    startY: number;
    origPosition: OverlayPoint;
  } | null>(null);
  const [pageElements, setPageElements] = useState<HTMLElement[]>([]);
  const scrollViewerTo = useRef<(highlight: IHighlight) => void>(() => {});
  /** Page-local pointer path for highlight/underline — used to clip native selection rects. */
  const dragStartRef = useRef<{ pageIndex: number; pageY: number } | null>(
    null,
  );
  const dragEndRef = useRef<{ pageIndex: number; pageY: number } | null>(
    null,
  );

  const { pdfDocument, pdfError } = usePdfDocument(pdfBase64);

  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const activeColorRef = useRef(activeColor);
  activeColorRef.current = activeColor;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const highlights: IHighlight[] = useMemo(() => {
    return annotations
      .map(annotationToHighlight)
      .filter((h): h is IHighlight => h !== null);
  }, [annotations]);

  const commitAnnotations = useCallback(
    (nextAnnotations: Annotation[]) => {
      onAnnotationsChange(
        nextAnnotations.map((ann) => ({
          ...ann,
          id: ann.id ?? createId(),
        })),
      );
    },
    [onAnnotationsChange],
  );

  const removeAnnotation = useCallback(
    (annotationId: string) => {
      commitAnnotations(
        annotationsRef.current.filter((ann) => ann.id !== annotationId),
      );
    },
    [commitAnnotations],
  );

  const removeStroke = useCallback(
    (strokeId: string) => {
      onStrokesChange(strokes.filter((s) => s.id !== strokeId));
    },
    [onStrokesChange, strokes],
  );

  const updateNoteText = useCallback(
    (annotationId: string, note: string) => {
      commitAnnotations(
        annotationsRef.current.map((ann) =>
          ann.id === annotationId ? { ...ann, note } : ann,
        ),
      );
    },
    [commitAnnotations],
  );

  const beginNoteDrag = useCallback(
    (event: React.PointerEvent, annotationId: string, pageIndex: number) => {
      if (activeToolRef.current === "erase") return;
      const annotation = annotationsRef.current.find(
        (a) => a.id === annotationId,
      );
      if (!annotation?.notePosition) return;

      event.preventDefault();
      event.stopPropagation();
      (event.target as Element).setPointerCapture(event.pointerId);

      setDraggingNote({
        id: annotationId,
        pageIndex,
        startX: event.clientX,
        startY: event.clientY,
        origPosition: { ...annotation.notePosition },
      });
    },
    [],
  );

  const moveNoteDrag = useCallback(
    (event: React.PointerEvent) => {
      if (!draggingNote) return;
      const pageEl = pageElements[draggingNote.pageIndex];
      if (!pageEl) return;

      const rect = pageEl.getBoundingClientRect();
      const dx = (event.clientX - draggingNote.startX) / rect.width;
      const dy = (event.clientY - draggingNote.startY) / rect.height;

      const newX = clamp(draggingNote.origPosition.x + dx, 0.02, 0.78);
      const newY = clamp(draggingNote.origPosition.y + dy, 0.02, 0.94);

      commitAnnotations(
        annotationsRef.current.map((a) =>
          a.id === draggingNote.id
            ? { ...a, notePosition: { x: newX, y: newY } }
            : a,
        ),
      );
    },
    [draggingNote, pageElements, commitAnnotations],
  );

  const endNoteDrag = useCallback(() => {
    setDraggingNote(null);
  }, []);

  const beginStroke = useCallback(
    (event: React.PointerEvent<SVGSVGElement>, pageIndex: number) => {
      if (activeToolRef.current !== "draw") return;

      const pageEl = pageElements[pageIndex];
      if (!pageEl) return;

      event.preventDefault();
      (event.target as Element).setPointerCapture(event.pointerId);
      const rect = pageEl.getBoundingClientRect();

      setCurrentStroke({
        pageIndex,
        points: [
          {
            x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
            y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
            pressure: event.pressure,
          },
        ],
      });
    },
    [pageElements],
  );

  const updateStroke = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      setCurrentStroke((current) => {
        if (!current) return current;

        const pageEl = pageElements[current.pageIndex];
        if (!pageEl) return current;

        event.preventDefault();
        const rect = pageEl.getBoundingClientRect();

        return {
          ...current,
          points: [
            ...current.points,
            {
              x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
              y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
              pressure: event.pressure,
            },
          ],
        };
      });
    },
    [pageElements],
  );

  const endStroke = useCallback(() => {
    if (!currentStroke || currentStroke.points.length < 2) {
      setCurrentStroke(null);
      return;
    }

    onStrokesChange([
      ...strokes,
      {
        id: createId(),
        pageIndex: currentStroke.pageIndex,
        points: currentStroke.points,
        color: activeColorRef.current,
      },
    ]);
    setCurrentStroke(null);
  }, [currentStroke, onStrokesChange, strokes]);

  const [overlayContainers, setOverlayContainers] = useState<HTMLDivElement[]>(
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scanPages = () => {
      const pages = container.querySelectorAll<HTMLElement>(".page");
      if (pages.length > 0) {
        const newPages = Array.from(pages);
        setPageElements((prev) => {
          if (
            prev.length === newPages.length &&
            prev.every((el, i) => el === newPages[i])
          ) {
            return prev;
          }
          return newPages;
        });
      }
    };

    scanPages();

    const observer = new MutationObserver(scanPages);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const containers = pageElements.map((pageEl) => {
      const existing =
        pageEl.querySelector<HTMLDivElement>(":scope > .fn-overlay");
      if (existing) return existing;
      const div = document.createElement("div");
      div.className = "fn-overlay";
      div.style.cssText =
        "position:absolute;inset:0;pointer-events:none;z-index:3;";
      pageEl.appendChild(div);
      return div;
    });
    setOverlayContainers(containers);
    return () => {
      containers.forEach((c) => {
        try {
          c.parentNode?.removeChild(c);
        } catch {
          // Element may already be removed by PdfHighlighter
        }
      });
    };
  }, [pageElements]);

  const handleNotePlacement = useCallback(
    (event: React.MouseEvent, pageIndex: number) => {
      if (activeToolRef.current !== "note") return;

      const pageEl = pageElements[pageIndex];
      if (!pageEl) return;

      const rect = pageEl.getBoundingClientRect();
      const noteId = createId();
      const notePosition = {
        x: clamp((event.clientX - rect.left) / rect.width, 0.05, 0.75),
        y: clamp((event.clientY - rect.top) / rect.height, 0.04, 0.9),
      };

      commitAnnotations([
        ...annotationsRef.current,
        {
          id: noteId,
          type: "margin-note",
          color: activeColorRef.current,
          pageIndex,
          rects: [],
          notePosition,
          note: "",
        },
      ]);

      setEditingNoteId(noteId);
    },
    [pageElements, commitAnnotations],
  );

  const resolvedNotes = useMemo(
    () =>
      annotations.filter(
        (a) =>
          a.type === "margin-note" &&
          a.notePosition &&
          typeof a.pageIndex === "number",
      ),
    [annotations],
  );

  const resolvedNonScaledAnnotations = useMemo(
    () =>
      annotations.filter(
        (a) =>
          !a.scaledPosition &&
          a.rects &&
          a.rects.length > 0 &&
          typeof a.pageIndex === "number" &&
          (a.type === "highlight" || a.type === "underline"),
      ),
    [annotations],
  );

  return (
    <div
      ref={containerRef}
      className="rounded-[2rem] border border-sky/15 bg-white/55 p-4 shadow-[0_24px_60px_rgba(26,26,46,0.08)] backdrop-blur-sm"
    >
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-sky/10 bg-paper/90 px-4 py-3">
        <div>
          <p className="font-display text-base font-semibold text-dark">
            Printed-paper mode
          </p>
          <p className="font-body text-xs text-dark/45">
            The original PDF stays intact while notes sit on top like real
            markup.
          </p>
        </div>
        <div className="rounded-full bg-sky/10 px-3 py-1 font-body text-xs font-medium text-sky-dark">
          {pageElements.length > 0
            ? `${pageElements.length} page${pageElements.length === 1 ? "" : "s"}`
            : "Loading PDF"}
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-[28px] border border-sky/10 bg-paper shadow-[0_28px_45px_rgba(26,26,46,0.08)]"
        style={{ height: "calc(100vh - 220px)" }}
      >
        {pdfError ? (
          <div className="flex h-full items-center justify-center px-8 py-16 text-center">
            <div>
              <p className="font-display text-lg text-red-500">
                Failed to load PDF
              </p>
              <p className="mt-2 max-w-md font-body text-sm text-dark/50">
                {pdfError}
              </p>
            </div>
          </div>
        ) : !pdfDocument ? (
          <div className="flex h-full items-center justify-center px-8 py-16 text-center">
            <div>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky border-t-transparent" />
              <p className="mt-4 font-display text-lg text-dark">
                Loading your PDF...
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{ position: "absolute", inset: 0 }}
            onPointerDown={(e) => {
              if (
                activeToolRef.current !== "highlight" &&
                activeToolRef.current !== "underline"
              ) {
                return;
              }
              for (let i = 0; i < pageElements.length; i++) {
                const r = pageElements[i]!.getBoundingClientRect();
                if (e.clientY >= r.top && e.clientY <= r.bottom) {
                  dragStartRef.current = {
                    pageIndex: i,
                    pageY: e.clientY - r.top,
                  };
                  break;
                }
              }
            }}
            onPointerUp={(e) => {
              if (
                activeToolRef.current !== "highlight" &&
                activeToolRef.current !== "underline"
              ) {
                return;
              }
              for (let i = 0; i < pageElements.length; i++) {
                const r = pageElements[i]!.getBoundingClientRect();
                if (e.clientY >= r.top && e.clientY <= r.bottom) {
                  dragEndRef.current = {
                    pageIndex: i,
                    pageY: e.clientY - r.top,
                  };
                  break;
                }
              }
            }}
          >
            <PdfHighlighter
            pdfDocument={pdfDocument}
            enableAreaSelection={() => false}
            onScrollChange={() => {}}
            scrollRef={(scrollTo) => {
              scrollViewerTo.current = scrollTo;
            }}
            onSelectionFinished={(
              position,
              content,
              hideTipAndSelection,
            ) => {
              const tool = activeToolRef.current;
              if (tool !== "highlight" && tool !== "underline") {
                dragStartRef.current = null;
                dragEndRef.current = null;
                hideTipAndSelection();
                return null;
              }

              const start = dragStartRef.current;
              const end = dragEndRef.current;
              const pageIdx = (position.pageNumber || 1) - 1;

              let scaledPosition: ScaledPosition = position;

              if (
                start &&
                end &&
                start.pageIndex === end.pageIndex &&
                start.pageIndex === pageIdx &&
                position.rects.length > 0
              ) {
                const pageEl = pageElements[pageIdx];
                if (pageEl) {
                  const clipped = filterScaledRectsByDragBand(
                    position,
                    pageEl,
                    start.pageY,
                    end.pageY,
                  );
                  if (clipped) {
                    scaledPosition = clipped;
                  } else {
                    dragStartRef.current = null;
                    dragEndRef.current = null;
                    hideTipAndSelection();
                    return null;
                  }
                }
              }

              dragStartRef.current = null;
              dragEndRef.current = null;

              const newAnnotation: Annotation = {
                id: createId(),
                type: tool,
                color: activeColorRef.current,
                targetText: content.text ?? "",
                scaledPosition,
                content,
              };

              commitAnnotations([
                ...annotationsRef.current,
                newAnnotation,
              ]);
              hideTipAndSelection();
              return null;
            }}
            highlightTransform={(
              highlight,
              index,
              setTip,
              hideTip,
              viewportToScaled,
              screenshot,
              isScrolledTo,
            ) => {
              const ann = annotations.find(
                (a) => a.id === highlight.id,
              );
              const isUnderline = ann?.type === "underline";
              const color = ann?.color ?? activeColor;
              const isErase = activeTool === "erase";

              const component = isUnderline ? (
                <UnderlineRects
                  rects={highlight.position.rects}
                  color={color}
                  onClick={
                    isErase
                      ? () => removeAnnotation(highlight.id)
                      : undefined
                  }
                />
              ) : (
                <HighlightRects
                  rects={highlight.position.rects}
                  color={color}
                  onClick={
                    isErase
                      ? () => removeAnnotation(highlight.id)
                      : undefined
                  }
                />
              );

              return (
                <Popup
                  popupContent={<span />}
                  onMouseOver={() => {}}
                  onMouseOut={hideTip}
                  key={index}
                >
                  {component}
                </Popup>
              );
            }}
            highlights={highlights}
          />
          </div>
        )}

        {/* Drawing overlays and note overlays via portals */}
        {overlayContainers.map((containerEl, pageIndex) => {
          const pageStrokes = strokes.filter(
            (s) => s.pageIndex === pageIndex,
          );
          const activeStroke =
            currentStroke?.pageIndex === pageIndex
              ? currentStroke.points
              : null;
          const pageNotes = resolvedNotes.filter(
            (a) => a.pageIndex === pageIndex,
          );
          const pageNonScaled = resolvedNonScaledAnnotations.filter(
            (a) => a.pageIndex === pageIndex,
          );

          return createPortal(
            <>
              {/* Non-scaled annotation rects (AI-resolved) */}
              {pageNonScaled.map((ann) => (
                <div
                  key={ann.id}
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 4,
                  }}
                >
                  {(ann.rects ?? []).map((rect, ri) => (
                    <button
                      key={`${ann.id}-${ri}`}
                      type="button"
                      onClick={() => {
                        if (activeTool === "erase" && ann.id) {
                          removeAnnotation(ann.id);
                        }
                      }}
                      style={{
                        position: "absolute",
                        left: `${rect.x * 100}%`,
                        top: `${rect.y * 100}%`,
                        width: `${rect.width * 100}%`,
                        height: `${rect.height * 100}%`,
                        backgroundColor:
                          ann.type === "highlight"
                            ? `${ann.color}55`
                            : "transparent",
                        borderBottom:
                          ann.type === "underline"
                            ? `3px solid ${ann.color}`
                            : "none",
                        border: "none",
                        padding: 0,
                        cursor:
                          activeTool === "erase" ? "pointer" : "default",
                        pointerEvents:
                          activeTool === "erase" ? "auto" : "none",
                      }}
                    />
                  ))}
                </div>
              ))}

              {/* Margin notes */}
              {pageNotes.map((ann) => (
                <div
                  key={ann.id}
                  className="group/note absolute z-[20] w-[24%] min-w-[140px] max-w-[220px] rounded-2xl border border-flame/15 bg-[#fff9e9]/92 p-3 shadow-[0_16px_30px_rgba(255,152,0,0.12)] backdrop-blur-sm"
                  style={{
                    left: `${(ann.notePosition?.x ?? 0.5) * 100}%`,
                    top: `${(ann.notePosition?.y ?? 0.1) * 100}%`,
                    pointerEvents: "auto",
                    boxShadow:
                      activeTool === "erase"
                        ? "0 0 0 2px rgba(255, 152, 0, 0.18)"
                        : undefined,
                  }}
                  onPointerMove={moveNoteDrag}
                  onPointerUp={endNoteDrag}
                  onPointerLeave={endNoteDrag}
                >
                  <div
                    className="mb-2 flex cursor-grab items-start justify-between gap-2 active:cursor-grabbing"
                    onPointerDown={(e) =>
                      beginNoteDrag(e, ann.id!, pageIndex)
                    }
                  >
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: ann.color }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (ann.id) removeAnnotation(ann.id);
                      }}
                      className={`rounded-md p-1 text-dark/30 transition-all hover:bg-white/70 hover:text-red-500 ${
                        activeTool === "erase" ||
                        editingNoteId === ann.id
                          ? "opacity-100"
                          : "opacity-0 group-hover/note:opacity-100"
                      }`}
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {editingNoteId === ann.id ? (
                    <textarea
                      autoFocus
                      value={ann.note ?? ""}
                      onChange={(e) =>
                        updateNoteText(ann.id!, e.target.value)
                      }
                      onBlur={() => setEditingNoteId(null)}
                      placeholder="Write a quick study note..."
                      className="min-h-[96px] w-full resize-none bg-transparent font-hand text-xl leading-snug text-dark/85 outline-none placeholder:text-dark/25"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTool === "erase") {
                          if (ann.id) removeAnnotation(ann.id);
                          return;
                        }
                        setEditingNoteId(ann.id ?? null);
                      }}
                      className="w-full text-left"
                    >
                      <p className="font-hand text-xl leading-snug text-dark/85">
                        {ann.note?.trim() || "Tap to write a margin note"}
                      </p>
                    </button>
                  )}
                </div>
              ))}

              {/* Note placement overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 30,
                  pointerEvents:
                    activeTool === "note" ? "auto" : "none",
                  cursor: activeTool === "note" ? "crosshair" : "default",
                }}
                onClick={(e) => handleNotePlacement(e, pageIndex)}
              />

              {/* SVG drawing overlay */}
              <svg
                viewBox={`0 0 ${PDF_VIEWBOX} ${PDF_VIEWBOX}`}
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  zIndex: 40,
                  pointerEvents:
                    activeTool === "draw" ? "auto" : "none",
                  touchAction: "none",
                }}
                onPointerDown={(e) => beginStroke(e, pageIndex)}
                onPointerMove={updateStroke}
                onPointerUp={endStroke}
                onPointerLeave={endStroke}
              >
                {pageStrokes.map((stroke) => (
                  <path
                    key={stroke.id}
                    d={getStrokePath(stroke.points)}
                    fill={stroke.color}
                    opacity={0.88}
                    style={{
                      pointerEvents:
                        activeTool === "erase" ? "auto" : "none",
                      cursor:
                        activeTool === "erase" ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (activeTool === "erase") {
                        removeStroke(stroke.id);
                      }
                    }}
                  />
                ))}

                {activeStroke && (
                  <path
                    d={getStrokePath(activeStroke)}
                    fill={activeColor}
                    opacity={0.82}
                  />
                )}
              </svg>
            </>,
            containerEl,
          );
        })}
      </div>
    </div>
  );
}
