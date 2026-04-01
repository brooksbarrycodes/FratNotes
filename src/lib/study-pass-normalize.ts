/** Default fill when model returns invalid or missing hex. */
const DEFAULT_HEX = "#e8f4ff";

/**
 * Normalize to #rrggbb (lowercase) for Zod /^#[0-9A-Fa-f]{6}$/.
 * Accepts #RGB or #RRGGBB; otherwise returns DEFAULT_HEX.
 */
export function normalizeHexColor(input: unknown): string {
  if (typeof input !== "string") return DEFAULT_HEX;
  const s = input.trim();
  const m = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.exec(s);
  if (!m?.[1]) return DEFAULT_HEX;
  const grp = m[1];
  const g =
    grp.length === 3
      ? grp
          .split("")
          .map((c) => c + c)
          .join("")
      : grp;
  return `#${g.toLowerCase()}`;
}

/**
 * Coerce common model mistakes before `aiStudyPassResponseSchema.safeParse`:
 * version, hex colors, legend shape, categoryId alignment, drop bad items.
 */
export function normalizeAiStudyPassPayload(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const o = raw as Record<string, unknown>;
  const legendRaw = Array.isArray(o.legend) ? o.legend : [];

  const legend = legendRaw
    .map((c) => {
      if (!c || typeof c !== "object" || Array.isArray(c)) return null;
      const cat = c as Record<string, unknown>;
      const id =
        typeof cat.id === "string" && cat.id.trim()
          ? cat.id.trim()
          : `cat-${Math.random().toString(36).slice(2, 10)}`;
      const label =
        typeof cat.label === "string" && cat.label.trim()
          ? cat.label.trim()
          : "Category";
      const color = normalizeHexColor(cat.color);
      let appliesTo = Array.isArray(cat.appliesTo)
        ? cat.appliesTo.filter(
            (x): x is "highlight" | "underline" =>
              x === "highlight" || x === "underline",
          )
        : [];
      if (appliesTo.length === 0) appliesTo = ["highlight"];
      return { id, label, color, appliesTo };
    })
    .filter(
      (x): x is {
        id: string;
        label: string;
        color: string;
        appliesTo: Array<"highlight" | "underline">;
      } => x !== null,
    );

  const legendIds = new Set(legend.map((x) => x.id));
  const firstId = legend[0]?.id;

  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items: unknown[] = [];

  for (const it of itemsRaw) {
    if (!it || typeof it !== "object" || Array.isArray(it)) continue;
    const item = it as Record<string, unknown>;
    const targetText =
      typeof item.targetText === "string" ? item.targetText.trim() : "";
    if (!targetText) continue;

    const type =
      item.type === "highlight" ||
      item.type === "underline" ||
      item.type === "margin-note"
        ? item.type
        : "highlight";

    const color = normalizeHexColor(item.color);
    let categoryId =
      typeof item.categoryId === "string" ? item.categoryId.trim() : undefined;

    if (type === "highlight" || type === "underline") {
      if (categoryId && !legendIds.has(categoryId)) {
        categoryId = firstId;
      }
      if (!categoryId && firstId) categoryId = firstId;
      if (!categoryId) continue;
    }

    const next: Record<string, unknown> = {
      ...item,
      type,
      targetText,
      color,
    };
    if (categoryId) next.categoryId = categoryId;

    if (type === "margin-note") {
      if (typeof item.note !== "string" || !item.note.trim()) {
        next.note = "(note)";
      }
    }

    items.push(next);
  }

  const meta =
    typeof o.meta === "object" &&
    o.meta !== null &&
    !Array.isArray(o.meta)
      ? o.meta
      : {};

  return {
    version: 2,
    legend,
    items,
    meta,
  };
}

/** Max characters of extracted PDF text sent to the study-pass model (avoid truncation mid-JSON). */
export const MAX_STUDY_PASS_CHARS = 36_000;
