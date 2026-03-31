"use client";

import {
  useMemo,
  useRef,
  useState,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { PDFViewer, type PDFViewerRef } from "@embedpdf/react-pdf-viewer";

export type ToolMode = "highlight" | "underline" | "note" | "draw" | "erase";

export type EmbedPdfRegistry = {
  getPlugin: (name: string) => { provides: () => unknown };
};

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

interface ScaledRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber?: number;
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
  scaledPosition?: {
    boundingRect: ScaledRect;
    rects: ScaledRect[];
    usePdfCoordinates?: boolean;
  };
  content?: { text?: string; image?: string };
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

export interface DocumentEditorProps {
  pdfBase64: string;
  exportFileName?: string;
  onQuickExplain?: (selectedText: string) => void;
  onEmbedReady?: (ctx: {
    documentId: string;
    registry: EmbedPdfRegistry;
  }) => void;
}

function shellHasSize(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
}

function waitForNonZeroShellSize(
  el: HTMLElement,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    if (shellHasSize(el)) {
      requestAnimationFrame(() => resolve());
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      obs.disconnect();
      clearTimeout(timer);
      requestAnimationFrame(() => resolve());
    };
    const obs = new ResizeObserver(() => {
      if (shellHasSize(el)) done();
    });
    obs.observe(el);
    const timer = window.setTimeout(done, timeoutMs);
  });
}

/** Fixed 150% zoom (EmbedPDF scale factor 1.5). */
function kickZoom150(registry: EmbedPdfRegistry, documentId: string) {
  const zoom = registry.getPlugin("zoom").provides() as {
    forDocument: (id: string) => {
      requestZoom: (level: unknown) => void;
    };
  };
  zoom.forDocument(documentId).requestZoom(1.5);
}

function waitForEmbedViewportClientSize(
  reg: EmbedPdfRegistry,
  documentId: string,
  timeoutMs: number,
): Promise<void> {
  const viewport = reg.getPlugin("viewport").provides() as {
    forDocument: (id: string) => {
      getMetrics: () => { clientWidth: number; clientHeight: number };
    };
  };
  return new Promise((resolve) => {
    const start = Date.now();
    const tryOnce = () => {
      try {
        const m = viewport.forDocument(documentId).getMetrics();
        if (m.clientWidth > 1 && m.clientHeight > 1) {
          resolve();
          return;
        }
      } catch {
        /* viewport not registered yet */
      }
      if (Date.now() - start >= timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tryOnce);
    };
    tryOnce();
  });
}

function forceUnstickZoomGate(reg: EmbedPdfRegistry, documentId: string) {
  const viewport = reg.getPlugin("viewport").provides() as {
    isGated: (id?: string) => boolean;
    releaseGate: (key: string, id: string) => void;
  };
  if (viewport.isGated(documentId)) {
    viewport.releaseGate("zoom", documentId);
  }
}

