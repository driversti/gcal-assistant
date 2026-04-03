import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google/auth";

export async function GET() {
  const state = crypto.randomUUID();
  const url = getAuthUrl(state);
  return NextResponse.redirect(url);
}
