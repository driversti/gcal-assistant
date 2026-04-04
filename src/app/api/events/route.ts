import { type NextRequest, NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { listCalendars } from "@/lib/google/calendars";
import { listEventsForDate } from "@/lib/google/events";
import { createEvent } from "@/lib/google/create-event";

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

export async function POST(request: NextRequest) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { calendarId, summary, description, location, date, recurrence } = body;

  if (!calendarId || !summary || !date) {
    return NextResponse.json(
      { error: "Missing required fields: calendarId, summary, date" },
      { status: 400 }
    );
  }

  try {
    const event = await createEvent(client, {
      calendarId,
      summary,
      description: description || "",
      location: location || null,
      date,
      recurrence: recurrence || "NONE",
    });

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        htmlLink: event.htmlLink,
      },
    });
  } catch (err: unknown) {
    console.error("[Events POST] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
