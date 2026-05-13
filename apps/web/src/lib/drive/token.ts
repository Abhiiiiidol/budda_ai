import { db } from "@my-better-t-app/db";
import { account } from "@my-better-t-app/db/schema/auth";
import { and, eq } from "drizzle-orm";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const PROVIDER_ID = "google";

export class DriveNotConnectedError extends Error {
  constructor() {
    super("Google Drive is not connected for this user");
    this.name = "DriveNotConnectedError";
  }
}

export class DriveTokenRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveTokenRefreshError";
  }
}

/**
 * Calls Google's token endpoint to exchange a refresh token for a fresh
 * access token. Returns the new access token.
 */
export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new DriveTokenRefreshError("Google OAuth credentials are not configured");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new DriveTokenRefreshError(`Token refresh failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new DriveTokenRefreshError("Token refresh response missing access_token");
  }
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

/**
 * Returns a valid Google access token for the given user, refreshing
 * automatically if the cached token is expired. The refreshed token is
 * persisted back to the account table.
 */
export async function getValidGoogleAccessToken(userId: string): Promise<string> {
  const [row] = await db
    .select({
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
    })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, PROVIDER_ID)))
    .limit(1);

  if (!row || !row.refreshToken) {
    throw new DriveNotConnectedError();
  }

  const now = Date.now();
  const expiresAtMs = row.accessTokenExpiresAt
    ? new Date(row.accessTokenExpiresAt).getTime()
    : 0;
  const stillValid = row.accessToken && expiresAtMs - now > 60_000;

  if (stillValid && row.accessToken) {
    return row.accessToken;
  }

  const refreshed = await refreshGoogleAccessToken(row.refreshToken);
  const newExpiresAt = new Date(now + refreshed.expiresIn * 1000);

  await db
    .update(account)
    .set({
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: newExpiresAt,
    })
    .where(and(eq(account.userId, userId), eq(account.providerId, PROVIDER_ID)));

  return refreshed.accessToken;
}
