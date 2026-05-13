import {
  EMBEDDING_DIMENSIONS,
  GEMINI_EMBEDDING_MODEL,
  callGemini,
  getGemini,
} from "./client";

const EMBEDDING_INPUT_CHAR_LIMIT = 32_000;

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Cannot embed empty text");
  }
  const input = trimmed.slice(0, EMBEDDING_INPUT_CHAR_LIMIT);

  const ai = getGemini();
  const response = await callGemini(() =>
    ai.models.embedContent({
      model: GEMINI_EMBEDDING_MODEL,
      contents: input,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    }),
  );

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding shape: got ${values?.length ?? 0} dims, expected ${EMBEDDING_DIMENSIONS}`,
    );
  }

  return values;
}
