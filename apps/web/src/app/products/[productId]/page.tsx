import { auth } from "@my-better-t-app/auth";
import { db } from "@my-better-t-app/db";
import { entries, products } from "@my-better-t-app/db/schema/budda";
import { Button } from "@my-better-t-app/ui/components/button";
import { and, desc, eq } from "drizzle-orm";
import { MessageCircleIcon, PlusIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import EntriesView from "@/components/entries/entries-view";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, session.user.id)))
    .limit(1);

  if (!product) {
    notFound();
  }

  const entryRows = await db
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
    .where(and(eq(entries.productId, productId), eq(entries.userId, session.user.id)))
    .orderBy(desc(entries.createdAt));

  const sourceCount = new Set(entryRows.map((e) => e.source)).size;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none">{product.icon ?? "🧘"}</span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            {product.description ? (
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {product.description}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>
                {entryRows.length} {entryRows.length === 1 ? "entry" : "entries"}
              </span>
              <span>·</span>
              <span>
                {sourceCount} {sourceCount === 1 ? "source" : "sources"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/products/${product.id}/ask`} />}
          >
            <MessageCircleIcon />
            Ask Budda
          </Button>
          <Button
            nativeButton={false}
            render={<Link href={`/products/${product.id}/feed`} />}
          >
            <PlusIcon />
            Feed Budda
          </Button>
        </div>
      </header>

      <EntriesView productId={product.id} entries={entryRows} />
    </main>
  );
}
