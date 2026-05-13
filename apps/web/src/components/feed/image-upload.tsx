"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadEntry } from "@/lib/actions/upload";

const ACCEPT = "image/png,image/jpeg,image/jpg,image/gif,image/webp";

export default function ImageUpload({ productId }: { productId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onFileChange(f: File | null) {
    setFile(f);
    if (f && !title) {
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Choose an image first");
    if (!title.trim()) return toast.error("Title is required");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("productId", productId);
    formData.append("title", title.trim());
    formData.append("entryType", "Image");
    formData.append("source", "Image");
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
          `Image saved, but vision extraction failed${ex.error ? `: ${ex.error}` : ""}`,
        );
      } else {
        toast.success("Budda has seen your image");
      }
      setFile(null);
      setTitle("");
      setContext("");
      router.push(`/products/${productId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="img-file">Image</Label>
        <Input
          id="img-file"
          type="file"
          accept={ACCEPT}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <p className="text-[11px] text-muted-foreground">PNG, JPG, GIF, WebP · max 25 MB</p>
      </div>

      {previewUrl ? (
        <div className="rounded-sm border bg-background p-2">
          {/* Use plain img to avoid Next/Image domain config for object-url previews */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Preview"
            className="mx-auto max-h-64 object-contain"
          />
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="img-title">Title</Label>
        <Input
          id="img-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What does this image show?"
          required
          maxLength={300}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="img-context">💡 Context note (optional)</Label>
        <textarea
          id="img-context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Where is this from? What decision did it inform?"
          maxLength={5000}
          rows={3}
          className="rounded-none border bg-background px-2 py-1.5 text-xs leading-relaxed"
        />
      </div>

      <Button type="submit" disabled={isPending || !file}>
        <ImageIcon />
        {isPending ? "Budda is looking at your image…" : "Feed to Budda"}
      </Button>
    </form>
  );
}
