import type { EntryType, Source } from "@/lib/constants/sources";

export function detectLink(url: string): { source: Source; entryType: EntryType } {
  const u = url.toLowerCase();
  if (u.includes("figma.com")) return { source: "Figma", entryType: "Design" };
  if (u.includes("youtube.com") || u.includes("youtu.be"))
    return { source: "YouTube", entryType: "Link" };
  if (u.includes("docs.google.com") || u.includes("drive.google.com"))
    return { source: "Google Drive", entryType: "Other" };
  if (u.includes("chat.openai.com") || u.includes("chatgpt.com"))
    return { source: "ChatGPT", entryType: "AI Chat" };
  if (u.includes("claude.ai")) return { source: "Claude", entryType: "AI Chat" };
  if (u.includes("perplexity.ai")) return { source: "Perplexity", entryType: "AI Chat" };
  if (u.includes("notion.so")) return { source: "Website", entryType: "Other" };
  return { source: "Website", entryType: "Link" };
}
