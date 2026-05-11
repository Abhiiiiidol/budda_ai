import { auth } from "@my-better-t-app/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { extractTextFromFile } from "@/lib/gemini/extract";

const bodySchema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().min(1).max(120),
  prompt: z.string().min(1).max(2_000).optional(),
});

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const text = await extractTextFromFile(parsed.data);
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
