"use server";

import { db } from "@my-better-t-app/db";
import { entries, products } from "@my-better-t-app/db/schema/budda";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { embedText } from "@/lib/gemini/embed";
import { extractTextFromFile } from "@/lib/gemini/extract";
import { getSupabaseAdmin, STORAGE_BUCKETS } from "@/lib/supabase/server";

import { getSessionUserId } from "./session";

const ENTRY_TYPES = [
  "PRD",
  "Research",
  "Design",
  "Tech Spec",
  "Change Log",
  "AI Chat",
  "Link",
  "Image",
  "Meeting Notes",
  "Spec",
  "Other",
] as const;

const SOURCES = [
  "Manual",
  "Figma",
  "ChatGPT",
  "Claude",
  "Perplexity",
  "YouTube",
  "Google Drive",
  "Website",
  "Image",
] as const;

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const fieldsSchema = z.object({
  productId: z.uuid(),
  title: z.string().trim().min(1).max(300),
  context: z.string().max(5_000).optional(),
  entryType: z.enum(ENTRY_TYPES).optional().default("Other"),
  source: z.enum(SOURCES).optional().default("Manual"),
});

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export async function uploadEntry(formData: FormData): Promise<
  ActionResult<{
    entry: typeof entries.$inferSelect;
    bucket: string;
    filePath: string;
    extraction: { ok: true } | { ok: false; error: string | null };
    embedding: { ok: true } | { ok: false; error: string | null };
  }>
> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "Unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Missing file" };
  if (file.size === 0) return { ok: false, error: "File is empty" };
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `File exceeds ${MAX_FILE_BYTES / 1024 / 1024} MB limit`,
    };
  }

  const parsed = fieldsSchema.safeParse({
    productId: formData.get("productId"),
    title: formData.get("title"),
    context: formData.get("context") ?? undefined,
    entryType: formData.get("entryType") ?? undefined,
    source: formData.get("source") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { productId, title, context, entryType, source } = parsed.data;

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);

  if (!product) return { ok: false, error: "Product not found" };

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const mimeType = file.type || "application/octet-stream";

  const isImage = mimeType.startsWith("image/");
  const bucket = isImage ? STORAGE_BUCKETS.images : STORAGE_BUCKETS.documents;
  const objectPath = `${userId}/${productId}/${Date.now()}-${safeFileName(file.name)}`;

  const supabase = getSupabaseAdmin();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectPath, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    console.error("Supabase upload error:", uploadError);
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  let content: string | null = null;
  let extractionError: string | null = null;
  try {
    content = await extractTextFromFile({ base64, mimeType });
  } catch (err) {
    extractionError = err instanceof Error ? err.message : "Extraction failed";
    console.error("Gemini extraction failed:", err);
  }

  let embedding: number[] | null = null;
  let embeddingError: string | null = null;
  if (content && content.trim().length > 10) {
    try {
      embedding = await embedText(content);
    } catch (err) {
      embeddingError = err instanceof Error ? err.message : "Embedding failed";
      console.error("Embedding failed:", err);
    }
  }

  const contentHash = content ? sha256(content) : null;

  const [created] = await db
    .insert(entries)
    .values({
      productId,
      userId,
      title,
      content,
      context: context?.trim() || null,
      entryType: isImage && entryType === "Other" ? "Image" : entryType,
      source: isImage && source === "Manual" ? "Image" : source,
      filePath: objectPath,
      fileName: file.name,
      fileType: mimeType,
      contentHash,
      embedding,
    })
    .returning();

  revalidatePath(`/products/${productId}`);

  return {
    ok: true,
    data: {
      entry: created,
      bucket,
      filePath: objectPath,
      extraction: content ? { ok: true } : { ok: false, error: extractionError },
      embedding: embedding ? { ok: true } : { ok: false, error: embeddingError },
    },
  };
}
