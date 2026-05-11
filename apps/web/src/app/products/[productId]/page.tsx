import { auth } from "@my-better-t-app/auth";
import { db } from "@my-better-t-app/db";
import { products } from "@my-better-t-app/db/schema/budda";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

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

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{product.icon ?? "🧘"}</span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          {product.description ? (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-10 rounded-md border border-dashed bg-card/30 p-10 text-center text-sm text-muted-foreground">
        Entries, Feed Budda, and Ask Budda come next.
      </div>
    </main>
  );
}
