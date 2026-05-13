import { auth } from "@my-better-t-app/auth";
import { db } from "@my-better-t-app/db";
import { products } from "@my-better-t-app/db/schema/budda";
import { Button } from "@my-better-t-app/ui/components/button";
import { and, eq } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import FeedPanel from "@/components/feed/feed-panel";

export const dynamic = "force-dynamic";

export default async function FeedPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, session.user.id)))
    .limit(1);
  if (!product) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href={`/products/${product.id}`} />}
      >
        <ArrowLeftIcon />
        Back to {product.name}
      </Button>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Feed Budda</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add documents, links, AI chats, images, or Google Drive files to {product.name}'s
        memory.
      </p>

      <div className="mt-8">
        <FeedPanel productId={product.id} />
      </div>
    </main>
  );
}
