"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface DocumentNotesPanelProps {
  initialMarkdown: string;
  onSave: (markdown: string) => void;
}

/**
 * In-context notes with a simple raw / rendered toggle (Open Paper–style markdown preview).
 */
export function DocumentNotesPanel({
  initialMarkdown,
  onSave,
}: DocumentNotesPanelProps) {
  const [text, setText] = useState(initialMarkdown);
  const [preview, setPreview] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(initialMarkdown);
  }, [initialMarkdown]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-sky/15 bg-white/60 p-3 shadow-sm backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display text-sm font-semibold text-dark">Paper notes</p>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="rounded-lg border border-sky/20 bg-paper px-2 py-1 font-body text-xs font-medium text-dark/70 transition-colors hover:bg-sky/10"
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div className="prose prose-sm max-w-none rounded-xl border border-sky/10 bg-paper/80 p-3 text-dark prose-headings:font-display prose-a:text-sky-dark">
          <ReactMarkdown>{text || "*No notes yet.*"}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => onSave(v), 600);
          }}
          placeholder="Markdown notes for this paper..."
          rows={6}
          className="w-full resize-y rounded-xl border border-sky/15 bg-paper/90 px-3 py-2 font-body text-sm text-dark placeholder:text-dark/35 focus:border-sky/40 focus:outline-none focus:ring-1 focus:ring-sky/30"
        />
      )}
    </div>
  );
}
