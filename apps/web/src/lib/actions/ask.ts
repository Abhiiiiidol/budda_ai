"use server";

import { db } from "@my-better-t-app/db";
import { chatMessages, entries, products } from "@my-better-t-app/db/schema/budda";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { GeminiRateLimitError } from "@/lib/gemini/client";
import { askBudda, type AskEntry, type ChatTurn } from "@/lib/gemini/ask";
import { semanticSearch, type SearchResult } from "@/lib/search";

import { getSessionUserId } from "./session";

const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20_000),
});

const askSchema = z.object({
  productId: z.uuid(),
  question: z.string().trim().min(1).max(5_000),
  history: z.array(chatTurnSchema).max(50).optional().default([]),
});

export type AskInput = z.input<typeof askSchema>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function askProduct(
  input: AskInput,
): Promise<ActionResult<{ answer: string; referencedEntryIds: string[] }>> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "Unauthorized" };

  const parsed = askSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { productId, question, history } = parsed.data;

  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);

  if (!product) return { ok: false, error: "Product not found" };

  let searchResults: SearchResult[] = [];
  try {
    searchResults = await semanticSearch({ query: question, productId, topK: 15 });
  } catch (err) {
    console.error("Semantic search failed, falling back to all entries:", err);
  }

  let askEntries: AskEntry[];
  let referencedEntryIds: string[] = [];

  if (searchResults.length > 0) {
    askEntries = searchResults.map((r) => ({
      title: r.title,
      content: r.content,
      context: r.context,
      entryType: r.entry_type,
      source: r.source,
      link: r.link,
    }));
    referencedEntryIds = searchResults.map((r) => r.id);
  } else {
    const rows = await db
      .select({
        id: entries.id,
        title: entries.title,
        content: entries.content,
        context: entries.context,
        entryType: entries.entryType,
        source: entries.source,
        link: entries.link,
        createdAt: entries.createdAt,
      })
      .from(entries)
      .where(and(eq(entries.productId, productId), eq(entries.userId, userId)))
      .limit(20);

    askEntries = rows.map((e) => ({
      title: e.title,
      content: e.content,
      context: e.context,
      entryType: e.entryType,
      source: e.source,
      link: e.link,
      date: e.createdAt?.toISOString() ?? null,
    }));
    referencedEntryIds = rows.map((r) => r.id);
  }

  let answer: string;
  try {
    answer = await askBudda({
      productName: product.name,
      productDescription: product.description ?? "",
      entries: askEntries,
      history: history as ChatTurn[],
      question,
    });
  } catch (err) {
    console.error("Ask Budda Gemini call failed:", err);
    if (err instanceof GeminiRateLimitError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Budda's thinking got interrupted. Try again." };
  }

  await db.insert(chatMessages).values([
    { productId, userId, role: "user", content: question },
    {
      productId,
      userId,
      role: "assistant",
      content: answer,
      referencedEntryIds,
    },
  ]);

  return { ok: true, data: { answer, referencedEntryIds } };
}
