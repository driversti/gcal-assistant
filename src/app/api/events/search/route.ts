import { type NextRequest, NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { listCalendars } from "@/lib/google/calendars";
import { searchEvents } from "@/lib/google/search-events";

export async function GET(request: NextRequest) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const allCalendars = await listCalendars(client);
  const events = await searchEvents(client, allCalendars, q.trim());
  return NextResponse.json(events);
}
