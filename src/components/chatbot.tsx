"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion } from "motion/react";
import { IconSend, IconSparkles, IconX } from "@tabler/icons-react";
import type { Annotation } from "~/components/document-editor";
import {
  createOpenPaperStreamParser,
  type OpenPaperStreamChunk,
} from "~/lib/openpaper-stream";
import {
  CHAT_VOICE_OPTIONS,
  DEFAULT_CHAT_VOICE,
  type ChatVoiceId,
} from "~/lib/chat-voice";

interface ChatbotProps {
  documentText: string;
  onNewAnnotations?: (annotations: Annotation[]) => void;
  documentId?: string;
  useOpenPaper?: boolean;
  starterQuestions?: string[];
  pendingInject?: string | null;
  onPendingInjectConsumed?: () => void;
}

function getMessageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
}

type SimpleMsg = { id: string; role: "user" | "assistant"; content: string };

const SURFACE =
  "relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.125rem] border border-sky/12 bg-gradient-to-b from-white/[0.97] via-white/90 to-cream/25 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_20px_50px_-18px_rgba(26,26,46,0.14)] backdrop-blur-md before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/90 before:to-transparent";

function ChatHeader({ title }: { title: string }) {
  return (
    <header className="shrink-0 border-b border-sky/[0.08] px-3.5 pb-3 pt-3.5">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-flame/12 to-sky/10 ring-1 ring-sky/10"
          aria-hidden
        >
          <IconSparkles className="h-[18px] w-[18px] text-flame" stroke={1.5} />
        </div>
        <div className="min-w-0 flex-1 border-l border-sky/15 pl-2.5">
          <h3 className="truncate font-display text-[0.8125rem] font-semibold tracking-tight text-dark">
            {title}
          </h3>
        </div>
      </div>
    </header>
  );
}

function SelectionStrip({
  selectedText,
  onExplain,
  onClear,
}: {
  selectedText: string;
  onExplain: () => void;
  onClear: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-sky/[0.08] bg-gradient-to-r from-sky/[0.07] to-transparent px-3 py-2.5">
      <p className="line-clamp-2 font-body text-[11px] leading-relaxed text-dark/75">
        &ldquo;{selectedText}&rdquo;
      </p>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onExplain}
          className="rounded-md bg-flame/12 px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-wider text-flame transition-colors hover:bg-flame/20"
        >
          Explain
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md p-1 text-dark/35 transition-colors hover:bg-dark/[0.05] hover:text-dark/55"
          aria-label="Dismiss selection"
        >
          <IconX className="h-3.5 w-3.5" stroke={1.5} />
        </button>
      </div>
    </div>
  );
}

