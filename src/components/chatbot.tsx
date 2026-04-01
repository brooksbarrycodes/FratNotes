"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, useReducedMotion } from "motion/react";
import {
  IconChevronDown,
  IconCpu,
  IconSend,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import type { Annotation } from "~/components/document-editor";
import { env } from "~/env";
import {
  createOpenPaperStreamParser,
  type OpenPaperStreamChunk,
} from "~/lib/openpaper-stream";
import {
  CHAT_VOICE_OPTIONS,
  DEFAULT_CHAT_VOICE,
  type ChatVoiceId,
} from "~/lib/chat-voice";
import { extractChatAnnotations } from "~/lib/annotations-schema";

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
  "chat-panel-surface relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-sky/18 shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_28px_70px_-28px_rgba(26,26,46,0.16)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent";

const CHAT_BACKEND_LABEL =
  env.NEXT_PUBLIC_AI_CHAT_LABEL?.trim() || "Study assistant";

function ChatHeader({
  title,
  subtitle,
  backendLabel = CHAT_BACKEND_LABEL,
}: {
  title: string;
  subtitle?: string;
  /** Shown under title; defaults from NEXT_PUBLIC_AI_CHAT_LABEL or "Study assistant". */
  backendLabel?: string;
}) {
  return (
    <header className="shrink-0 border-b border-sky/10 px-4 pb-3.5 pt-4">
      <div className="flex items-start gap-3">
        <div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-sky/25 via-white to-flame/15 ring-1 ring-sky/20 shadow-[0_8px_24px_-8px_rgba(91,168,217,0.45)]"
          aria-hidden
        >
          <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-80" />
          <IconSparkles
            className="relative h-[22px] w-[22px] text-flame-dark"
            stroke={1.5}
          />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-[0.9375rem] font-semibold tracking-tight text-dark">
              {title}
            </h3>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky/20 bg-white/70 px-2 py-0.5 font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-dark">
              <span className="h-1 w-1 rounded-full bg-sky shadow-[0_0_0_3px_rgba(135,206,250,0.35)]" />
              Live
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-body text-[11px] leading-snug text-dark/55">
            <span className="inline-flex items-center gap-1">
              <IconCpu className="h-3.5 w-3.5 text-sky-dark/80" stroke={1.5} />
              {backendLabel}
            </span>
            {subtitle ? (
              <>
                <span className="text-dark/25" aria-hidden>
                  ·
                </span>
                <span>{subtitle}</span>
              </>
            ) : null}
          </p>
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
    <div className="shrink-0 border-b border-sky/10 bg-gradient-to-r from-sky/[0.08] via-white/40 to-transparent px-4 py-3">
      <p className="line-clamp-2 font-body text-[12px] leading-relaxed text-dark/80">
        &ldquo;{selectedText}&rdquo;
      </p>
      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onExplain}
          className="cursor-pointer rounded-xl bg-gradient-to-r from-flame/15 to-flame/10 px-3 py-1.5 font-display text-[10px] font-semibold uppercase tracking-wider text-flame-dark shadow-sm ring-1 ring-flame/15 transition-all duration-200 hover:from-flame/25 hover:to-flame/15 hover:ring-flame/25"
        >
          Explain
        </button>
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer rounded-lg p-1.5 text-dark/40 transition-colors duration-200 hover:bg-dark/[0.06] hover:text-dark/65"
          aria-label="Dismiss selection"
        >
          <IconX className="h-4 w-4" stroke={1.5} />
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
    <div className="shrink-0 border-b border-sky/10 px-4 py-3">
      <p className="mb-2 font-display text-[9px] font-semibold uppercase tracking-[0.16em] text-dark/40">
        Try asking
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.slice(0, 5).map((q, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onPick(q)}
            className="max-w-full cursor-pointer rounded-xl border border-sky/18 bg-white/75 px-3 py-1.5 text-left font-body text-[11px] leading-snug text-dark/80 shadow-[0_2px_12px_-4px_rgba(26,26,46,0.12)] ring-1 ring-white/80 transition-all duration-200 hover:border-sky/40 hover:bg-white hover:shadow-[0_4px_16px_-4px_rgba(91,168,217,0.2)] disabled:pointer-events-none disabled:opacity-40"
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
            ? "max-w-[min(100%,19rem)] rounded-2xl border border-dark/[0.07] bg-white/90 px-3.5 py-2.5 shadow-[0_4px_20px_-6px_rgba(26,26,46,0.1)] ring-1 ring-white/90"
            : "max-w-[min(100%,20rem)] rounded-2xl border border-sky/15 bg-white/80 px-3.5 py-2.5 shadow-[0_4px_24px_-8px_rgba(91,168,217,0.15)] ring-1 ring-sky/10 backdrop-blur-sm"
        }
      >
        <div
          className={`whitespace-pre-wrap font-body text-[13px] leading-[1.5] ${isUser ? "text-dark" : "text-dark/[0.92]"}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function TypingPulse() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl border border-sky/14 bg-white/85 px-4 py-2.5 shadow-sm ring-1 ring-sky/10 backdrop-blur-sm">
        {[0, 1, 2].map((i) =>
          reduceMotion ? (
            <span
              key={i}
              className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-sky-dark/50"
            />
          ) : (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-sky-dark/55"
              animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
              transition={{
                duration: 0.85,
                repeat: Infinity,
                delay: i * 0.12,
                ease: "easeInOut",
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}

function VoiceMenu({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: ChatVoiceId;
  onChange: (v: ChatVoiceId) => void;
  disabled: boolean;
  labelledBy: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = "chat-voice-listbox";
  const selected =
    CHAT_VOICE_OPTIONS.find((o) => o.id === value) ?? CHAT_VOICE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="relative min-w-0 flex-1" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        id="chat-voice-trigger"
        aria-labelledby={`${labelledBy} chat-voice-trigger`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-sky/16 bg-white/85 px-3 py-2 text-left font-body text-[12px] font-medium text-dark/90 shadow-sm ring-1 ring-white/90 transition-all duration-200 hover:border-sky/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/50 disabled:pointer-events-none disabled:opacity-40"
      >
        <span className="truncate">{selected.label}</span>
        <IconChevronDown
          className={`h-4 w-4 shrink-0 text-sky-dark/70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          stroke={1.75}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-[min(14rem,40vh)] overflow-y-auto rounded-xl border border-sky/18 bg-white/95 py-1 shadow-[0_20px_50px_-20px_rgba(26,26,46,0.25)] ring-1 ring-sky/10 backdrop-blur-md chat-scroll"
        >
          {CHAT_VOICE_OPTIONS.map((o) => {
            const isOn = o.id === value;
            return (
              <li key={o.id} role="none" className="px-1">
                <button
                  type="button"
                  role="option"
                  aria-selected={isOn}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer rounded-lg px-2.5 py-2 text-left font-body text-[12px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 focus-visible:ring-inset ${
                    isOn
                      ? "bg-sky/12 font-semibold text-dark"
                      : "text-dark/80 hover:bg-sky/[0.07]"
                  }`}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
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
  const voiceLabelId = "chat-personality-label";
  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 border-t border-sky/12 bg-gradient-to-t from-cream/25 via-white/30 to-transparent p-4 pt-3"
    >
      <div className="rounded-2xl border border-sky/16 bg-white/50 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_12px_40px_-24px_rgba(26,26,46,0.12)] ring-1 ring-white/70 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span
            className="shrink-0 px-1 font-display text-[9px] font-semibold uppercase tracking-[0.18em] text-dark/45"
            id={voiceLabelId}
          >
            Personality
          </span>
          <VoiceMenu
            value={chatVoice}
            onChange={onVoiceChange}
            disabled={disabled}
            labelledBy={voiceLabelId}
          />
        </div>
        <div className="mt-2 flex items-end gap-2 rounded-xl border border-sky/12 bg-white/70 p-1.5 pl-2 ring-1 ring-dark/[0.02]">
          <input
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[2.5rem] min-w-0 flex-1 border-0 bg-transparent px-2 py-2 font-body text-[14px] text-dark placeholder:text-dark/30 focus:outline-none focus:ring-0"
          />
          <button
            type="submit"
            disabled={disabled || !inputValue.trim()}
            className="group flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-sky via-sky to-sky-dark text-white shadow-lg shadow-sky/30 transition-all duration-200 hover:shadow-xl hover:shadow-sky/35 disabled:pointer-events-none disabled:opacity-25"
            aria-label="Send"
          >
            <IconSend
              className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:h-5 sm:w-5"
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
    <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <div className="flex flex-col gap-3">{children}</div>
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
        credentials: "include",
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
        const parsed = JSON.parse(text) as { annotations?: unknown };
        const extracted = extractChatAnnotations(parsed.annotations);
        if (extracted.length > 0 && onNewAnnotations) {
          onNewAnnotations(extracted);
        }
      } catch {
        // Regular text response
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const sendMessageRef = useRef(sendMessage);
  const onPendingConsumedRef = useRef(onPendingInjectConsumed);
  sendMessageRef.current = sendMessage;
  onPendingConsumedRef.current = onPendingInjectConsumed;

  useEffect(() => {
    if (!pendingInject?.trim() || isLoading) return;
    const msg = pendingInject.trim();
    onPendingConsumedRef.current?.();
    sendMessageRef.current({ text: msg });
  }, [pendingInject, isLoading]);

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
      <ChatHeader
        title="Study Buddy"
        subtitle="Answers use your PDF text"
        backendLabel={CHAT_BACKEND_LABEL}
      />
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

  const sendOpenPaperRef = useRef(sendOpenPaperMessage);
  const onOpenPaperPendingConsumedRef = useRef(onPendingInjectConsumed);
  sendOpenPaperRef.current = sendOpenPaperMessage;
  onOpenPaperPendingConsumedRef.current = onPendingInjectConsumed;

  useEffect(() => {
    if (!pendingInject?.trim() || opLoading) return;
    const msg = pendingInject.trim();
    onOpenPaperPendingConsumedRef.current?.();
    void sendOpenPaperRef.current(msg);
  }, [pendingInject, opLoading]);

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
      <ChatHeader
        title="Open Paper"
        subtitle="Full-paper reasoning & citations"
      />
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
