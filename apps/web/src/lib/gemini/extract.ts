import { parseOffice } from "officeparser";

import { GEMINI_MODEL, callGemini, getGemini } from "./client";

const EXTRACT_PROMPT =
  "Extract all text content from this document. Preserve structure (headings, lists, tables) using plain Markdown. Do not summarize. Do not omit content. Return only the extracted text — no commentary.";

const DESCRIBE_IMAGE_PROMPT =
  "Describe this image in detail. Extract any visible text verbatim. If it is a UI screenshot, describe the screen layout, components, and any copy. Return only the description — no commentary.";

const OFFICE_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.oasis.opendocument.text", // .odt
  "application/vnd.oasis.opendocument.spreadsheet", // .ods
  "application/vnd.oasis.opendocument.presentation", // .odp
  "application/msword", // .doc — best effort
]);

const PLAIN_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/x-markdown",
  "application/json",
]);

type ExtractOptions = {
  base64: string;
  mimeType: string;
  prompt?: string;
};

async function extractWithGemini({ base64, mimeType, prompt }: ExtractOptions): Promise<string> {
  const ai = getGemini();
  const isImage = mimeType.startsWith("image/");

  const response = await callGemini(() =>
    ai.models.generateContent({
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
    }),
  );

  const text = response.text ?? "";
  if (!text.trim()) {
    throw new Error("Gemini returned empty extraction");
  }
  return text;
}

async function extractWithOfficeParser(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const ast = await parseOffice(buffer);
  const text = ast.toText();
  if (!text.trim()) {
    throw new Error("officeparser returned empty extraction");
  }
  return text;
}

export async function extractTextFromFile(opts: ExtractOptions): Promise<string> {
  const { base64, mimeType } = opts;

  if (OFFICE_MIME_TYPES.has(mimeType)) {
    return extractWithOfficeParser(base64);
  }

  if (PLAIN_TEXT_MIME_TYPES.has(mimeType) || mimeType.startsWith("text/")) {
    const text = Buffer.from(base64, "base64").toString("utf-8");
    if (!text.trim()) {
      throw new Error("File contained no readable text");
    }
    return text;
  }

  return extractWithGemini(opts);
}
