"use client";

import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { Navbar } from "~/components/navbar";
import { KbChat } from "~/components/kb-chat";

export default function AskPage() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 font-body text-sm text-sky-dark hover:underline"
        >
          <IconArrowLeft className="h-4 w-4" />
          Back to library
        </Link>
        <KbChat />
      </div>
    </div>
  );
}
