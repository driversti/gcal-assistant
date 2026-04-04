import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthUrl } from "@/lib/google/auth";

const OAUTH_STATE_COOKIE = "gca_oauth_state";

export async function GET() {
  const state = crypto.randomUUID();
  const url = getAuthUrl(state);

  // Store state in a short-lived cookie for CSRF validation
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return NextResponse.redirect(url);
}
