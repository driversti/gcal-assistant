import { type NextRequest, NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { listCalendars } from "@/lib/google/calendars";
import { listEventsForDate } from "@/lib/google/events";

export async function GET(request: NextRequest) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date");
  const calendarIds = request.nextUrl.searchParams.get("calendarIds");

  if (!date) {
    return NextResponse.json(
      { error: "Missing 'date' parameter (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const allCalendars = await listCalendars(client);
  const filteredCalendars = calendarIds
    ? allCalendars.filter((c) => calendarIds.split(",").includes(c.id))
    : allCalendars;

  const events = await listEventsForDate(client, filteredCalendars, date);
  return NextResponse.json(events);
}
