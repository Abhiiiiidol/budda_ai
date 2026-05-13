"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createEntry } from "@/lib/actions/entries";
import {
  ENTRY_TYPES,
  SOURCE_CONFIG,
  type EntryType,
  type Source,
} from "@/lib/constants/sources";
import { detectLink } from "@/lib/utils/detect-link";

export default function LinkInput({ productId }: { productId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [context, setContext] = useState("");
  const [source, setSource] = useState<Source>("Website");
  const [entryType, setEntryType] = useState<EntryType>("Link");
  const [autoDetected, setAutoDetected] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onUrlChange(next: string) {
    setUrl(next);
    if (next.startsWith("http")) {
      const detected = detectLink(next);
      setSource(detected.source);
      setEntryType(detected.entryType);
      setAutoDetected(true);
    } else {
      setAutoDetected(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return toast.error("URL is required");
    if (!title.trim()) return toast.error("Title is required");

    startTransition(async () => {
      const result = await createEntry({
        productId,
        title: title.trim(),
        content: notes.trim() || undefined,
        context: context.trim() || undefined,
        entryType,
        source,
        link: url.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Link added to Budda's memory");
      setUrl("");
      setTitle("");
      setNotes("");
      setContext("");
      setAutoDetected(false);
      router.push(`/products/${productId}`);
    });
  }

  const sourceCfg = SOURCE_CONFIG[source];

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="link-url">URL</Label>
        <Input
          id="link-url"
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://figma.com/file/... or any link"
          required
          maxLength={2000}
        />
        {autoDetected ? (
          <p className="text-[11px] text-muted-foreground">
            Detected:{" "}
            <span
              className="inline-flex h-4 items-center gap-1 rounded-sm px-1.5 align-middle"
              style={{ color: sourceCfg.color, backgroundColor: sourceCfg.bg }}
            >
              <span>{sourceCfg.icon}</span>
              <span>{source}</span>
            </span>{" "}
            · {entryType}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="link-title">Title</Label>
        <Input
          id="link-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is this link?"
          required
          maxLength={300}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="link-type">Type</Label>
          <select
            id="link-type"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as EntryType)}
            className="h-8 rounded-none border bg-background px-2 text-xs"
          >
            {ENTRY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="link-source">Source</Label>
          <select
            id="link-source"
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
            className="h-8 rounded-none border bg-background px-2 text-xs"
          >
            {Object.keys(SOURCE_CONFIG).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="link-notes">Notes (optional)</Label>
        <textarea
          id="link-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional notes about this link"
          maxLength={500_000}
          rows={3}
          className="rounded-none border bg-background px-2 py-1.5 text-xs leading-relaxed"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="link-context">💡 Context note (optional)</Label>
        <textarea
          id="link-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Why does this matter?"
          maxLength={5000}
          rows={2}
          className="rounded-none border bg-background px-2 py-1.5 text-xs leading-relaxed"
        />
      </div>

      <Button type="submit" disabled={isPending}>
        <LinkIcon />
        {isPending ? "Saving link…" : "Feed to Budda"}
      </Button>
    </form>
  );
}
