"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "~/components/navbar";
import { FileUpload } from "~/components/ui/file-upload";
import { Highlighter } from "~/components/ui/highlighter";

export default function HomePage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setErrorMessage("Only PDF files are supported.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");
    setStatus("Reading PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setStatus("Uploading PDF...");
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        id?: string;
        error?: string;
      };

      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "Upload failed.");
      }

      setStatus("Opening your notes...");
      router.push(`/notes/${payload.id}`);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
      setIsProcessing(false);
      setStatus("");
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-4 font-display text-6xl font-bold leading-tight tracking-tight text-dark md:text-7xl">
            Study{" "}
            <Highlighter action="highlight" color="#87CEFA" strokeWidth={2.5} padding={6} animationDuration={800} isView>
              smarter
            </Highlighter>
            ,{" "}
            <br className="hidden md:block" />
            not{" "}
            <Highlighter action="underline" color="#FF9800" strokeWidth={2.5} padding={4} animationDuration={800} isView>
              harder
            </Highlighter>
          </h1>
          <p className="mx-auto max-w-xl font-body text-lg text-dark/60">
            Drop your PDF and let AI take{" "}
            <span className="font-hand text-xl text-flame">
              college-level notes
            </span>{" "}
            for you. Highlights, underlines, margin scribbles -- the whole deal.
          </p>
        </div>

        <div className="mx-auto max-w-2xl">
          <FileUpload onChange={handleUpload} onError={setErrorMessage} />

          {isProcessing && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-3 rounded-xl bg-white/70 px-5 py-3 shadow-sm backdrop-blur-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky border-t-transparent" />
                <span className="font-body text-sm text-dark/70">{status}</span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 rounded-xl border border-flame/20 bg-flame/10 px-4 py-3 text-center">
              <p className="font-body text-sm text-dark">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="mt-24 grid gap-8 md:grid-cols-3">
          {[
            {
              icon: "📄",
              title: "Drop a PDF",
              desc: "Upload any lecture notes, textbook chapter, or study guide",
            },
            {
              icon: "🤖",
              title: "AI Takes Notes",
              desc: "Watch as highlights, underlines, and margin notes appear in real time",
            },
            {
              icon: "✏️",
              title: "Make It Yours",
              desc: "Edit, draw, chat with AI, and download your annotated PDF",
            },
          ].map((feat) => (
            <div
              key={feat.title}
              className="rounded-2xl border border-sky/10 bg-white/50 p-6 backdrop-blur-sm transition-all hover:border-sky/30 hover:shadow-lg"
            >
              <div className="mb-3 text-3xl">{feat.icon}</div>
              <h3 className="mb-2 font-display text-lg font-semibold text-dark">
                {feat.title}
              </h3>
              <p className="font-body text-sm text-dark/50">{feat.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
