import { EMBEDDING_DIMENSIONS, GEMINI_EMBEDDING_MODEL, getGemini } from "./client";

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Cannot embed empty text");
  }

  const ai = getGemini();
  const response = await ai.models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
    contents: trimmed,
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding shape: got ${values?.length ?? 0} dims, expected ${EMBEDDING_DIMENSIONS}`,
    );
  }

  return values;
}
