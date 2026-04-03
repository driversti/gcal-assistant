import { getSession, encryptSession, setSessionCookie } from "./session";
import { createAuthenticatedClient } from "@/lib/google/auth";
import type { OAuth2Client } from "google-auth-library";

/**
 * Gets an authenticated Google OAuth2 client from the session cookie.
 * Automatically refreshes the access token if it's expiring within 5 minutes.
 */
export async function getAuthClient(): Promise<OAuth2Client | null> {
  const session = await getSession();
  if (!session) return null;

  const client = createAuthenticatedClient({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expiry_date: session.expiry_date,
  });

  // Refresh if expiring within 5 minutes
  const fiveMinutes = 5 * 60 * 1000;
  if (session.expiry_date - Date.now() < fiveMinutes) {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);

    const encrypted = await encryptSession({
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token ?? session.refresh_token,
      expiry_date: credentials.expiry_date!,
      email: session.email,
    });
    await setSessionCookie(encrypted);
  }

  return client;
}
