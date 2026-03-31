"use client";

import Link from "next/link";
import { Navbar } from "~/components/navbar";
import { api } from "~/trpc/react";
import {
  IconFileText,
  IconTrash,
  IconPlus,
  IconClock,
} from "@tabler/icons-react";

export default function DashboardPage() {
  const { data: docs, refetch, isLoading } = api.documents.getAll.useQuery();

  const deleteDoc = api.documents.delete.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-dark">
              My Notes
            </h1>
            <p className="mt-1 font-body text-dark/50">
              Your annotated documents in guest mode
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-flame px-5 py-2.5 font-display text-sm font-semibold text-white shadow-md shadow-flame/20 transition-all hover:bg-flame-dark hover:shadow-lg active:scale-95"
          >
            <IconPlus className="h-4 w-4" />
            New Note
          </Link>
        </div>

        {!docs?.length ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sky/20 bg-white/30 py-20">
            <div className="mb-4 text-5xl">📚</div>
            <h3 className="mb-2 font-display text-xl font-semibold text-dark">
              No notes yet
            </h3>
            <p className="mb-6 font-body text-dark/50">
              Upload your first PDF to get started
            </p>
            <Link
              href="/"
              className="rounded-xl bg-sky px-6 py-2.5 font-display text-sm font-semibold text-white shadow-md transition-all hover:bg-sky-dark active:scale-95"
            >
              Upload PDF
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                href={`/notes/${doc.id}`}
                className="group relative rounded-2xl border border-sky/10 bg-white/60 p-5 backdrop-blur-sm transition-all hover:border-sky/30 hover:bg-white/80 hover:shadow-lg"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky/10">
                    <IconFileText className="h-5 w-5 text-sky" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm("Delete this document?")) {
                        deleteDoc.mutate({ id: doc.id });
                      }
                    }}
                    className="rounded-lg p-1.5 text-dark/20 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="mb-2 line-clamp-2 font-display text-base font-semibold text-dark">
                  {doc.title}
                </h3>
                <div className="flex items-center gap-1.5 text-dark/40">
                  <IconClock className="h-3.5 w-3.5" />
                  <span className="font-body text-xs">
                    {new Date(doc.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
