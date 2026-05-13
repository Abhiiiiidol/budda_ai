import { auth } from "@my-better-t-app/auth";
import { db } from "@my-better-t-app/db";
import { chatMessages, products } from "@my-better-t-app/db/schema/budda";
import { Button } from "@my-better-t-app/ui/components/button";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ChatInterface, { type ChatMessage } from "@/components/ask/chat-interface";

export const dynamic = "force-dynamic";

export default async function AskPage({
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

  const historyRows = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.productId, product.id),
        eq(chatMessages.userId, session.user.id),
      ),
    )
    .orderBy(asc(chatMessages.createdAt));

  const initialMessages: ChatMessage[] = historyRows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  return (
    <main className="mx-auto flex h-[calc(100svh-3rem)] w-full max-w-3xl flex-col px-6 py-6">
      <header className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/products/${product.id}`} />}
        >
          <ArrowLeftIcon />
          Back to {product.name}
        </Button>
        <div className="text-right">
          <h1 className="text-base font-semibold tracking-tight">
            <span className="mr-1">🧘</span>
            Ask Budda
          </h1>
          <p className="text-[11px] text-muted-foreground">{product.name}</p>
        </div>
      </header>

      <ChatInterface productId={product.id} initialMessages={initialMessages} />
    </main>
  );
}
