"use server";

import { db } from "@my-better-t-app/db";
import { entries, products } from "@my-better-t-app/db/schema/budda";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { GeminiRateLimitError } from "@/lib/gemini/client";
import { embedText } from "@/lib/gemini/embed";

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

const createEntrySchema = z.object({
  productId: z.uuid(),
  title: z.string().trim().min(1).max(300),
  content: z.string().max(500_000).optional(),
  context: z.string().max(5_000).optional(),
  entryType: z.enum(ENTRY_TYPES).default("Other"),
  source: z.enum(SOURCES).default("Manual"),
  link: z.url().max(2_000).optional(),
  filePath: z.string().max(1_000).optional(),
  fileName: z.string().max(500).optional(),
  fileType: z.string().max(200).optional(),
});

export type CreateEntryInput = z.input<typeof createEntrySchema>;

const listEntriesSchema = z.object({
  productId: z.uuid(),
  type: z.string().optional(),
  source: z.string().optional(),
});

export type ListEntriesInput = z.input<typeof listEntriesSchema>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type EntryRow = {
  id: string;
  productId: string;
  title: string;
  content: string | null;
  context: string | null;
  entryType: string;
  source: string;
  link: string | null;
  filePath: string | null;
  fileName: string | null;
  fileType: string | null;
  hasChanges: boolean | null;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function listEntries(
  input: ListEntriesInput,
): Promise<ActionResult<EntryRow[]>> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "Unauthorized" };

  const parsed = listEntriesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { productId, type, source } = parsed.data;
  const filters = [eq(entries.productId, productId), eq(entries.userId, userId)];
  if (type) filters.push(eq(entries.entryType, type));
  if (source) filters.push(eq(entries.source, source));

  const rows = await db
    .select({
      id: entries.id,
      productId: entries.productId,
      title: entries.title,
      content: entries.content,
      context: entries.context,
      entryType: entries.entryType,
      source: entries.source,
      link: entries.link,
      filePath: entries.filePath,
      fileName: entries.fileName,
      fileType: entries.fileType,
      hasChanges: entries.hasChanges,
      status: entries.status,
      createdAt: entries.createdAt,
      updatedAt: entries.updatedAt,
    })
    .from(entries)
    .where(and(...filters))
    .orderBy(desc(entries.createdAt));

  return { ok: true, data: rows };
}

export async function createEntry(input: CreateEntryInput): Promise<
  ActionResult<{
    entry: EntryRow;
    embedding: { ok: true } | { ok: false; error: string | null };
  }>
> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "Unauthorized" };

  const parsed = createEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, parsed.data.productId), eq(products.userId, userId)))
    .limit(1);

  if (!product) return { ok: false, error: "Product not found" };

  const content = parsed.data.content?.trim() || null;
  const contentHash = content ? sha256(content) : null;

  let embedding: number[] | null = null;
  let embeddingError: string | null = null;
  if (content) {
    try {
      embedding = await embedText(content);
    } catch (err) {
      if (err instanceof GeminiRateLimitError) {
        embeddingError = err.message;
      } else {
        embeddingError = err instanceof Error ? err.message : "Embedding failed";
      }
    }
  }

  const [created] = await db
    .insert(entries)
    .values({
      productId: parsed.data.productId,
      userId,
      title: parsed.data.title,
      content,
      context: parsed.data.context?.trim() || null,
      entryType: parsed.data.entryType,
      source: parsed.data.source,
      link: parsed.data.link ?? null,
      filePath: parsed.data.filePath ?? null,
      fileName: parsed.data.fileName ?? null,
      fileType: parsed.data.fileType ?? null,
      contentHash,
      embedding,
    })
    .returning({
      id: entries.id,
      productId: entries.productId,
      title: entries.title,
      content: entries.content,
      context: entries.context,
      entryType: entries.entryType,
      source: entries.source,
      link: entries.link,
      filePath: entries.filePath,
      fileName: entries.fileName,
      fileType: entries.fileType,
      hasChanges: entries.hasChanges,
      status: entries.status,
      createdAt: entries.createdAt,
      updatedAt: entries.updatedAt,
    });

  revalidatePath(`/products/${parsed.data.productId}`);

  return {
    ok: true,
    data: {
      entry: created,
      embedding: embedding ? { ok: true } : { ok: false, error: embeddingError },
    },
  };
}

export async function deleteEntry(id: string): Promise<ActionResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "Unauthorized" };

  if (!z.uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid entry id" };
  }

  const deleted = await db
    .delete(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, userId)))
    .returning({ id: entries.id, productId: entries.productId });

  if (deleted.length === 0) return { ok: false, error: "Not found" };

  revalidatePath(`/products/${deleted[0].productId}`);
  return { ok: true, data: null };
}
