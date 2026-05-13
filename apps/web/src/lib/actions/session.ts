import { auth } from "@my-better-t-app/auth";
import { headers } from "next/headers";

export async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}
