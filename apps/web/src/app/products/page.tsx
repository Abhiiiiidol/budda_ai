import { auth } from "@my-better-t-app/auth";
import { db } from "@my-better-t-app/db";
import { entries, products } from "@my-better-t-app/db/schema/budda";
import { count, desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import CreateProductDialog from "@/components/products/create-product-dialog";
import ProductGrid from "@/components/products/product-grid";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      icon: products.icon,
      createdAt: products.createdAt,
      entryCount: count(entries.id),
      sources: sql<string[]>`coalesce(array_agg(distinct ${entries.source}) filter (where ${entries.source} is not null), '{}')`,
    })
    .from(products)
    .leftJoin(entries, eq(entries.productId, products.id))
    .where(eq(products.userId, session.user.id))
    .groupBy(products.id)
    .orderBy(desc(products.createdAt));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One workspace per product. Feed it docs, links, AI chats — ask it anything.
          </p>
        </div>
        <CreateProductDialog />
      </div>

      <ProductGrid products={rows} />
    </main>
  );
}
