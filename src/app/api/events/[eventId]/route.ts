import { type NextRequest, NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { deleteEvent, moveEvent } from "@/lib/google/events";

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

  if (!body.sourceCalendarId || !body.targetCalendarId) {
    return NextResponse.json(
      { error: "Missing sourceCalendarId or targetCalendarId" },
      { status: 400 }
    );
  }

  await moveEvent(client, body.sourceCalendarId, eventId, body.targetCalendarId);
  return NextResponse.json({ success: true });
}
