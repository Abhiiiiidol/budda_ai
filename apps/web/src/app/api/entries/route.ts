import { auth } from "@my-better-t-app/auth";
import { db } from "@my-better-t-app/db";
import { entries, products } from "@my-better-t-app/db/schema/budda";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { embedText } from "@/lib/gemini/embed";

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
  product_id: z.uuid(),
  title: z.string().trim().min(1).max(300),
  content: z.string().max(500_000).optional(),
  context: z.string().max(5_000).optional(),
  entry_type: z.enum(ENTRY_TYPES).default("Other"),
  source: z.enum(SOURCES).default("Manual"),
  link: z.url().max(2_000).optional(),
  file_path: z.string().max(1_000).optional(),
  file_name: z.string().max(500).optional(),
  file_type: z.string().max(200).optional(),
});

export const maxDuration = 60;

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");
  const typeFilter = url.searchParams.get("type");
  const sourceFilter = url.searchParams.get("source");

  if (!productId) {
    return NextResponse.json(
      { error: "Missing required query parameter: product_id" },
      { status: 400 },
    );
  }

  const filters = [eq(entries.productId, productId), eq(entries.userId, userId)];
  if (typeFilter) filters.push(eq(entries.entryType, typeFilter));
  if (sourceFilter) filters.push(eq(entries.source, sourceFilter));

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

  return NextResponse.json({ entries: rows });
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, parsed.data.product_id), eq(products.userId, userId)))
    .limit(1);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const content = parsed.data.content?.trim() || null;
  const contentHash = content ? sha256(content) : null;

  let embedding: number[] | null = null;
  let embeddingError: string | null = null;
  if (content) {
    try {
      embedding = await embedText(content);
    } catch (err) {
      embeddingError = err instanceof Error ? err.message : "Embedding failed";
    }
  }

  const [created] = await db
    .insert(entries)
    .values({
      productId: parsed.data.product_id,
      userId,
      title: parsed.data.title,
      content,
      context: parsed.data.context?.trim() || null,
      entryType: parsed.data.entry_type,
      source: parsed.data.source,
      link: parsed.data.link ?? null,
      filePath: parsed.data.file_path ?? null,
      fileName: parsed.data.file_name ?? null,
      fileType: parsed.data.file_type ?? null,
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

  return NextResponse.json(
    {
      entry: created,
      embedding: embedding ? { ok: true } : { ok: false, error: embeddingError },
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Missing required query parameter: id" },
      { status: 400 },
    );
  }

  const deleted = await db
    .delete(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, userId)))
    .returning({ id: entries.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
