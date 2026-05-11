import { auth } from "@my-better-t-app/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { embedText } from "@/lib/gemini/embed";

const bodySchema = z.object({
  text: z.string().min(1).max(50_000),
});

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
    const embedding = await embedText(parsed.data.text);
    return NextResponse.json({ embedding });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Embedding failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
