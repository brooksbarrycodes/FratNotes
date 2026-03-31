"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { IconSend, IconSparkles, IconX } from "@tabler/icons-react";
import type { Annotation } from "~/components/document-editor";

interface ChatbotProps {
  documentText: string;
  onNewAnnotations?: (annotations: Annotation[]) => void;
}

function getMessageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
}

export function Chatbot({ documentText, onNewAnnotations }: ChatbotProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedText, setSelectedText] = useState("");
  const [inputValue, setInputValue] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: { documentText },
      }),
    [documentText],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onFinish: ({ message }) => {
      try {
        const text = getMessageText(message.parts as Array<{ type: string; text?: string }>);
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    <div className="flex h-full flex-col rounded-2xl border border-sky/10 bg-white/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-sky/10 px-4 py-3">
        <IconSparkles className="h-4 w-4 text-flame" />
        <h3 className="font-display text-sm font-semibold text-dark">
          Study Buddy
        </h3>
      </div>

      {selectedText && (
        <div className="border-b border-sky/10 bg-sky/5 px-4 py-2">
          <div className="flex items-center justify-between">
            <p className="line-clamp-1 font-body text-xs text-dark/60">
              Selected: &ldquo;{selectedText}&rdquo;
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={handleExplain}
                className="rounded-md bg-flame/10 px-2 py-0.5 font-body text-xs font-medium text-flame transition-colors hover:bg-flame/20"
              >
                Explain
              </button>
              <button
                onClick={() => setSelectedText("")}
                className="rounded-md p-0.5 text-dark/30 hover:text-dark/60"
              >
                <IconX className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 text-3xl">💬</div>
            <p className="mb-1 font-display text-sm font-semibold text-dark/60">
              Ask me anything
            </p>
            <p className="font-body text-xs text-dark/40">
              About your study material, or select text and click
              &ldquo;Explain&rdquo;
            </p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg) => {
            const text = getMessageText(msg.parts as Array<{ type: string; text?: string }>);
            return (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    msg.role === "user"
                      ? "bg-flame/10 text-dark"
                      : "bg-sky/10 text-dark"
                  }`}
                >
                  <p className="whitespace-pre-wrap font-body text-sm leading-relaxed">
                    {text}
                  </p>
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl bg-sky/10 px-4 py-3">
                <div className="h-2 w-2 animate-bounce rounded-full bg-sky/50" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-sky/50 [animation-delay:0.15s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-sky/50 [animation-delay:0.3s]" />
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleFormSubmit}
        className="border-t border-sky/10 px-3 py-3"
      >
        <div className="flex items-center gap-2 rounded-xl bg-cream/50 px-3 py-1.5 ring-1 ring-sky/10 focus-within:ring-sky/30">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about your notes..."
            className="flex-1 bg-transparent font-body text-sm text-dark placeholder:text-dark/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="rounded-lg bg-sky p-1.5 text-white transition-all hover:bg-sky-dark disabled:opacity-30"
          >
            <IconSend className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
