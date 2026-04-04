import { NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { deleteEvent, moveEvent } from "@/lib/google/events";

interface BulkRequest {
  action: "delete" | "move";
  events: { id: string; calendarId: string; recurringEventId?: string }[];
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
    // Deduplicate: if multiple instances of the same recurring series are selected,
    // delete the series only once (using the recurringEventId)
    const seen = new Set<string>();
    for (const event of body.events) {
      const deleteId = event.recurringEventId ?? event.id;
      if (seen.has(deleteId)) {
        results.push({ id: event.id, success: true });
        continue;
      }
      seen.add(deleteId);
      try {
        await deleteEvent(client, event.calendarId, deleteId);
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
