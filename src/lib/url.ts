import type { NextRequest } from "next/server";

export function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${proto}://${host}`;
  }

  return request.url;
}
