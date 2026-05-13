"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { CloudIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { importFromDrive } from "@/lib/actions/drive";
import { ENTRY_TYPES, type EntryType } from "@/lib/constants/sources";

export default function DriveInput({ productId }: { productId: string }) {
  const router = useRouter();
  const [fileUrl, setFileUrl] = useState("");
  const [title, setTitle] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("Other");
  const [context, setContext] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileUrl.trim()) return toast.error("Drive URL is required");

    startTransition(async () => {
      const result = await importFromDrive({
        fileUrl: fileUrl.trim(),
        productId,
        title: title.trim() || undefined,
        context: context.trim() || undefined,
        entryType,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Budda has read "${result.data.entry.title}" from Drive`);
      setFileUrl("");
      setTitle("");
      setContext("");
      router.push(`/products/${productId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="drive-url">Google Drive URL</Label>
        <Input
          id="drive-url"
          type="url"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://docs.google.com/document/d/..."
          required
          maxLength={2000}
        />
        <p className="text-[11px] text-muted-foreground">
          Budda will auto-read this document using your connected Google account. Supports
          Docs, Sheets, Slides, and PDFs.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="drive-title">Title (optional)</Label>
        <Input
          id="drive-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Leave blank to use the Drive file name"
          maxLength={300}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="drive-type">Type</Label>
        <select
          id="drive-type"
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
        <Label htmlFor="drive-context">💡 Context note (optional)</Label>
        <textarea
          id="drive-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Why does this matter?"
          maxLength={5000}
          rows={3}
          className="rounded-none border bg-background px-2 py-1.5 text-xs leading-relaxed"
        />
      </div>

      <Button type="submit" disabled={isPending}>
        <CloudIcon />
        {isPending ? "Budda is reading from Drive…" : "Import from Drive"}
      </Button>
    </form>
  );
}
