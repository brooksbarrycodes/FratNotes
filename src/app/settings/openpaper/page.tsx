"use client";

import { useState } from "react";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { Navbar } from "~/components/navbar";
import { api } from "~/trpc/react";

export default function OpenPaperSettingsPage() {
  const { data, refetch } = api.user.getOpenPaperSettings.useQuery();
  const setToken = api.user.setOpenPaperSessionToken.useMutation({
    onSuccess: () => void refetch(),
  });
  const [value, setValue] = useState("");

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-lg px-6 py-10">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 font-body text-sm text-sky-dark hover:underline"
        >
          <IconArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="font-display text-2xl font-bold text-dark">
          Open Paper bridge
        </h1>
        <p className="mt-2 font-body text-sm text-dark/55">
          Paste a session token from your Open Paper account (same API as{" "}
          <code className="rounded bg-white/80 px-1">Authorization: Bearer</code>
          ). See <code className="text-xs">fratnotes/docs/OPENPAPER.md</code> in
          the repo.
        </p>
        <div className="mt-6 rounded-2xl border border-sky/15 bg-white/70 p-4 shadow-sm">
          <p className="mb-2 font-body text-xs text-dark/45">
            Integration active:{" "}
            <strong>{data?.integrationEnabled ? "yes (server)" : "no"}</strong>
          </p>
          <label className="font-body text-xs font-medium text-dark/70">
            Session token
          </label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="••••••••"
            rows={3}
            className="mt-1 w-full rounded-xl border border-sky/15 bg-paper px-3 py-2 font-mono text-xs text-dark"
          />
          <button
            type="button"
            onClick={() =>
              setToken.mutate({ token: value.trim() || null })
            }
            disabled={setToken.isPending}
            className="mt-3 rounded-xl bg-sky px-4 py-2 font-display text-sm font-semibold text-white disabled:opacity-40"
          >
            Save token
          </button>
          {data?.hasSessionToken ? (
            <p className="mt-2 font-body text-xs text-green-700">
              Token on file. KB id: {data.kbConversationId ?? "(not created yet)"}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
