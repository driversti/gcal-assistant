import { NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { listCalendars } from "@/lib/google/calendars";

export async function GET() {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const calendars = await listCalendars(client);
  return NextResponse.json(calendars);
}
