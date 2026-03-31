/** Matches Open Paper `message_api.END_DELIMITER` */
export const OPENPAPER_STREAM_DELIMITER = "END_OF_STREAM";

export type OpenPaperStreamChunk =
  | { type: "content"; content: string }
  | { type: "references"; content: unknown }
  | { type: "status"; content: string }
  | { type: "error"; content: string };

/**
 * Incrementally parse Open Paper streaming body (concatenated JSON + delimiter).
 */
export function createOpenPaperStreamParser(
  onChunk: (chunk: OpenPaperStreamChunk) => void,
) {
  let buffer = "";

  return {
    push(text: string) {
      buffer += text;
      let idx: number;
      while ((idx = buffer.indexOf(OPENPAPER_STREAM_DELIMITER)) !== -1) {
        const raw = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + OPENPAPER_STREAM_DELIMITER.length);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as OpenPaperStreamChunk;
          onChunk(parsed);
        } catch {
          // ignore malformed fragment
        }
      }
    },
    end() {
      const rest = buffer.trim();
      if (rest) {
        try {
          const parsed = JSON.parse(rest) as OpenPaperStreamChunk;
          onChunk(parsed);
        } catch {
          /* noop */
        }
      }
      buffer = "";
    },
  };
}
