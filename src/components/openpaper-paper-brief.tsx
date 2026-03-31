"use client";

export function OpenPaperPaperBrief({
  brief,
  syncLabel,
}: {
  brief: string;
  /** e.g. "Synced" or "Local only" */
  syncLabel?: string;
}) {
  if (!brief.trim()) return null;

  return (
    <div className="mb-3 rounded-2xl border border-sky/15 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-wide text-sky-dark">
          Paper brief
        </p>
        {syncLabel ? (
          <span className="rounded-full bg-sky/10 px-2 py-0.5 font-body text-[10px] font-medium text-dark/50">
            {syncLabel}
          </span>
        ) : null}
      </div>
      <p className="font-body text-sm leading-relaxed text-dark/85">{brief}</p>
    </div>
  );
}
