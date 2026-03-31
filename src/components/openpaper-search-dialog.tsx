"use client";

import { useState } from "react";
import { IconSearch } from "@tabler/icons-react";

/**
 * Client UI for `GET /api/openpaper/search` (Open Paper local knowledge-base search).
 */
export function OpenPaperSearchDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    if (q.trim().length < 2) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/openpaper/search?q=${encodeURIComponent(q.trim())}`,
      );
      const text = await res.text();
      setResult(text);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-body text-sm font-medium text-dark/60 transition-colors hover:text-flame"
      >
        Search
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[300] flex items-start justify-center bg-dark/40 p-6 pt-24"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-sky/15 bg-paper p-4 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <IconSearch className="h-5 w-5 text-sky-dark" />
              <h2 className="font-display text-lg font-semibold text-dark">
                Search your library
              </h2>
            </div>
            <p className="mb-2 font-body text-xs text-dark/45">
              Proxies Open Paper <code className="text-[10px]">/api/search/local</code>.
              Requires session token + running API.
            </p>
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Keywords…"
                className="flex-1 rounded-xl border border-sky/15 px-3 py-2 font-body text-sm"
                onKeyDown={(e) => e.key === "Enter" && void run()}
              />
              <button
                type="button"
                onClick={() => void run()}
                disabled={loading || q.trim().length < 2}
                className="rounded-xl bg-sky px-4 py-2 font-display text-sm font-semibold text-white disabled:opacity-40"
              >
                {loading ? "…" : "Go"}
              </button>
            </div>
            {result ? (
              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-white/80 p-2 font-mono text-[10px] text-dark/80">
                {result.slice(0, 8000)}
              </pre>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 font-body text-sm text-sky-dark underline"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
