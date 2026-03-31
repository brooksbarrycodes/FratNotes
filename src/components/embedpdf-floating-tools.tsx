"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ComponentType,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import type { EmbedPdfRegistry } from "~/components/document-editor";
import type { EmbedPdfSnippetIconProps } from "~/components/embedpdf-snippet-icons";
import {
  EmbedPdfPointerIcon,
  EmbedPdfHighlightIcon,
  EmbedPdfUnderlineIcon,
  EmbedPdfStrikethroughIcon,
  EmbedPdfSquigglyIcon,
  EmbedPdfPencilMarkerIcon,
  EmbedPdfInkHighlighterIcon,
  EmbedPdfMessageIcon,
  EmbedPdfFreeTextIcon,
  EmbedPdfSquareIcon,
  EmbedPdfCircleIcon,
  EmbedPdfLineIcon,
  EmbedPdfLineArrowIcon,
  EmbedPdfZigzagIcon,
  EmbedPdfPolygonIcon,
  EmbedPdfArrowBackUpIcon,
  EmbedPdfPaletteIcon,
  EmbedPdfChevronDownIcon,
  EmbedPdfDownloadIcon,
} from "~/components/embedpdf-snippet-icons";
import { cn } from "~/lib/utils";

type ToolbarIcon = ComponentType<
  Pick<EmbedPdfSnippetIconProps, "className" | "accentColor">
>;

const NEUTRAL_STROKE = "#5c6b7a";

const DRAW_COLORS = [
  { name: "Sky", value: "#87CEFA" },
  { name: "Flame", value: "#FF9800" },
  { name: "Dark", value: "#1A1A2E" },
] as const;

const DEFAULT_SHAPE_STROKE = "#E44234";

const SHAPE_TOOLS: { id: string; label: string; Icon: ToolbarIcon }[] = [
  { id: "square", label: "Square", Icon: EmbedPdfSquareIcon },
  { id: "circle", label: "Circle", Icon: EmbedPdfCircleIcon },
  { id: "line", label: "Line", Icon: EmbedPdfLineIcon },
  { id: "lineArrow", label: "Arrow", Icon: EmbedPdfLineArrowIcon },
  { id: "polyline", label: "Polyline", Icon: EmbedPdfZigzagIcon },
  { id: "polygon", label: "Polygon", Icon: EmbedPdfPolygonIcon },
];

const SHAPE_IDS = new Set(SHAPE_TOOLS.map((s) => s.id));

const ANNOTATE_TOOLS: { id: string; label: string; Icon: ToolbarIcon }[] = [
  { id: "highlight", label: "Highlight", Icon: EmbedPdfHighlightIcon },
  { id: "underline", label: "Underline", Icon: EmbedPdfUnderlineIcon },
  { id: "strikeout", label: "Strikeout", Icon: EmbedPdfStrikethroughIcon },
  { id: "squiggly", label: "Squiggly", Icon: EmbedPdfSquigglyIcon },
  { id: "ink", label: "Pen", Icon: EmbedPdfPencilMarkerIcon },
  { id: "inkHighlighter", label: "Ink highlighter", Icon: EmbedPdfInkHighlighterIcon },
  { id: "textComment", label: "Comment", Icon: EmbedPdfMessageIcon },
  { id: "freeText", label: "Text box", Icon: EmbedPdfFreeTextIcon },
];

function annotateDefaultsPatch(
  toolId: string,
  hex: string,
): Record<string, unknown> {
  switch (toolId) {
    case "freeText":
      return { fontColor: hex };
    case "textComment":
      return { strokeColor: hex };
    case "highlight":
    case "inkHighlighter":
    case "underline":
    case "strikeout":
    case "squiggly":
    case "ink":
      return { color: hex, strokeColor: hex };
    default:
      return { color: hex, strokeColor: hex };
  }
}

const btnBase =
  "rounded-xl p-2.5 transition-all disabled:opacity-30 disabled:pointer-events-none";
const btnIdle = `${btnBase} text-dark/40 hover:bg-cream hover:text-dark/70`;
const btnSelected = `${btnBase} bg-sky/15 text-dark ring-1 ring-sky/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]`;

interface EmbedPdfFloatingToolsProps {
  documentId: string | null;
  registry: EmbedPdfRegistry | null;
}

