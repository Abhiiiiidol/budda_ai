import { GEMINI_MODEL, getGemini } from "./client";

const EXTRACT_PROMPT =
  "Extract all text content from this document. Preserve structure (headings, lists, tables) using plain Markdown. Do not summarize. Do not omit content. Return only the extracted text — no commentary.";

const DESCRIBE_IMAGE_PROMPT =
  "Describe this image in detail. Extract any visible text verbatim. If it is a UI screenshot, describe the screen layout, components, and any copy. Return only the description — no commentary.";

type ExtractOptions = {
  base64: string;
  mimeType: string;
  prompt?: string;
};

export async function extractTextFromFile({
  base64,
  mimeType,
  prompt,
}: ExtractOptions): Promise<string> {
  const ai = getGemini();
  const isImage = mimeType.startsWith("image/");

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: prompt ?? (isImage ? DESCRIBE_IMAGE_PROMPT : EXTRACT_PROMPT) },
        ],
      },
    ],
  });

  const text = response.text ?? "";
  if (!text.trim()) {
    throw new Error("Gemini returned empty extraction");
  }
  return text;
}
