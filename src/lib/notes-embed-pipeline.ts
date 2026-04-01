import type { EmbedPdfRegistry } from "~/components/document-editor";
import {
  emptyAnnotationsPayload,
  normalizeDbAnnotations,
  serializeAnnotationsPayload,
  shouldRunAiStudyPass,
  type AnnotationsPayload,
} from "~/lib/annotations-schema";
import { applyFratNotesAnnotationsToEmbedPdf } from "~/lib/embedpdf-apply-annotations";

export type NotesEmbedPipelineResult = {
  payload: AnnotationsPayload;
  failures: { targetText: string; reason: string }[];
};

/**
 * Optionally calls study-pass AI, then applies payload to EmbedPDF and returns payload with fresh embedPdfAnnotationIds.
 */
export async function runNotesEmbedPipeline(options: {
  registry: EmbedPdfRegistry;
  documentId: string;
  extractedText: string;
  initialPayload: AnnotationsPayload;
  fetchStudyPass: (text: string) => Promise<AnnotationsPayload | null>;
}): Promise<NotesEmbedPipelineResult> {
  const {
    registry,
    documentId,
    extractedText,
    initialPayload,
    fetchStudyPass,
  } = options;

  let payload = initialPayload;

  if (shouldRunAiStudyPass(payload) && extractedText.trim().length > 0) {
    const aiPayload = await fetchStudyPass(extractedText);
    if (aiPayload) {
      payload = aiPayload;
    }
  }

  const apply = await applyFratNotesAnnotationsToEmbedPdf({
    registry,
    documentId,
    payload,
    extractedText,
  });

  const next: AnnotationsPayload = {
    ...payload,
    meta: {
      ...payload.meta,
      embedPdfAnnotationIds: apply.createdIds,
    },
  };

  return { payload: next, failures: apply.failures };
}

export {
  emptyAnnotationsPayload,
  normalizeDbAnnotations,
  serializeAnnotationsPayload,
  shouldRunAiStudyPass,
};
