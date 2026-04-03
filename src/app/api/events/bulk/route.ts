import { NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { deleteEvent, moveEvent } from "@/lib/google/events";

interface BulkRequest {
  action: "delete" | "move";
  events: { id: string; calendarId: string }[];
  targetCalendarId?: string;
}

export async function POST(request: Request) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: BulkRequest = await request.json();
  const results: { id: string; success: boolean; error?: string }[] = [];

  if (body.action === "delete") {
    for (const event of body.events) {
      try {
        await deleteEvent(client, event.calendarId, event.id);
        results.push({ id: event.id, success: true });
      } catch (error) {
        results.push({
          id: event.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  } else if (body.action === "move" && body.targetCalendarId) {
    for (const event of body.events) {
      try {
        await moveEvent(
          client,
          event.calendarId,
          event.id,
          body.targetCalendarId
        );
        results.push({ id: event.id, success: true });
      } catch (error) {
        results.push({
          id: event.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  const successes = results.filter((r) => r.success).length;
  const failures = results.filter((r) => !r.success).length;

  return NextResponse.json({ results, successes, failures });
}
