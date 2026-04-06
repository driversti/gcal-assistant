import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createOAuth2Client } from "@/lib/google/auth";
import { encryptSession, setSessionCookie } from "@/lib/auth/session";
import { google } from "googleapis";
import { getBaseUrl } from "@/lib/url";

const OAUTH_STATE_COOKIE = "gca_oauth_state";

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", baseUrl));
  }

  // Validate OAuth state to prevent login CSRF
  const returnedState = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!returnedState || !storedState || returnedState !== storedState) {
    return NextResponse.redirect(
      new URL("/?error=invalid_state", baseUrl)
    );
  }

  try {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const encrypted = await encryptSession({
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
      email: userInfo.email!,
    });

    await setSessionCookie(encrypted);

    return NextResponse.redirect(new URL("/dashboard", baseUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("OAuth callback error:", message);
    return NextResponse.redirect(new URL("/?error=auth_failed", baseUrl));
  }
}
