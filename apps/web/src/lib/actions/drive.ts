"use server";

import { db } from "@my-better-t-app/db";
import { entries, products } from "@my-better-t-app/db/schema/budda";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { readDriveFile } from "@/lib/drive/client";
import {
  DriveNotConnectedError,
  DriveTokenRefreshError,
  getValidGoogleAccessToken,
} from "@/lib/drive/token";
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

const importSchema = z.object({
  fileUrl: z.string().min(1),
  productId: z.uuid(),
  title: z.string().trim().max(300).optional(),
  context: z.string().max(5_000).optional(),
  entryType: z.enum(ENTRY_TYPES).optional().default("Other"),
});

export type ImportFromDriveInput = z.input<typeof importSchema>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function importFromDrive(input: ImportFromDriveInput): Promise<
  ActionResult<{
    entry: typeof entries.$inferSelect;
    drive: { fileId: string; mimeType: string; title: string };
    embedding: { ok: true } | { ok: false; error: string | null };
  }>
> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "Unauthorized" };

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { fileUrl, productId, title: titleOverride, context, entryType } = parsed.data;

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);

  if (!product) return { ok: false, error: "Product not found" };

  let accessToken: string;
  try {
    accessToken = await getValidGoogleAccessToken(userId);
  } catch (err) {
    if (err instanceof DriveNotConnectedError) {
      return {
        ok: false,
        error: "Google Drive is not connected. Sign in with Google to connect.",
      };
    }
    if (err instanceof DriveTokenRefreshError) {
      return { ok: false, error: `Drive token refresh failed: ${err.message}` };
    }
    throw err;
  }

  let drive: Awaited<ReturnType<typeof readDriveFile>>;
  try {
    drive = await readDriveFile({ fileUrl, accessToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Drive read failed";
    return { ok: false, error: message };
  }

  const content = drive.content?.trim() || null;
  let embedding: number[] | null = null;
  let embeddingError: string | null = null;
  if (content && content.length > 10) {
    try {
      embedding = await embedText(content);
    } catch (err) {
      embeddingError = err instanceof Error ? err.message : "Embedding failed";
    }
  }

  const [created] = await db
    .insert(entries)
    .values({
      productId,
      userId,
      title: titleOverride?.trim() || drive.title,
      content,
      context: context?.trim() || null,
      entryType,
      source: "Google Drive",
      link: fileUrl,
      fileType: drive.mimeType,
      contentHash: content ? sha256(content) : null,
      embedding,
    })
    .returning();

  revalidatePath(`/products/${productId}`);

  return {
    ok: true,
    data: {
      entry: created,
      drive: { fileId: drive.fileId, mimeType: drive.mimeType, title: drive.title },
      embedding: embedding ? { ok: true } : { ok: false, error: embeddingError },
    },
  };
}
