import { GEMINI_MODEL, getGemini } from "./client";

export type AskEntry = {
  title: string;
  content: string | null;
  context: string | null;
  entryType: string;
  source: string;
  link: string | null;
  date?: string | null;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

function formatEntries(entries: AskEntry[]): string {
  if (entries.length === 0) {
    return "[No entries yet for this product.]";
  }
  return entries
    .map((e) => {
      const lines = [
        `─── [${e.entryType}] ${e.title} ───`,
        `Source: ${e.source}`,
        e.date ? `Date: ${e.date}` : null,
        e.link ? `Original Link: ${e.link}` : null,
        e.context ? `Context: ${e.context}` : null,
        ``,
        `Content:`,
        e.content?.trim() || "[No content]",
      ].filter((l) => l !== null);
      return lines.join("\n");
    })
    .join("\n\n═══════════\n\n");
}

function buildSystemPrompt(
  productName: string,
  productDescription: string,
  entries: AskEntry[],
): string {
  return `You are Budda — a product memory assistant for "${productName}" (${productDescription}).

You have access to the following documents and entries for this product:

${formatEntries(entries)}

RULES — follow these strictly:
1. Answer ONLY from the provided documents. Never fabricate information.
2. If the answer is not in the documents, say: "I don't have that in my memory yet. Try feeding it to me!"
3. Be concise and scannable — PMs are busy. Use short paragraphs.
4. ALWAYS reference which document/entry you are pulling information from, by its title.
5. ALWAYS include original links when they exist. If an entry has a Figma link, Drive link, YouTube link, or any URL — include it in your response so the PM can access the original file.
6. When asked to "find a document" or "give me the doc about X" — search through entries, return the most relevant one with its full content and original link.
7. For change logs, clearly state what changed.
8. Flag when you are making an inference vs stating a fact from the documents.
9. Speak warmly but efficiently, like a wise assistant who knows everything about this product.`;
}

export async function askBudda(params: {
  productName: string;
  productDescription: string;
  entries: AskEntry[];
  history: ChatTurn[];
  question: string;
}): Promise<string> {
  const { productName, productDescription, entries, history, question } = params;
  const ai = getGemini();

  const systemInstruction = buildSystemPrompt(productName, productDescription, entries);

  const contents = [
    ...history.map((turn) => ({
      role: turn.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: turn.content }],
    })),
    { role: "user" as const, parts: [{ text: question }] },
  ];

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: { systemInstruction },
  });

  const answer = response.text?.trim();
  if (!answer) {
    throw new Error("Gemini returned an empty answer");
  }
  return answer;
}
