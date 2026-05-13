import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
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

export class GeminiRateLimitError extends Error {
  constructor(message = "Gemini rate limit reached") {
    super(message);
    this.name = "GeminiRateLimitError";
  }
}

function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; code?: number; message?: string };
  if (e.status === 429 || e.code === 429) return true;
  if (typeof e.message === "string" && /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(e.message)) {
    return true;
  }
  return false;
}

function describeGeminiError(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as {
    status?: number;
    code?: number;
    message?: string;
    error?: { message?: string; status?: string; details?: unknown };
  };
  const inner = e.error?.message ?? e.message;
  const status = e.error?.status ?? e.status ?? e.code;
  return `[Gemini ${status ?? "?"}] ${inner ?? "unknown error"}`;
}

/**
 * Runs a Gemini call with one retry on 429 after a short backoff. Converts
 * persistent 429s into a typed GeminiRateLimitError so callers can surface
 * a useful message to the user instead of a generic "something went wrong".
 */
export async function callGemini<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isRateLimitError(err)) {
      console.error("Gemini call failed:", describeGeminiError(err));
      throw err;
    }
    console.warn("Gemini 429, retrying once:", describeGeminiError(err));
    await new Promise((r) => setTimeout(r, 1500));
    try {
      return await fn();
    } catch (err2) {
      if (isRateLimitError(err2)) {
        console.error("Gemini 429 after retry:", describeGeminiError(err2));
        throw new GeminiRateLimitError(
          describeGeminiError(err2) +
            " — Gemini API quota exceeded. Check https://aistudio.google.com/app/usage and confirm billing is enabled on your API key's Cloud project.",
        );
      }
      throw err2;
    }
  }
}
