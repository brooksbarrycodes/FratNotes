import { z } from "zod";

export const annotationAppliesToSchema = z.enum(["highlight", "underline"]);
export type AnnotationAppliesTo = z.infer<typeof annotationAppliesToSchema>;

export const categoryDefSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  appliesTo: z.array(annotationAppliesToSchema).min(1),
});

export type CategoryDef = z.infer<typeof categoryDefSchema>;

export const annotationItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["highlight", "underline", "margin-note"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  targetText: z.string().min(1),
  note: z.string().optional(),
  categoryId: z.string().optional(),
  pageIndex: z.number().int().nonnegative().optional(),
  rects: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    )
    .optional(),
  notePosition: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  content: z
    .object({
      text: z.string().optional(),
      image: z.string().optional(),
    })
    .optional(),
});

export type Annotation = z.infer<typeof annotationItemSchema>;

export const annotationsMetaSchema = z.object({
  aiPassAt: z.string().optional(),
  embedPdfAnnotationIds: z
    .array(
      z.object({
        pageIndex: z.number().int().nonnegative(),
        id: z.string(),
      }),
    )
    .optional(),
});

export type AnnotationsMeta = z.infer<typeof annotationsMetaSchema>;

export const annotationsPayloadV2Schema = z.object({
  version: z.literal(2),
  legend: z.array(categoryDefSchema),
  items: z.array(annotationItemSchema),
  meta: annotationsMetaSchema.optional().default({}),
});

export type AnnotationsPayloadV2 = z.infer<typeof annotationsPayloadV2Schema>;

export type AnnotationsPayload = AnnotationsPayloadV2;

export function emptyAnnotationsPayload(): AnnotationsPayload {
  return { version: 2, legend: [], items: [], meta: {} };
}

/** Normalize DB JSON: legacy array or v2 object → v2 payload. */
export function normalizeDbAnnotations(raw: unknown): AnnotationsPayload {
  if (raw === null || raw === undefined) {
    return emptyAnnotationsPayload();
  }
  if (Array.isArray(raw)) {
    const items = z.array(annotationItemSchema).safeParse(raw);
    return {
      version: 2,
      legend: [],
      items: items.success ? items.data : [],
      meta: {},
    };
  }
  if (typeof raw === "object" && raw !== null && (raw as { version?: number }).version === 2) {
    const parsed = annotationsPayloadV2Schema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  return emptyAnnotationsPayload();
}

export function shouldRunAiStudyPass(payload: AnnotationsPayload): boolean {
  if (payload.items.length > 0) return false;
  if (payload.meta?.aiPassAt) return false;
  return true;
}

export function serializeAnnotationsPayload(p: AnnotationsPayload): string {
  return JSON.stringify(p);
}

/** Validate AI study-pass response body (before persistence). */
export const aiStudyPassResponseSchema = annotationsPayloadV2Schema;

/** Parse chat assistant JSON `annotations` field (v2 object or legacy array). */
export function extractChatAnnotations(raw: unknown): Annotation[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) {
    const p = z.array(annotationItemSchema).safeParse(raw);
    return p.success ? p.data : [];
  }
  if (typeof raw === "object" && raw !== null && "items" in raw) {
    const p = z.array(annotationItemSchema).safeParse(
      (raw as { items: unknown }).items,
    );
    return p.success ? p.data : [];
  }
  return [];
}
