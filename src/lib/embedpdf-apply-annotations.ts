import type {
  PdfDocumentObject,
  PdfFreeTextAnnoObject,
  PdfHighlightAnnoObject,
  PdfUnderlineAnnoObject,
  Rect,
  SearchResult,
} from "@embedpdf/models";
import {
  PdfAnnotationSubtype,
  PdfBlendMode,
  PdfStandardFont,
  PdfTextAlignment,
  PdfVerticalAlignment,
} from "@embedpdf/models";
import type { EmbedPdfRegistry } from "~/components/document-editor";
import type { Annotation, AnnotationsPayload } from "~/lib/annotations-schema";

export type ApplyAnnotationsResult = {
  createdIds: { pageIndex: number; id: string }[];
  failures: { targetText: string; reason: string }[];
};

type AnnotationDocScope = {
  createAnnotation: <A extends { id: string; pageIndex: number; type: PdfAnnotationSubtype }>(
    pageIndex: number,
    annotation: A,
  ) => void;
  deleteAnnotations: (
    annotations: Array<{ pageIndex: number; id: string }>,
  ) => void;
  commit: () => { toPromise: () => Promise<boolean> };
};

type SearchDocScope = {
  searchAllPages: (keyword: string) => { toPromise: () => Promise<{ results: SearchResult[] }> };
};

type DocumentManagerCap = {
  getDocument: (documentId: string) => PdfDocumentObject | null;
};

