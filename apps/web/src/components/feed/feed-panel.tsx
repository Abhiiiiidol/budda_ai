"use client";

import {
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  MessageSquareIcon,
  CloudIcon,
} from "lucide-react";
import { useState } from "react";

import AiChatInput from "./ai-chat-input";
import DocumentUpload from "./document-upload";
import DriveInput from "./drive-input";
import ImageUpload from "./image-upload";
import LinkInput from "./link-input";

const MODES = [
  { id: "document", label: "Document", icon: FileTextIcon },
  { id: "link", label: "Link", icon: LinkIcon },
  { id: "ai-chat", label: "AI Chat", icon: MessageSquareIcon },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "drive", label: "Google Drive", icon: CloudIcon },
] as const;

type ModeId = (typeof MODES)[number]["id"];

export default function FeedPanel({ productId }: { productId: string }) {
  const [mode, setMode] = useState<ModeId>("document");

  return (
    <div className="rounded-md border bg-card">
      <nav
        className="flex flex-wrap border-b"
        role="tablist"
        aria-label="Feed Budda input modes"
      >
        {MODES.map((m) => {
          const active = m.id === mode;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m.id)}
              className={
                "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition-colors " +
                (active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className="size-3.5" />
              {m.label}
            </button>
          );
        })}
      </nav>

      <div className="p-5">
        {mode === "document" ? <DocumentUpload productId={productId} /> : null}
        {mode === "link" ? <LinkInput productId={productId} /> : null}
        {mode === "ai-chat" ? <AiChatInput productId={productId} /> : null}
        {mode === "image" ? <ImageUpload productId={productId} /> : null}
        {mode === "drive" ? <DriveInput productId={productId} /> : null}
      </div>
    </div>
  );
}
