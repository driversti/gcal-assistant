import { type NextRequest, NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { deleteEvent, moveEvent } from "@/lib/google/events";
import { updateEvent } from "@/lib/google/update-event";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const calendarId = request.nextUrl.searchParams.get("calendarId");

  if (!calendarId) {
    return NextResponse.json(
      { error: "Missing calendarId" },
      { status: 400 }
    );
  }

  await deleteEvent(client, calendarId, eventId);
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await request.json();

  // Field update
  if (body.fields) {
    if (!body.calendarId) {
      return NextResponse.json(
        { error: "Missing calendarId" },
        { status: 400 }
      );
    }

    try {
      await updateEvent(
        client,
        body.calendarId,
        eventId,
        body.fields,
        body.recurrenceMode,
        body.recurringEventId
      );
      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update event";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Move (existing behavior)
  if (!body.sourceCalendarId || !body.targetCalendarId) {
    return NextResponse.json(
      { error: "Missing sourceCalendarId or targetCalendarId" },
      { status: 400 }
    );
  }

  await moveEvent(client, body.sourceCalendarId, eventId, body.targetCalendarId);
  return NextResponse.json({ success: true });
}
