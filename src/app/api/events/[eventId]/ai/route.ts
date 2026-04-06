import { type NextRequest, NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { google } from "googleapis";
import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are a calendar event research assistant. Given an existing calendar event and its calendar type, research the subject and return enriched event data.

Rules:
- Summary format: ALWAYS "YEAR — Name (d./b. YYYY)" for people, "YEAR — Event Name" for events.
- For people on birthday calendars: include death year, e.g. "1814 — Тарас Шевченко (п. 1861)".
- For people on death calendars: include birth year, e.g. "1861 — Тарас Шевченко (н. 1814)".
- For non-person events: just year and name, e.g. "1986 — Chernobyl disaster".
- Use "d." / "b." for English, "п." / "н." for Ukrainian, "ум." / "р." for Russian, etc. — use the abbreviation natural for the output language.
- Language rules (STRICT):
  - Ukraine-related subjects → Ukrainian
  - Poland-related subjects → Polish
  - Russia-related subjects → Russian
  - All other subjects → English
- Description: brief factual description (role, significance, key facts) — 1-3 sentences. Do NOT include URLs.
- Location: most relevant location (birthplace for birthday calendars, place of death for death calendars, event site for historical events). Can be null if not applicable.
- sourceUrl: most relevant Wikipedia article URL (prefer the Wikipedia in the output language). If no Wikipedia article exists, use another authoritative source.
- photoUrl: direct URL to a portrait or relevant image (Wikimedia Commons preferred). Return null if not found. Must point to an actual image file.
- Output ONLY valid JSON matching the required schema. No explanations.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await request.json();

  const { calendarId, modelName = "gemini-2.5-flash", feedback } = body;
  if (!calendarId) {
    return NextResponse.json(
      { error: "Missing calendarId" },
      { status: 400 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    // 1. Fetch the event
    const calendarApi = google.calendar({ version: "v3", auth: client });
    const { data: event } = await calendarApi.events.get({
      calendarId,
      eventId,
    });

    // 2. Resolve calendar name
    const { data: calendarMeta } = await calendarApi.calendars.get({
      calendarId,
    });
    const calendarName = calendarMeta.summary ?? "Unknown";

    // 3. Build the user prompt
    let prompt = `Existing event summary: "${event.summary ?? "(no title)"}"\n`;
    prompt += `Calendar type: "${calendarName}"\n`;

    if (event.description) {
      prompt += `Current description: "${event.description}"\n`;
    }
    if (event.location) {
      prompt += `Current location: "${event.location}"\n`;
    }

    if (feedback) {
      prompt += `\nThe user has reviewed the previous AI enrichment and wants corrections.\n`;
      prompt += `User feedback: "${feedback}"\n`;
      prompt += `\nPlease regenerate ALL fields taking the user's feedback into account.\n`;
    }

    prompt += `\nResearch this subject and return enriched event data as JSON.`;

    console.log(`\n[AI Enrich] ── Request ─────────────────────────────────`);
    console.log(`[AI Enrich] Model:    ${modelName}`);
    console.log(`[AI Enrich] Event:    ${event.summary ?? "(no title)"} (${eventId})`);
    console.log(`[AI Enrich] Calendar: ${calendarName}`);
    console.log(`[AI Enrich] Feedback: ${feedback ?? "(none)"}`);

    // 4. Call Gemini with Google Search grounding
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
        tools: [{ googleSearch: {} }],
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Event title formatted as 'YEAR — Name (dates)' or 'YEAR — Event Name'",
            },
            description: {
              type: Type.STRING,
              description: "Brief factual description (1-3 sentences). No URLs.",
            },
            location: {
              type: Type.STRING,
              description: "Most relevant location. Empty string if not applicable.",
              nullable: true,
            },
            sourceUrl: {
              type: Type.STRING,
              description: "Wikipedia article URL or other authoritative source URL",
            },
            photoUrl: {
              type: Type.STRING,
              description: "Direct URL to a portrait or relevant image. Empty string if not found.",
              nullable: true,
            },
          },
          required: ["summary", "description", "sourceUrl"],
        },
      },
    });

    const resultText = response.text;
    const finishReason = response.candidates?.[0]?.finishReason;

    console.log(`[AI Enrich] ── Response ────────────────────────────────`);
    console.log(`[AI Enrich] Finish reason: ${finishReason}`);
    console.log(`[AI Enrich] Raw response: ${resultText}`);

    if (!resultText) {
      throw new Error(
        `Gemini returned no content. Finish reason: ${finishReason ?? "unknown"}`
      );
    }

    let result: {
      summary: string;
      description: string;
      location?: string | null;
      sourceUrl: string;
      photoUrl?: string | null;
    };

    try {
      result = JSON.parse(resultText);
    } catch {
      console.error("[AI Enrich] Failed to parse Gemini JSON:", resultText?.slice(0, 500));
      throw new Error("Gemini returned invalid JSON");
    }

    console.log(`[AI Enrich] ── Done ────────────────────────────────────\n`);

    return NextResponse.json({
      success: true,
      enrichment: {
        summary: result.summary,
        description: result.description,
        location: result.location || null,
        sourceUrl: result.sourceUrl,
        photoUrl: result.photoUrl || null,
      },
    });
  } catch (err: unknown) {
    console.error("[AI Enrich] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to enrich event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
