"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { IconSend, IconSparkles } from "@tabler/icons-react";
import {
  createOpenPaperStreamParser,
  type OpenPaperStreamChunk,
} from "~/lib/openpaper-stream";
import { api } from "~/trpc/react";

type Msg = { id: string; role: "user" | "assistant"; content: string };

/**
 * Knowledge-base chat (Open Paper `POST /api/message/chat/everything`) proxied through FratNotes.
 */
export function KbChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const ensure = api.user.ensureKbConversation.useMutation();
  const { data: settings } = api.user.getOpenPaperSettings.useQuery();

  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.kbConversationId) {
      setConversationId(settings.kbConversationId);
    }
  }, [settings?.kbConversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const resolveConversation = useCallback(async () => {
    if (conversationId) return conversationId;
    const r = await ensure.mutateAsync();
    setConversationId(r.conversationId);
    return r.conversationId;
  }, [conversationId, ensure]);

  const send = useCallback(
    async (text: string) => {
      const conv = await resolveConversation();
      const userMsg: Msg = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((m) => [...m, userMsg]);
      setLoading(true);
      const assistantId = `a-${Date.now()}`;
      setMessages((m) => [
        ...m,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        const res = await fetch("/api/openpaper/chat/everything", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conv,
            userQuery: text,
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          setMessages((m) =>
            m.map((x) =>
              x.id === assistantId
                ? { ...x, content: `Error: ${err.slice(0, 400)}` }
                : x,
            ),
          );
          return;
        }
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No body");
        const decoder = new TextDecoder();
        const parser = createOpenPaperStreamParser(
          (chunk: OpenPaperStreamChunk) => {
            if (chunk.type === "content" && typeof chunk.content === "string") {
              setMessages((m) =>
                m.map((x) =>
                  x.id === assistantId
                    ? { ...x, content: x.content + chunk.content }
                    : x,
                ),
              );
            }
          },
        );
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.end();
      } catch (e) {
        setMessages((m) =>
          m.map((x) =>
            x.id === assistantId
              ? {
                  ...x,
                  content:
                    e instanceof Error ? e.message : "Knowledge chat failed.",
                }
              : x,
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [resolveConversation],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    void send(input.trim());
    setInput("");
  };

  const enabled =
    process.env.NEXT_PUBLIC_OPENPAPER_ENABLED === "true" &&
    Boolean(settings?.integrationEnabled) &&
    Boolean(settings?.hasSessionToken);

  return (
    <div className="flex h-[min(70vh,560px)] flex-col rounded-2xl border border-sky/15 bg-white/70 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-sky/10 px-4 py-3">
        <IconSparkles className="h-5 w-5 text-flame" />
        <div>
          <h2 className="font-display text-base font-semibold text-dark">
            Ask your library
          </h2>
          <p className="font-body text-xs text-dark/45">
            Uses Open Paper multi-paper chat when the API is reachable.
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!enabled && (
          <p className="font-body text-sm text-dark/50">
            Enable NEXT_PUBLIC_OPENPAPER_ENABLED, OPENPAPER_ENABLED, OPENPAPER_API_URL,
            and add a session token under Settings → Open Paper.
          </p>
        )}
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 font-body text-sm ${
                  msg.role === "user"
                    ? "bg-flame/10 text-dark"
                    : "bg-sky/10 text-dark"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-1 px-2 py-2">
              <div className="h-2 w-2 animate-bounce rounded-full bg-sky/50" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-sky/50 [animation-delay:0.15s]" />
            </div>
          )}
        </div>
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="border-t border-sky/10 p-3">
        <div className="flex gap-2 rounded-xl bg-cream/50 px-3 py-2 ring-1 ring-sky/10">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!enabled || loading}
            placeholder="Ask across all synced papers…"
            className="flex-1 bg-transparent font-body text-sm focus:outline-none"
          />
          <button
            type="submit"
            disabled={!enabled || loading || !input.trim()}
            className="rounded-lg bg-sky p-2 text-white disabled:opacity-30"
          >
            <IconSend className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
