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
import { ChevronDownIcon, ExternalLinkIcon, TrashIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteEntry } from "@/lib/actions/entries";
import { SOURCE_CONFIG, TYPE_ICONS } from "@/lib/constants/sources";

export type EntryRowData = {
  id: string;
  productId: string;
  title: string;
  content: string | null;
  context: string | null;
  entryType: string;
  source: string;
  link: string | null;
  filePath: string | null;
  fileName: string | null;
  fileType: string | null;
  hasChanges: boolean | null;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const ms = Date.now() - new Date(date).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export default function EntryRow({ entry }: { entry: EntryRowData }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const typeIcon = TYPE_ICONS[entry.entryType as keyof typeof TYPE_ICONS] ?? "📎";
  const sourceCfg = SOURCE_CONFIG[entry.source as keyof typeof SOURCE_CONFIG];

  function onDelete() {
    startTransition(async () => {
      const result = await deleteEntry(entry.id);
      if (!result.ok) {
        toast.error(result.error || "Failed to delete entry");
        return;
      }
      toast.success(`Deleted "${entry.title}"`);
      setConfirmOpen(false);
    });
  }

  return (
    <div className="group border bg-card transition-colors hover:border-foreground/20">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className="mt-0.5 text-lg leading-none" aria-hidden>
          {typeIcon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{entry.title}</span>
            {entry.hasChanges ? (
              <span
                className="inline-block size-1.5 rounded-full bg-amber-400"
                title="Changed since last sync"
                aria-label="Changed"
              />
            ) : null}
            {sourceCfg ? (
              <span
                className="inline-flex h-5 items-center gap-1 rounded-sm border border-foreground/10 px-1.5 text-[10px]"
                style={{ color: sourceCfg.color, backgroundColor: sourceCfg.bg }}
              >
                <span>{sourceCfg.icon}</span>
                <span>{entry.source}</span>
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">{entry.source}</span>
            )}
            <span className="text-[10px] text-muted-foreground">{entry.entryType}</span>
          </div>

          {entry.context ? (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              💡 {entry.context}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          <span>{timeAgo(entry.createdAt)}</span>
          <ChevronDownIcon
            className={
              "size-3.5 transition-transform " + (expanded ? "rotate-180" : "rotate-0")
            }
          />
        </div>
      </button>

      {expanded ? (
        <div className="border-t bg-background/40 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {entry.fileName ? <span>📄 {entry.fileName}</span> : null}
              {entry.fileType ? <span>· {entry.fileType}</span> : null}
            </div>

            <div className="flex items-center gap-2">
              {entry.link ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a href={entry.link} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <ExternalLinkIcon />
                  Open original
                </Button>
              ) : null}

              <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label="Delete entry"
                    >
                      <TrashIcon />
                      Delete
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete "{entry.title}"?</DialogTitle>
                    <DialogDescription>
                      This entry will be permanently removed from Budda's memory. This cannot
                      be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose
                      render={<Button variant="ghost" disabled={isPending} />}
                    >
                      Cancel
                    </DialogClose>
                    <Button
                      variant="destructive"
                      onClick={onDelete}
                      disabled={isPending}
                    >
                      {isPending ? "Deleting..." : "Delete entry"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {entry.context ? (
            <div className="mb-3 rounded-sm border bg-card/60 p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Context
              </div>
              <p className="mt-1 text-xs leading-relaxed">{entry.context}</p>
            </div>
          ) : null}

          {entry.content ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-sm border bg-card/60 p-3 text-xs leading-relaxed">
              {entry.content}
            </pre>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              No extracted content for this entry.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
