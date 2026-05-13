"use server";

import { db } from "@my-better-t-app/db";
import { products } from "@my-better-t-app/db/schema/budda";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUserId } from "./session";

type Product = typeof products.$inferSelect;

const createProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional(),
  icon: z.string().trim().max(8).optional(),
});

export type CreateProductInput = z.input<typeof createProductSchema>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function listProducts(): Promise<ActionResult<Product[]>> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "Unauthorized" };

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.userId, userId))
    .orderBy(desc(products.createdAt));

  return { ok: true, data: rows };
}

export async function createProduct(
  input: CreateProductInput,
): Promise<ActionResult<Product>> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "Unauthorized" };

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [created] = await db
    .insert(products)
    .values({
      userId,
      name: parsed.data.name,
      description: parsed.data.description,
      ...(parsed.data.icon ? { icon: parsed.data.icon } : {}),
    })
    .returning();

  revalidatePath("/products");
  return { ok: true, data: created };
}

export async function deleteProduct(id: string): Promise<ActionResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, error: "Unauthorized" };

  if (!z.uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid product id" };
  }

  const deleted = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.userId, userId)))
    .returning({ id: products.id });

  if (deleted.length === 0) {
    return { ok: false, error: "Not found" };
  }

  revalidatePath("/products");
  return { ok: true, data: null };
}