function StarterPills({
  questions,
  disabled,
  onPick,
}: {
  questions: string[];
  disabled: boolean;
  onPick: (q: string) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="shrink-0 border-b border-sky/[0.08] px-3 py-2.5">
      <div className="flex flex-wrap gap-1.5">
        {questions.slice(0, 5).map((q, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onPick(q)}
            className="max-w-full rounded-full border border-sky/14 bg-white/50 px-2.5 py-1 text-left font-body text-[10px] leading-snug text-dark/75 shadow-sm transition-all hover:border-sky/35 hover:bg-white/90 disabled:opacity-40"
          >
            <span className="line-clamp-2">{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={
          isUser
            ? "max-w-[min(100%,15.5rem)] rounded-xl border border-dark/[0.06] bg-white/85 px-3 py-2 shadow-[0_2px_8px_-2px_rgba(26,26,46,0.08)]"
            : "max-w-[min(100%,16.5rem)] border-l-[3px] border-sky/45 pl-3 pr-1 py-1"
        }
      >
        <div
          className={`whitespace-pre-wrap font-body text-[12.5px] leading-[1.45] ${isUser ? "text-dark" : "text-dark/90"}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function TypingPulse() {
  return (
    <div className="flex justify-start pl-0.5">
      <div className="flex items-center gap-1 rounded-lg border border-sky/12 bg-white/60 px-3 py-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1 w-1 rounded-full bg-sky/55"
            animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: i * 0.14,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ChatComposer({
  chatVoice,
  onVoiceChange,
  inputValue,
  onInputChange,
  onSubmit,
  disabled,
  placeholder,
}: {
  chatVoice: ChatVoiceId;
  onVoiceChange: (v: ChatVoiceId) => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 border-t border-sky/[0.1] bg-gradient-to-t from-cream/20 to-transparent p-3 pt-3"
    >
      <div className="rounded-xl border border-sky/14 bg-white/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-dark/[0.03]">
        <div className="flex items-center gap-2 border-b border-sky/[0.08] px-2 py-1.5">
          <span
            className="shrink-0 font-display text-[8px] font-semibold uppercase tracking-[0.2em] text-dark/30"
            id="chat-voice-label"
          >
            Voice
          </span>
          <select
            aria-labelledby="chat-voice-label"
            value={chatVoice}
            onChange={(e) => onVoiceChange(e.target.value as ChatVoiceId)}
            className="min-w-0 flex-1 cursor-pointer appearance-none rounded-md border-0 bg-transparent py-0.5 pl-1 pr-6 font-body text-[11px] text-dark/80 focus:outline-none focus:ring-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.15rem center",
            }}
          >
            {CHAT_VOICE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-1.5 p-1.5">
          <input
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[2.25rem] min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 font-body text-[13px] text-dark placeholder:text-dark/28 focus:outline-none"
          />
          <button
            type="submit"
            disabled={disabled || !inputValue.trim()}
            className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky to-sky-dark text-white shadow-md shadow-sky/25 transition-all hover:shadow-lg hover:shadow-sky/30 disabled:pointer-events-none disabled:opacity-25"
            aria-label="Send"
          >
            <IconSend
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              stroke={1.75}
            />
          </button>
        </div>
      </div>
    </form>
  );
}

function MessagesScroll({
  messagesEndRef,
  children,
}: {
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div className="flex flex-col gap-2.5">{children}</div>
      <div ref={messagesEndRef} className="h-1 shrink-0" />
    </div>
  );
}

function OllamaChatPanel({
  documentText,
  onNewAnnotations,
  pendingInject,
  onPendingInjectConsumed,
}: {
  documentText: string;
  onNewAnnotations?: (annotations: Annotation[]) => void;
  pendingInject?: string | null;
  onPendingInjectConsumed?: () => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedText, setSelectedText] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [chatVoice, setChatVoice] = useState<ChatVoiceId>(DEFAULT_CHAT_VOICE);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: { documentText, chatVoice },
      }),
    [documentText, chatVoice],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onFinish: ({ message }) => {
      try {
        const text = getMessageText(
          message.parts as Array<{ type: string; text?: string }>,
        );
        const parsed = JSON.parse(text) as { annotations?: Annotation[] };
        if (parsed.annotations && onNewAnnotations) {
          onNewAnnotations(parsed.annotations);
        }
      } catch {
        // Regular text response
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (!pendingInject?.trim() || isLoading) return;
    const msg = pendingInject.trim();
    onPendingInjectConsumed?.();
    sendMessage({ text: msg });
  }, [pendingInject, isLoading, sendMessage, onPendingInjectConsumed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) {
        setSelectedText(sel.toString().trim());
      }
    };
    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, []);

  const handleSend = (text?: string) => {
    const msg = text ?? inputValue;
    if (!msg.trim() || isLoading) return;
    sendMessage({ text: msg.trim() });
    setInputValue("");
  };

  const handleExplain = () => {
    if (!selectedText) return;
    handleSend(`Explain this: "${selectedText}"`);
    setSelectedText("");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className={SURFACE}>
      <ChatHeader title="Study Buddy" />
      {selectedText && (
        <SelectionStrip
          selectedText={selectedText}
          onExplain={handleExplain}
          onClear={() => setSelectedText("")}
        />
      )}
      <MessagesScroll messagesEndRef={messagesEndRef}>
        {messages.map((msg) => {
          const text = getMessageText(
            msg.parts as Array<{ type: string; text?: string }>,
          );
          return (
            <MessageBubble
              key={msg.id}
              role={msg.role === "user" ? "user" : "assistant"}
            >
              {text}
            </MessageBubble>
          );
        })}
        {isLoading && <TypingPulse />}
      </MessagesScroll>
      <ChatComposer
        chatVoice={chatVoice}
        onVoiceChange={setChatVoice}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleFormSubmit}
        disabled={isLoading}
        placeholder="Message…"
      />
    </div>
  );
}

function OpenPaperChatPanel({
  documentId,
  starterQuestions,
  pendingInject,
  onPendingInjectConsumed,
}: {
  documentId: string;
  starterQuestions: string[];
  pendingInject?: string | null;
  onPendingInjectConsumed?: () => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedText, setSelectedText] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [chatVoice, setChatVoice] = useState<ChatVoiceId>(DEFAULT_CHAT_VOICE);
  const [opMessages, setOpMessages] = useState<SimpleMsg[]>([]);
  const [opLoading, setOpLoading] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [opMessages, opLoading]);

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) {
        setSelectedText(sel.toString().trim());
      }
    };
    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, []);

  const sendOpenPaperMessage = useCallback(
    async (text: string) => {
      const userMsg: SimpleMsg = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };
      setOpMessages((m) => [...m, userMsg]);
      setOpLoading(true);
      const assistantId = `a-${Date.now()}`;
      setOpMessages((m) => [
        ...m,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        const res = await fetch("/api/openpaper/chat/paper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, userQuery: text, chatVoice }),
        });

        if (!res.ok) {
          const err = await res.text();
          setOpMessages((m) =>
            m.map((x) =>
              x.id === assistantId
                ? { ...x, content: `Error: ${err.slice(0, 400)}` }
                : x,
            ),
          );
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        const parser = createOpenPaperStreamParser(
          (chunk: OpenPaperStreamChunk) => {
            if (chunk.type === "content" && typeof chunk.content === "string") {
              setOpMessages((m) =>
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
        setOpMessages((m) =>
          m.map((x) =>
            x.id === assistantId
              ? {
                  ...x,
                  content:
                    e instanceof Error ? e.message : "Open Paper chat failed.",
                }
              : x,
          ),
        );
      } finally {
        setOpLoading(false);
      }
    },
    [documentId, chatVoice],
  );

  useEffect(() => {
    if (!pendingInject?.trim() || opLoading) return;
    const msg = pendingInject.trim();
    onPendingInjectConsumed?.();
    void sendOpenPaperMessage(msg);
  }, [pendingInject, opLoading, sendOpenPaperMessage, onPendingInjectConsumed]);

  const handleSend = (text?: string) => {
    const msg = text ?? inputValue;
    if (!msg.trim() || opLoading) return;
    void sendOpenPaperMessage(msg.trim());
    setInputValue("");
  };

  const handleExplain = () => {
    if (!selectedText) return;
    handleSend(`Explain this: "${selectedText}"`);
    setSelectedText("");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className={SURFACE}>
      <ChatHeader title="Open Paper" />
      <StarterPills
        questions={starterQuestions}
        disabled={opLoading}
        onPick={(q) => handleSend(q)}
      />
      {selectedText && (
        <SelectionStrip
          selectedText={selectedText}
          onExplain={handleExplain}
          onClear={() => setSelectedText("")}
        />
      )}
      <MessagesScroll messagesEndRef={messagesEndRef}>
        {opMessages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role}>
            {msg.content}
          </MessageBubble>
        ))}
        {opLoading && <TypingPulse />}
      </MessagesScroll>
      <ChatComposer
        chatVoice={chatVoice}
        onVoiceChange={setChatVoice}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleFormSubmit}
        disabled={opLoading}
        placeholder="Message…"
      />
    </div>
  );
}

export function Chatbot({
  documentText,
  onNewAnnotations,
  documentId,
  useOpenPaper = false,
  starterQuestions = [],
  pendingInject,
  onPendingInjectConsumed,
}: ChatbotProps) {
  if (useOpenPaper && documentId) {
    return (
      <OpenPaperChatPanel
        documentId={documentId}
        starterQuestions={starterQuestions}
        pendingInject={pendingInject}
        onPendingInjectConsumed={onPendingInjectConsumed}
      />
    );
  }

  return (
    <OllamaChatPanel
      documentText={documentText}
      onNewAnnotations={onNewAnnotations}
      pendingInject={pendingInject}
      onPendingInjectConsumed={onPendingInjectConsumed}
    />
  );
}
