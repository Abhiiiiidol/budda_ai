import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-2.0-flash";
export const GEMINI_EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIMENSIONS = 768;

let cached: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to apps/web/.env to enable AI features.",
    );
  }
  cached = new GoogleGenAI({ apiKey });
  return cached;
}
