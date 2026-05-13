"use client";

import { Button } from "@my-better-t-app/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@my-better-t-app/ui/components/dialog";
import { TrashIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteProduct } from "@/lib/actions/products";
import { SOURCE_CONFIG } from "@/lib/constants/sources";

export type ProductCardData = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  createdAt: Date;
  entryCount: number;
  sources: string[];
};

export default function ProductCard({ product }: { product: ProductCardData }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (!result.ok) {
        toast.error(result.error || "Failed to delete product");
        return;
      }
      toast.success(`Deleted "${product.name}"`);
      setConfirmOpen(false);
    });
  }

  return (
    <div className="group relative flex h-full flex-col gap-3 border bg-card p-4 transition-colors hover:border-foreground/20">
      <Link
        href={`/products/${product.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Open ${product.name}`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{product.icon ?? "🧘"}</span>
          <div>
            <div className="text-sm font-semibold">{product.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {product.entryCount} {product.entryCount === 1 ? "entry" : "entries"}
            </div>
          </div>
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete product"
                className="relative z-10 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <TrashIcon />
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete "{product.name}"?</DialogTitle>
              <DialogDescription>
                All entries and chat history for this product will be permanently deleted. This
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" disabled={isPending} />}>
                Cancel
              </DialogClose>
              <Button variant="destructive" onClick={onDelete} disabled={isPending}>
                {isPending ? "Deleting..." : "Delete product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {product.description ? (
        <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
      ) : null}

      {product.sources.length > 0 ? (
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {product.sources.slice(0, 6).map((s) => {
            const cfg = SOURCE_CONFIG[s as keyof typeof SOURCE_CONFIG];
            const icon = cfg?.icon ?? "•";
            return (
              <span
                key={s}
                title={s}
                className="inline-flex h-5 items-center gap-1 rounded-sm border border-foreground/10 px-1.5 text-[10px]"
                style={cfg ? { color: cfg.color, backgroundColor: cfg.bg } : undefined}
              >
                <span>{icon}</span>
                <span>{s}</span>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
