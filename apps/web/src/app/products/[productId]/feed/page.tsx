import { auth } from "@my-better-t-app/auth";
import { db } from "@my-better-t-app/db";
import { products } from "@my-better-t-app/db/schema/budda";
import { Button } from "@my-better-t-app/ui/components/button";
import { and, eq } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Button
        variant="ghost"
        size="sm"
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

      <div className="mt-10 rounded-md border border-dashed bg-card/30 p-10 text-center text-sm text-muted-foreground">
        Feed Budda UI comes in the next step.
      </div>
    </main>
  );
}
