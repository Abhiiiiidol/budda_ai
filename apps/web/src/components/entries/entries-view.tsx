"use client";

import { Input } from "@my-better-t-app/ui/components/input";
import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import EntryRow, { type EntryRowData } from "./entry-row";

const TABS = [
  { id: "all", label: "All" },
  { id: "documents", label: "Documents" },
  { id: "design", label: "Design" },
  { id: "links", label: "Links" },
  { id: "ai-chats", label: "AI Chats" },
  { id: "changes", label: "Changes" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DOCUMENT_TYPES = new Set(["PRD", "Tech Spec", "Research", "Spec", "Meeting Notes"]);
const AI_CHAT_SOURCES = new Set(["ChatGPT", "Claude", "Perplexity"]);

function passesTab(entry: EntryRowData, tab: TabId): boolean {
  switch (tab) {
    case "all":
      return true;
    case "documents":
      return DOCUMENT_TYPES.has(entry.entryType);
    case "design":
      return entry.source === "Figma" || entry.entryType === "Design";
    case "links":
      return Boolean(entry.link);
    case "ai-chats":
      return AI_CHAT_SOURCES.has(entry.source);
    case "changes":
      return entry.entryType === "Change Log" || entry.hasChanges === true;
  }
}

function passesSearch(entry: EntryRowData, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    entry.title.toLowerCase().includes(needle) ||
    (entry.content?.toLowerCase().includes(needle) ?? false) ||
    (entry.context?.toLowerCase().includes(needle) ?? false) ||
    entry.source.toLowerCase().includes(needle) ||
    entry.entryType.toLowerCase().includes(needle)
  );
}

export default function EntriesView({
  productId: _productId,
  entries,
}: {
  productId: string;
  entries: EntryRowData[];
}) {
  const [tab, setTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => entries.filter((e) => passesTab(e, tab) && passesSearch(e, search)),
    [entries, tab, search],
  );

  const counts = useMemo(() => {
    const byTab: Record<TabId, number> = {
      all: entries.length,
      documents: 0,
      design: 0,
      links: 0,
      "ai-chats": 0,
      changes: 0,
    };
    for (const e of entries) {
      if (passesTab(e, "documents")) byTab.documents++;
      if (passesTab(e, "design")) byTab.design++;
      if (passesTab(e, "links")) byTab.links++;
      if (passesTab(e, "ai-chats")) byTab["ai-chats"]++;
      if (passesTab(e, "changes")) byTab.changes++;
    }
    return byTab;
  }, [entries]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b">
        <nav className="flex flex-wrap" aria-label="Entry filters">
          {TABS.map((t) => {
            const active = t.id === tab;
            const count = counts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  "relative -mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors " +
                  (active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                {t.label}
                <span className="ml-1.5 text-[10px] text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, content, source…"
            className="pl-7"
            aria-label="Search entries"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed bg-card/30 p-10 text-center">
          <p className="text-sm font-medium">
            {entries.length === 0 ? "No entries yet" : "No entries match this filter"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {entries.length === 0
              ? "Feed Budda a doc, link, image, or chat export to get started."
              : "Try a different tab or clear the search."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((entry) => (
            <li key={entry.id}>
              <EntryRow entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