function unionRect(rects: Rect[]): Rect {
  if (rects.length === 0) {
    return {
      origin: { x: 0, y: 0 },
      size: { width: 0, height: 0 },
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    const x1 = r.origin.x;
    const y1 = r.origin.y;
    const x2 = x1 + r.size.width;
    const y2 = y1 + r.size.height;
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }
  return {
    origin: { x: minX, y: minY },
    size: { width: maxX - minX, height: maxY - minY },
  };
}

function pickSearchHit(results: SearchResult[], fullText: string): SearchResult | null {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0]!;
  const scored = results.map((r) => {
    const ctx = r.context;
    const snippet = `${ctx.before}${ctx.match}${ctx.after}`.replace(/\s+/g, " ").trim();
    const inDoc = fullText.includes(snippet) || fullText.includes(ctx.match);
    return { r, score: inDoc ? 1 : 0 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.r;
}

function marginFreeTextRect(
  anchor: Rect,
  pageWidth: number,
  marginWidth: number,
): Rect {
  const gap = 10;
  const leftSpace = anchor.origin.x;
  const rightSpace = pageWidth - (anchor.origin.x + anchor.size.width);
  const placeLeft = leftSpace >= marginWidth + gap;
  const x = placeLeft
    ? Math.max(12, anchor.origin.x - marginWidth - gap)
    : Math.min(
        pageWidth - marginWidth - 12,
        anchor.origin.x + anchor.size.width + gap,
      );
  const h = Math.max(anchor.size.height, 36);
  return {
    origin: { x, y: anchor.origin.y },
    size: { width: marginWidth, height: Math.min(h * 3, 180) },
  };
}

function legendRect(page: { size: { width: number; height: number } }): Rect {
  const pad = 48;
  const boxH = 120;
  const w = page.size.width - pad * 2;
  return {
    origin: { x: pad, y: page.size.height - pad - boxH },
    size: { width: w, height: boxH },
  };
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `ann-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Applies FratNotes payload to the open EmbedPDF document: deletes prior embed IDs from meta, creates PDF annotations, commits, returns new ids.
 */
export async function applyFratNotesAnnotationsToEmbedPdf(options: {
  registry: EmbedPdfRegistry;
  documentId: string;
  payload: AnnotationsPayload;
  extractedText: string;
}): Promise<ApplyAnnotationsResult> {
  const { registry, documentId, payload, extractedText } = options;
  const failures: ApplyAnnotationsResult["failures"] = [];
  const createdIds: ApplyAnnotationsResult["createdIds"] = [];

  let annScope: AnnotationDocScope;
  let searchScope: SearchDocScope;
  let doc: PdfDocumentObject | null;

  try {
    const searchPlug = registry.getPlugin("search").provides() as {
      forDocument: (id: string) => SearchDocScope;
    };
    searchScope = searchPlug.forDocument(documentId);
  } catch {
    return {
      createdIds: [],
      failures: [{ targetText: "", reason: "Search plugin unavailable" }],
    };
  }

  try {
    const annPlug = registry.getPlugin("annotation").provides() as {
      forDocument: (id: string) => AnnotationDocScope;
    };
    annScope = annPlug.forDocument(documentId);
  } catch {
    return {
      createdIds: [],
      failures: [{ targetText: "", reason: "Annotation plugin unavailable" }],
    };
  }

  try {
    const dm = registry.getPlugin("document-manager").provides() as DocumentManagerCap;
    doc = dm.getDocument(documentId);
  } catch {
    doc = null;
  }

  if (!doc?.pages?.length) {
    return {
      createdIds: [],
      failures: [{ targetText: "", reason: "Document pages unavailable" }],
    };
  }

  const page0 = doc.pages[0]!;
  const pageWidth0 = page0.size.width;

  const prevIds = payload.meta?.embedPdfAnnotationIds ?? [];
  if (prevIds.length > 0) {
    try {
      annScope.deleteAnnotations(prevIds);
    } catch {
      /* continue — stale ids */
    }
  }

  const runSearch = async (q: string) => {
    const task = searchScope.searchAllPages(q);
    const res = await task.toPromise();
    return res.results ?? [];
  };

  const pushFreeText = (pageIndex: number, rect: Rect, contents: string) => {
    const id = newId();
    const ft: PdfFreeTextAnnoObject = {
      id,
      pageIndex,
      type: PdfAnnotationSubtype.FREETEXT,
      rect,
      contents,
      fontFamily: PdfStandardFont.Times_Italic,
      fontSize: 9,
      fontColor: "#1A1A2E",
      textAlign: PdfTextAlignment.Left,
      verticalAlign: PdfVerticalAlignment.Top,
      opacity: 1,
      color: "transparent",
    };
    annScope.createAnnotation(pageIndex, ft);
    createdIds.push({ pageIndex, id });
  };

  // Legend on page 1 (index 0)
  if (payload.legend.length > 0) {
    const lines = [
      "Study key (FratNotes AI)",
      ...payload.legend.map((c) => {
        const tools = c.appliesTo.join(" + ");
        return `${c.label} (${tools}) — ${c.color}`;
      }),
    ];
    const lr = legendRect(page0);
    pushFreeText(0, lr, lines.join("\n"));
  }

  const yieldToMain = () =>
    new Promise<void>((r) => {
      requestAnimationFrame(() => r());
    });

  for (const item of payload.items) {
    await yieldToMain();
    const q = item.targetText?.trim() ?? "";
    if (!q) {
      failures.push({ targetText: "", reason: "Empty targetText" });
      continue;
    }

    let results: SearchResult[];
    try {
      results = await runSearch(q);
    } catch {
      failures.push({ targetText: q, reason: "Search failed" });
      continue;
    }

    const hit = pickSearchHit(results, extractedText);
    if (!hit || hit.rects.length === 0) {
      failures.push({ targetText: q, reason: "No PDF match" });
      continue;
    }

    const pageIndex = hit.pageIndex;
    const page = doc.pages[pageIndex];
    const pageWidth = page?.size.width ?? pageWidth0;
    const segmentRects = hit.rects.map((r) => ({
      origin: { ...r.origin },
      size: { ...r.size },
    }));
    const union = unionRect(segmentRects);

    if (item.type === "highlight") {
      const id = newId();
      const hl: PdfHighlightAnnoObject = {
        id,
        pageIndex,
        type: PdfAnnotationSubtype.HIGHLIGHT,
        rect: { ...union, origin: { ...union.origin }, size: { ...union.size } },
        segmentRects,
        strokeColor: item.color,
        opacity: 0.45,
        blendMode: PdfBlendMode.Multiply,
      };
      annScope.createAnnotation(pageIndex, hl);
      createdIds.push({ pageIndex, id });
    } else if (item.type === "underline") {
      const id = newId();
      const ul: PdfUnderlineAnnoObject = {
        id,
        pageIndex,
        type: PdfAnnotationSubtype.UNDERLINE,
        rect: { ...union, origin: { ...union.origin }, size: { ...union.size } },
        segmentRects,
        strokeColor: item.color,
        opacity: 1,
      };
      annScope.createAnnotation(pageIndex, ul);
      createdIds.push({ pageIndex, id });
    } else if (item.type === "margin-note" && item.note?.trim()) {
      const mrect = marginFreeTextRect(union, pageWidth, 118);
      pushFreeText(pageIndex, mrect, item.note.trim());
    }
  }

  try {
    await annScope.commit().toPromise();
  } catch {
    failures.push({ targetText: "", reason: "Commit failed" });
  }

  return { createdIds, failures };
}

/** Merge chat-added annotation items into an existing payload (preserves legend/meta where possible). */
export function mergeAnnotationItemsIntoPayload(
  payload: AnnotationsPayload,
  newItems: Annotation[],
): AnnotationsPayload {
  const withIds = newItems.map((a) => ({
    ...a,
    id: a.id ?? newId(),
  }));
  return {
    ...payload,
    items: [...payload.items, ...withIds],
  };
}
