"use client";

import dynamic from "next/dynamic";

const NotesWorkspaceClient = dynamic(
  () => import("./notes-workspace-client").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky border-t-transparent" />
          <p className="font-body text-sm text-dark/50">Loading workspace…</p>
        </div>
      </div>
    ),
  },
);

export default function NotesGateClient() {
  return <NotesWorkspaceClient />;
}
