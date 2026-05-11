import { auth } from "@my-better-t-app/auth";
import { db } from "@my-better-t-app/db";
import { products } from "@my-better-t-app/db/schema/budda";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const createProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional(),
  icon: z.string().trim().max(8).optional(),
});

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.userId, userId))
    .orderBy(desc(products.createdAt));

  return NextResponse.json({ products: rows });
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

  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
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

  return NextResponse.json({ product: created }, { status: 201 });
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
    .delete(products)
    .where(and(eq(products.id, id), eq(products.userId, userId)))
    .returning({ id: products.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
