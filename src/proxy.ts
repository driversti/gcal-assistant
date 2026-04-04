import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth routes and static assets
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/ai/models") ||
    pathname.startsWith("/_next") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME);

  if (!sessionCookie?.value) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
