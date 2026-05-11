export const SOURCE_CONFIG = {
  Manual: { color: "#9CA3AF", bg: "#1F2937", icon: "✍️" },
  Figma: { color: "#A259FF", bg: "rgba(162,89,255,0.12)", icon: "🎨" },
  ChatGPT: { color: "#10A37F", bg: "rgba(16,163,127,0.12)", icon: "🤖" },
  Claude: { color: "#D97706", bg: "rgba(217,119,6,0.12)", icon: "🧠" },
  Perplexity: { color: "#20B2AA", bg: "rgba(32,178,170,0.12)", icon: "🔍" },
  YouTube: { color: "#FF4444", bg: "rgba(255,68,68,0.1)", icon: "▶️" },
  "Google Drive": { color: "#4285F4", bg: "rgba(66,133,244,0.12)", icon: "📁" },
  Website: { color: "#22D3EE", bg: "rgba(34,211,238,0.1)", icon: "🌐" },
  Image: { color: "#A78BFA", bg: "rgba(167,139,250,0.1)", icon: "🖼️" },
} as const;

export type Source = keyof typeof SOURCE_CONFIG;
export const SOURCES = Object.keys(SOURCE_CONFIG) as Source[];

export const TYPE_ICONS = {
  PRD: "📋",
  Research: "🔬",
  Design: "🎨",
  "Tech Spec": "⚙️",
  "Change Log": "📝",
  "AI Chat": "🤖",
  Link: "🔗",
  Image: "🖼️",
  "Meeting Notes": "📞",
  Spec: "📐",
  Other: "📎",
} as const;

export type EntryType = keyof typeof TYPE_ICONS;
export const ENTRY_TYPES = Object.keys(TYPE_ICONS) as EntryType[];
