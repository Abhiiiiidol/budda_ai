"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadEntry } from "@/lib/actions/upload";
import { ENTRY_TYPES, type EntryType } from "@/lib/constants/sources";

const ACCEPT = ".pdf,.doc,.docx,.txt,.csv,.pptx,.xlsx,application/pdf";

function defaultTypeFor(filename: string): EntryType {
  const lower = filename.toLowerCase();
  if (lower.includes("prd")) return "PRD";
  if (lower.includes("research")) return "Research";
  if (lower.includes("tech") || lower.includes("spec")) return "Tech Spec";
  if (lower.includes("meeting") || lower.includes("notes")) return "Meeting Notes";
  if (lower.includes("changelog") || lower.includes("change-log")) return "Change Log";
  return "Other";
}

export default function DocumentUpload({ productId }: { productId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("Other");
  const [context, setContext] = useState("");
  const [isPending, startTransition] = useTransition();

  function onFileChange(f: File | null) {
    setFile(f);
    if (f && !title) {
      const base = f.name.replace(/\.[^.]+$/, "");
      setTitle(base);
      setEntryType(defaultTypeFor(f.name));
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Choose a file first");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);
    formData.append("title", title.trim());
    formData.append("entryType", entryType);
    formData.append("source", "Manual");
    if (context.trim()) formData.append("context", context.trim());

    startTransition(async () => {
      const result = await uploadEntry(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const ex = result.data.extraction;
      if (!ex.ok) {
        toast.warning(
          `Saved, but text extraction failed${ex.error ? `: ${ex.error}` : ""}`,
        );
      } else {
        toast.success("Budda has read your document");
      }
      setFile(null);
      setTitle("");
      setEntryType("Other");
      setContext("");
      router.push(`/products/${productId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="doc-file">File</Label>
        <Input
          id="doc-file"
          type="file"
          accept={ACCEPT}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <p className="text-[11px] text-muted-foreground">
          PDF, DOCX, TXT, CSV, PPTX, XLSX · max 25 MB
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="doc-title">Title</Label>
        <Input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is this document?"
          required
          maxLength={300}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="doc-type">Type</Label>
        <select
          id="doc-type"
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
        <Label htmlFor="doc-context">💡 Context note (optional)</Label>
        <textarea
          id="doc-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Why does this matter? How did it shape decisions?"
          maxLength={5000}
          rows={3}
          className="rounded-none border bg-background px-2 py-1.5 text-xs leading-relaxed"
        />
      </div>

      <Button type="submit" disabled={isPending || !file}>
        <UploadIcon />
        {isPending ? "Budda is reading your document…" : "Feed to Budda"}
      </Button>
    </form>
  );
}
