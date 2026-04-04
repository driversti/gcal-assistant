import { NextResponse } from "next/server";
import { getSession, clearSessionCookie } from "@/lib/auth/session";
import { createAuthenticatedClient } from "@/lib/google/auth";

export async function POST() {
  // Revoke Google token before clearing session
  const session = await getSession();
  if (session) {
    try {
      const client = createAuthenticatedClient({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expiry_date: session.expiry_date,
      });
      await client.revokeToken(session.access_token);
    } catch {
      // Revocation is best-effort — proceed with logout even if it fails
    }
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