export function EmbedPdfFloatingTools({
  documentId,
  registry,
}: EmbedPdfFloatingToolsProps) {
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [shapeToolId, setShapeToolId] = useState<string>("square");
  const [shapeStrokeHex, setShapeStrokeHex] = useState(DEFAULT_SHAPE_STROKE);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const shapesWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!registry || !documentId) {
      setActiveToolId(null);
      return;
    }
    type AnnProvides = {
      forDocument: (id: string) => { getActiveTool: () => { id: string } | null };
      onActiveToolChange: (fn: (e: { documentId: string; tool: { id: string } | null }) => void) => () => void;
    };
    let unsub: (() => void) | undefined;
    try {
      const ann = registry.getPlugin("annotation").provides() as AnnProvides;
      const scope = ann.forDocument(documentId);
      const t = scope.getActiveTool();
      setActiveToolId(t?.id ?? null);
      if (t?.id && SHAPE_IDS.has(t.id)) setShapeToolId(t.id);

      unsub = ann.onActiveToolChange((e) => {
        if (e.documentId !== documentId) return;
        const id = e.tool?.id ?? null;
        setActiveToolId(id);
        if (id && SHAPE_IDS.has(id)) setShapeToolId(id);
      });
    } catch {
      setActiveToolId(null);
    }
    return () => unsub?.();
  }, [registry, documentId]);

  useEffect(() => {
    if (!showShapesMenu) return;
    const onDown = (e: MouseEvent) => {
      if (
        shapesWrapRef.current &&
        !shapesWrapRef.current.contains(e.target as Node)
      ) {
        setShowShapesMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showShapesMenu]);

  const withScope = useCallback(
    (fn: () => void) => {
      if (!documentId || !registry) return;
      try {
        fn();
      } catch {
        /* ignore */
      }
    },
    [documentId, registry],
  );

  const activateView = useCallback(() => {
    withScope(() => {
      const im = registry!.getPlugin("interaction-manager").provides() as {
        forDocument: (id: string) => { activate: (m: string) => void };
      };
      im.forDocument(documentId!).activate("pointerMode");
      const ann = registry!.getPlugin("annotation").provides() as {
        forDocument: (id: string) => {
          setActiveTool: (toolId: string | null) => void;
        };
      };
      ann.forDocument(documentId!).setActiveTool(null);
    });
  }, [documentId, registry, withScope]);

  const setAnnotationTool = useCallback(
    (toolId: string) => {
      withScope(() => {
        const ann = registry!.getPlugin("annotation").provides() as {
          forDocument: (id: string) => {
            setActiveTool: (toolId: string | null) => void;
          };
        };
        ann.forDocument(documentId!).setActiveTool(toolId);
      });
    },
    [documentId, registry, withScope],
  );

  const applyShapeTool = useCallback(
    (toolId: string) => {
      setShapeToolId(toolId);
      setAnnotationTool(toolId);
      setShowShapesMenu(false);
    },
    [setAnnotationTool],
  );

  const applyColor = useCallback(
    (hex: string) => {
      if (!registry) return;
      try {
        const ann = registry.getPlugin("annotation").provides() as {
          setToolDefaults: (
            toolId: string,
            patch: Record<string, unknown>,
          ) => void;
        };
        for (const t of ANNOTATE_TOOLS) {
          ann.setToolDefaults(t.id, annotateDefaultsPatch(t.id, hex));
        }
        for (const t of SHAPE_TOOLS) {
          ann.setToolDefaults(t.id, {
            strokeColor: hex,
            color: "transparent",
          });
        }
        setShapeStrokeHex(hex);
      } catch {
        /* ignore */
      }
      setShowColorPicker(false);
    },
    [registry],
  );

  const undo = useCallback(() => {
    withScope(() => {
      const hist = registry!.getPlugin("history").provides() as {
        forDocument: (id: string) => { undo: () => void };
      };
      hist.forDocument(documentId!).undo();
    });
  }, [documentId, registry, withScope]);

  const downloadPdf = useCallback(() => {
    withScope(() => {
      const exp = registry!.getPlugin("export").provides() as {
        forDocument: (id: string) => { download: () => void };
      };
      exp.forDocument(documentId!).download();
    });
  }, [documentId, registry, withScope]);

  const disabled = !documentId || !registry;
  const defaultShape = SHAPE_TOOLS.find((s) => s.id === shapeToolId) ?? SHAPE_TOOLS[0]!;
  const DefaultShapeIcon = defaultShape.Icon;

  const viewSelected = !disabled && activeToolId === null;
  const shapeGroupSelected =
    !disabled && activeToolId !== null && SHAPE_IDS.has(activeToolId);

  const railChrome =
    "rounded-2xl border border-sky/15 bg-white/90 shadow-[0_16px_40px_rgba(26,26,46,0.12)] backdrop-blur-md";

  return (
    <div
      className={cn(
        "fixed left-4 top-1/2 z-50 flex -translate-y-1/2 flex-col items-center gap-1 p-1.5",
        railChrome,
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={activateView}
        className={viewSelected ? btnSelected : btnIdle}
        title="View"
      >
        <EmbedPdfPointerIcon
          className="h-5 w-5"
          accentColor={viewSelected ? "#1A1A2E" : NEUTRAL_STROKE}
        />
      </button>

      <div className="my-0.5 h-px w-6 bg-sky/15" />

      {ANNOTATE_TOOLS.map((t) => {
        const sel = !disabled && activeToolId === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => setAnnotationTool(t.id)}
            className={sel ? btnSelected : btnIdle}
            title={t.label}
          >
            <t.Icon className="h-5 w-5" />
          </button>
        );
      })}

      <div className="my-0.5 h-px w-6 bg-sky/15" />

      <div ref={shapesWrapRef} className="relative flex flex-col items-center">
        <div
          className={cn(
            "flex overflow-hidden rounded-2xl border border-sky/15 bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-md transition-shadow duration-200",
            shapeGroupSelected && !showShapesMenu && "ring-1 ring-sky/35",
            showShapesMenu && "ring-2 ring-sky/40 ring-offset-2 ring-offset-transparent",
            !disabled && "hover:border-sky/25",
          )}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyShapeTool(shapeToolId)}
            className={cn(
              "px-2 py-2.5 transition-colors disabled:opacity-30",
              shapeGroupSelected ? "bg-sky/12" : "hover:bg-sky/[0.06]",
            )}
            title={`Shape: ${defaultShape.label}`}
          >
            <DefaultShapeIcon
              className="h-5 w-5"
              accentColor={shapeStrokeHex}
            />
          </button>
          <div className="w-px shrink-0 bg-sky/15" />
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowShapesMenu((v) => !v)}
            className={cn(
              "flex items-center px-1.5 py-2 transition-colors hover:bg-sky/[0.06] disabled:opacity-30",
              showShapesMenu && "bg-sky/10",
            )}
            title="Choose shape"
            aria-expanded={showShapesMenu}
            aria-haspopup="listbox"
            aria-label="Shape options"
          >
            <EmbedPdfChevronDownIcon
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                showShapesMenu && "rotate-180",
              )}
              accentColor={NEUTRAL_STROKE}
            />
          </button>
        </div>

        <AnimatePresence>
          {showShapesMenu && !disabled && (
            <motion.div
              key="shapes-flyout"
              role="listbox"
              aria-label="Shapes"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn(
                "absolute left-full top-0 z-[60] ml-2 w-[10.5rem] overflow-hidden",
                railChrome,
              )}
            >
              <p className="border-b border-sky/10 px-2.5 py-2 font-display text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-dark/40">
                Shapes
              </p>
              <ul className="flex flex-col py-1">
                {SHAPE_TOOLS.map((s) => {
                  const selected = s.id === shapeToolId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => applyShapeTool(s.id)}
                        className={cn(
                          "flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors",
                          selected
                            ? "bg-sky/12"
                            : "hover:bg-cream/80",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                            selected
                              ? "border-sky/35 bg-white/80"
                              : "border-sky/10 bg-cream/50",
                          )}
                        >
                          <s.Icon
                            className="h-3.5 w-3.5"
                            accentColor={shapeStrokeHex}
                          />
                        </span>
                        <span className="font-display text-xs font-medium text-dark/85">
                          {s.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="my-0.5 h-px w-6 bg-sky/15" />

      <button
        type="button"
        disabled={disabled}
        onClick={undo}
        className={btnIdle}
        title="Undo"
      >
        <EmbedPdfArrowBackUpIcon
          className="h-5 w-5"
          accentColor={NEUTRAL_STROKE}
        />
      </button>

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowColorPicker((v) => !v)}
          className={cn(btnIdle, showColorPicker && btnSelected)}
          title="Color"
        >
          <EmbedPdfPaletteIcon className="h-5 w-5" accentColor={NEUTRAL_STROKE} />
        </button>
        {showColorPicker && !disabled && (
          <div className="absolute left-full top-0 z-[60] ml-2 flex flex-col gap-2 rounded-2xl border border-sky/15 bg-white/95 p-2 shadow-lg backdrop-blur-sm">
            {DRAW_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => applyColor(c.value)}
                className="h-7 w-7 rounded-full ring-1 ring-dark/10 transition-all hover:scale-110"
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
        )}
      </div>

      <div className="my-0.5 h-px w-6 bg-sky/15" />

      <button
        type="button"
        disabled={disabled}
        onClick={downloadPdf}
        className={btnIdle}
        title="Download PDF"
      >
        <EmbedPdfDownloadIcon
          className="h-5 w-5"
          accentColor={NEUTRAL_STROKE}
        />
      </button>
    </div>
  );
}
