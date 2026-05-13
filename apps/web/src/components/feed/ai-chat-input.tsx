"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { MessageSquareIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createEntry } from "@/lib/actions/entries";
import { SOURCE_CONFIG } from "@/lib/constants/sources";

const AI_SOURCES = ["ChatGPT", "Claude", "Perplexity"] as const;
type AiSource = (typeof AI_SOURCES)[number];

export default function AiChatInput({ productId }: { productId: string }) {
  const router = useRouter();
  const [source, setSource] = useState<AiSource>("ChatGPT");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [context, setContext] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    if (!content.trim()) return toast.error("Paste the AI conversation");

    startTransition(async () => {
      const result = await createEntry({
        productId,
        title: title.trim(),
        content: content.trim(),
        context: context.trim() || undefined,
        entryType: "AI Chat",
        source,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${source} chat saved to Budda's memory`);
      setTitle("");
      setContent("");
      setContext("");
      router.push(`/products/${productId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label>Source</Label>
        <div className="flex gap-2">
          {AI_SOURCES.map((s) => {
            const cfg = SOURCE_CONFIG[s];
            const active = s === source;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={
                  "inline-flex flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-xs font-medium transition-colors " +
                  (active ? "border-foreground" : "border-foreground/10 hover:border-foreground/30")
                }
                style={active ? { color: cfg.color, backgroundColor: cfg.bg } : undefined}
              >
                <span>{cfg.icon}</span>
                <span>{s}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="aichat-title">Title</Label>
        <Input
          id="aichat-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What was this conversation about?"
          required
          maxLength={300}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="aichat-content">Conversation</Label>
        <textarea
          id="aichat-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the AI conversation or output here…"
          maxLength={500_000}
          rows={10}
          required
          className="rounded-none border bg-background px-2 py-1.5 font-mono text-xs leading-relaxed"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="aichat-context">💡 Context note (optional)</Label>
        <textarea
          id="aichat-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="What question were you solving? How was this used?"
          maxLength={5000}
          rows={2}
          className="rounded-none border bg-background px-2 py-1.5 text-xs leading-relaxed"
        />
      </div>

      <Button type="submit" disabled={isPending}>
        <MessageSquareIcon />
        {isPending ? "Saving…" : "Feed to Budda"}
      </Button>
    </form>
  );
}
