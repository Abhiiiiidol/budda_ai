"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import { SendIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { askProduct } from "@/lib/actions/ask";

import ChatMessage from "./chat-message";
import SuggestedPrompts from "./suggested-prompts";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const HISTORY_LIMIT = 20;

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function ChatInterface({
  productId,
  initialMessages,
}: {
  productId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, isPending]);

  function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: trimmed,
    };

    const historyForServer = messages
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    startTransition(async () => {
      const result = await askProduct({
        productId,
        question: trimmed,
        history: historyForServer,
      });

      if (!result.ok) {
        toast.error(result.error);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInput(trimmed);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: genId(),
          role: "assistant",
          content: result.data.answer,
        },
      ]);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    send(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isPending) send(input);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-background/40 p-4"
      >
        {messages.length === 0 ? (
          <SuggestedPrompts onPick={(p) => send(p)} disabled={isPending} />
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id}>
                <ChatMessage role={m.role} content={m.content} />
              </li>
            ))}
            {isPending ? (
              <li>
                <div className="flex gap-2">
                  <div
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-base ring-1 ring-foreground/10"
                    aria-hidden
                  >
                    🧘
                  </div>
                  <div className="rounded-md border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
                    Budda is thinking
                    <span className="ml-1 inline-block animate-pulse">…</span>
                  </div>
                </div>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything about this product…"
          rows={2}
          maxLength={5000}
          disabled={isPending}
          aria-label="Ask Budda a question"
          className="min-h-[42px] flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-60"
        />
        <Button type="submit" disabled={isPending || !input.trim()} size="lg">
          <SendIcon />
          {isPending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
