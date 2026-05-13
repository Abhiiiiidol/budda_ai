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
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createProduct } from "@/lib/actions/products";

export default function CreateProductDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🧘");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setDescription("");
    setIcon("🧘");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }

    startTransition(async () => {
      const result = await createProduct({
        name: trimmedName,
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Product created");
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <PlusIcon />
            New product
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New product</DialogTitle>
            <DialogDescription>
              Each product is a separate workspace. You can rename it later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="product-icon">Icon</Label>
              <Input
                id="product-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="w-20 text-center text-lg"
                aria-label="Product icon emoji"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="product-name">Name</Label>
              <Input
                id="product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mobile Checkout"
                autoFocus
                required
                maxLength={120}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="product-description">Description (optional)</Label>
              <Input
                id="product-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One line about this product"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" disabled={isPending} />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