export function DocumentEditor({
  pdfBase64,
  exportFileName = "document.pdf",
  onQuickExplain,
  onEmbedReady,
}: DocumentEditorProps) {
  const viewerRef = useRef<PDFViewerRef>(null);
  const viewerShellRef = useRef<HTMLDivElement>(null);
  const [selectionQuickMenu, setSelectionQuickMenu] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const pdfBuffer = useMemo(() => {
    const binary = atob(pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }, [pdfBase64]);

  const handleViewerReady = useCallback(
    async (registry: unknown) => {
      const reg = registry as EmbedPdfRegistry;
      const docManager = reg.getPlugin("document-manager").provides() as {
        openDocumentBuffer: (opts: {
          buffer: ArrayBuffer;
          name: string;
          autoActivate: boolean;
        }) => {
          toPromise: () => Promise<{
            documentId: string;
            task: { toPromise: () => Promise<unknown> };
          }>;
        };
      };

      try {
        const openTask = docManager.openDocumentBuffer({
          buffer: pdfBuffer,
          name: "document.pdf",
          autoActivate: true,
        });
        const { documentId, task } = await openTask.toPromise();
        await task.toPromise();

        const shell = viewerShellRef.current;
        if (!shell) return;

        await waitForNonZeroShellSize(shell, 4000);
        await waitForEmbedViewportClientSize(reg, documentId, 5000);

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        const viewportCap = reg.getPlugin("viewport").provides() as {
          onViewportResize: (
            cb: (e: {
              documentId: string;
              metrics: { clientWidth: number; clientHeight: number };
            }) => void,
          ) => () => void;
        };
        let unsubResize: (() => void) | undefined;
        unsubResize = viewportCap.onViewportResize((event) => {
          if (event.documentId !== documentId) return;
          if (
            event.metrics.clientWidth > 1 &&
            event.metrics.clientHeight > 1
          ) {
            try {
              kickZoom150(reg, documentId);
            } catch {
              /* ignore */
            }
            unsubResize?.();
            unsubResize = undefined;
          }
        });

        const im = reg.getPlugin("interaction-manager").provides() as {
          forDocument: (id: string) => { activate: (m: string) => void };
        };
        im.forDocument(documentId).activate("pointerMode");
        const ann = reg.getPlugin("annotation").provides() as {
          forDocument: (id: string) => {
            setActiveTool: (toolId: string | null) => void;
          };
        };
        ann.forDocument(documentId).setActiveTool(null);

        requestAnimationFrame(() => {
          try {
            kickZoom150(reg, documentId);
          } catch {
            /* ignore */
          }
        });

        const scheduleKick = (delay: number) => {
          window.setTimeout(() => {
            try {
              kickZoom150(reg, documentId);
            } catch {
              /* ignore */
            }
          }, delay);
        };
        scheduleKick(120);
        scheduleKick(400);
        scheduleKick(900);

        window.setTimeout(() => {
          try {
            unsubResize?.();
            unsubResize = undefined;
            const vp = reg.getPlugin("viewport").provides() as {
              isGated: (id?: string) => boolean;
            };
            if (vp.isGated(documentId)) {
              forceUnstickZoomGate(reg, documentId);
              kickZoom150(reg, documentId);
            }
          } catch {
            /* ignore */
          }
        }, 1200);

        onEmbedReady?.({ documentId, registry: reg });
      } catch (err) {
        console.error("Failed to load PDF into viewer:", err);
      }
    },
    [pdfBuffer, onEmbedReady],
  );

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!onQuickExplain) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 2) {
        setSelectionQuickMenu({
          x: lastMousePos.current.x,
          y: lastMousePos.current.y,
          text,
        });
      }
    }, 150);
  }, [onQuickExplain]);

  return (
    // No backdrop-blur here: it creates a containing block so EmbedPDF modals/menus
    // (page & document settings) anchor to this shell instead of the viewport.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-2xl rounded-b-none border border-b-0 border-sky/15 bg-white/72 p-2 pb-0 pt-2 shadow-[0_-4px_40px_rgba(26,26,46,0.06)]">
      <div
        ref={viewerShellRef}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-t-xl rounded-b-none border border-b-0 border-sky/10 bg-paper shadow-[0_12px_32px_rgba(26,26,46,0.06)]"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={() => setSelectionQuickMenu(null)}
      >
        <PDFViewer
          ref={viewerRef}
          className="min-h-0 min-w-0 flex-1 basis-0"
          style={{
            width: "100%",
            height: "100%",
            minHeight: 0,
          }}
          onReady={handleViewerReady}
          config={{
            theme: { preference: "light" },
            tabBar: "never",
            // Keep mode strip hidden; do not disable `panel` or `tools` — that
            // disables comments/search (and their top-right toggle buttons).
            // `stamp` removes rubber-stamp tooling and e.g. "Create stamp" on shapes.
            disabledCategories: ["mode", "stamp"],
            ui: {
              disabledCategories: ["mode", "stamp"],
            },
            commands: {
              disabledCategories: ["stamp"],
            },
            stamp: {
              defaultLibrary: false,
              manifests: [],
            },
            zoom: { defaultZoomLevel: 1.5 },
            export: { defaultFileName: exportFileName },
          }}
        />
      </div>

      {selectionQuickMenu &&
        onQuickExplain &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[200] flex items-center gap-1 rounded-xl border border-sky/20 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur-sm"
            style={{
              left: Math.min(
                selectionQuickMenu.x,
                typeof window !== "undefined"
                  ? window.innerWidth - 200
                  : 0,
              ),
              top: Math.min(
                selectionQuickMenu.y + 8,
                typeof window !== "undefined"
                  ? window.innerHeight - 48
                  : 0,
              ),
            }}
          >
            <button
              type="button"
              className="rounded-lg bg-flame/10 px-2 py-1 font-body text-xs font-medium text-flame hover:bg-flame/20"
              onClick={() => {
                onQuickExplain(selectionQuickMenu.text);
                setSelectionQuickMenu(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              Explain
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 font-body text-xs text-dark/60 hover:bg-cream"
              onClick={() => {
                void navigator.clipboard.writeText(selectionQuickMenu.text);
              }}
            >
              Copy
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
