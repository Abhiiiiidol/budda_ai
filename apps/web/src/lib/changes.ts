import { db } from "@my-better-t-app/db";
import { entries } from "@my-better-t-app/db/schema/budda";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { embedText } from "@/lib/gemini/embed";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Compares incoming content against the stored hash. If different, updates
 * the entry with new content, rotates the previous hash, regenerates the
 * embedding, and flags `hasChanges = true`.
 *
 * Returns true when a change was detected (and persisted), false otherwise.
 */
export async function checkForChanges(params: {
  entryId: string;
  userId: string;
  newContent: string;
}): Promise<boolean> {
  const { entryId, userId, newContent } = params;
  const newHash = sha256(newContent);

  const [existing] = await db
    .select({
      contentHash: entries.contentHash,
    })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
    .limit(1);

  if (!existing) return false;
  if (existing.contentHash === newHash) return false;

  let embedding: number[] | null = null;
  try {
    embedding = await embedText(newContent);
  } catch (err) {
    console.error("Re-embedding failed during change detection:", err);
  }

  await db
    .update(entries)
    .set({
      previousContentHash: existing.contentHash,
      contentHash: newHash,
      content: newContent,
      hasChanges: true,
      ...(embedding ? { embedding } : {}),
    })
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)));

  return true;
}

export async function getChangedEntries(params: { productId: string; userId: string }) {
  return db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.productId, params.productId),
        eq(entries.userId, params.userId),
        eq(entries.hasChanges, true),
      ),
    );
}

export async function clearChangeFlag(params: { entryId: string; userId: string }) {
  await db
    .update(entries)
    .set({ hasChanges: false })
    .where(and(eq(entries.id, params.entryId), eq(entries.userId, params.userId)));
}
