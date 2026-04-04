import { NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { GoogleGenAI, Type } from "@google/genai";
import { listCalendars } from "@/lib/google/calendars";

const SYSTEM_INSTRUCTION = `You are a calendar event research assistant. Given a subject and calendar type, research the subject using web search and return structured event data.

Rules:
- Summary format: ALWAYS "YEAR — Name (d./b. YYYY)" for people, "YEAR — Event Name" for events
- For people on birthday calendars: include death year in the language of the title, e.g. "1814 — Тарас Шевченко (п. 1861)"
- For people on death calendars: include birth year in the language of the title, e.g. "1861 — Тарас Шевченко (н. 1814)"
- For non-person events: just year and name, e.g. "1986 — Chernobyl disaster"
- Use "d." / "b." for English, "п." / "н." for Ukrainian, "ум." / "р." for Polish, etc. — use the abbreviation natural for the language detected in the title.
- Description: brief factual description of the person/event (role, significance, key facts) — 1-3 sentences. Do NOT include URLs in the description.
- Detect the language of the input title and write ALL fields (summary, description, location) in that same language.
- You MAY rewrite the title/summary to be more appropriate for the calendar context.
- Location: provide the most relevant location (birthplace for people on birthday calendars, place of death for death calendars, event site for historical events). Can be null if not applicable.
- Date: determine the correct historical date for this subject in YYYY-MM-DD format. For BC dates, use negative years (e.g., "-0479-08-11").
- sourceUrl: return the most relevant Wikipedia article URL (prefer the Wikipedia in the detected language). If no Wikipedia article exists, use another authoritative source.
- photoUrl: return a direct URL to a portrait or relevant image (Wikimedia Commons preferred). Return null if not found. The URL must point to an actual image file.
- Recurrence: suggest "YEARLY" for birthdays, death anniversaries, and annual holidays/commemorations. "NONE" for one-time historical events.
- Output ONLY valid JSON matching the required schema. No explanations.`;

export async function POST(request: Request) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const {
    title,
    calendarId,
    calendarName: providedCalendarName,
    modelName = "gemini-2.5-flash",
    currentFields,
    feedback,
  } = body;

  if (!title || !calendarId) {
    return NextResponse.json(
      { error: "Missing title or calendarId" },
      { status: 400 }
    );
  }

  // Resolve calendar name if not provided
  let calendarName = providedCalendarName;
  if (!calendarName) {
    const calendars = await listCalendars(client);
    const cal = calendars.find((c) => c.id === calendarId);
    calendarName = cal?.summary ?? "Unknown";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Build the user prompt
    let prompt = `Subject: "${title}"\nCalendar type: "${calendarName}"\n`;

    if (currentFields && feedback) {
      prompt += `\nThe user has reviewed the previous AI-generated data and wants corrections.\n`;
      prompt += `Current field values:\n${JSON.stringify(currentFields, null, 2)}\n`;
      prompt += `User feedback: "${feedback}"\n`;
      prompt += `\nPlease regenerate ALL fields taking the user's feedback into account.\n`;
    } else if (currentFields) {
      prompt += `\nPrevious data for context:\n${JSON.stringify(currentFields, null, 2)}\n`;
    }

    prompt += `\nResearch this subject and return the event data as JSON.`;

    console.log(`\n[AI Create] ── Request ─────────────────────────────────`);
    console.log(`[AI Create] Model:    ${modelName}`);
    console.log(`[AI Create] Title:    ${title}`);
    console.log(`[AI Create] Calendar: ${calendarName}`);
    console.log(`[AI Create] Feedback: ${feedback ?? "(none)"}`);

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
              description:
                "Event title formatted as 'YEAR — Name (dates)' or 'YEAR — Event Name'",
            },
            description: {
              type: Type.STRING,
              description:
                "Brief factual description (1-3 sentences). Do NOT include URLs here.",
            },
            location: {
              type: Type.STRING,
              description:
                "Most relevant location (birthplace, event site, etc.). Empty string if not applicable.",
              nullable: true,
            },
            date: {
              type: Type.STRING,
              description: "Historical date in YYYY-MM-DD format",
            },
            recurrence: {
              type: Type.STRING,
              description: "NONE, DAILY, WEEKLY, MONTHLY, or YEARLY",
            },
            sourceUrl: {
              type: Type.STRING,
              description:
                "Wikipedia article URL or other authoritative source URL",
            },
            photoUrl: {
              type: Type.STRING,
              description:
                "Direct URL to a portrait or relevant image. Empty string if not found.",
              nullable: true,
            },
          },
          required: [
            "summary",
            "description",
            "date",
            "recurrence",
            "sourceUrl",
          ],
        },
      },
    });

    const resultText = response.text;
    const finishReason = response.candidates?.[0]?.finishReason;

    console.log(`[AI Create] ── Response ────────────────────────────────`);
    console.log(`[AI Create] Finish reason: ${finishReason}`);
    console.log(`[AI Create] Raw response: ${resultText}`);

    if (!resultText) {
      throw new Error(
        `Gemini returned no content. Finish reason: ${finishReason ?? "unknown"}`
      );
    }

    let result: {
      summary: string;
      description: string;
      location?: string | null;
      date: string;
      recurrence: string;
      sourceUrl: string;
      photoUrl?: string | null;
    };

    try {
      result = JSON.parse(resultText);
    } catch {
      console.error(
        "[AI Create] Failed to parse Gemini JSON:",
        resultText?.slice(0, 500)
      );
      throw new Error("Gemini returned invalid JSON");
    }

    // Normalize recurrence
    const validRecurrences = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
    if (!validRecurrences.includes(result.recurrence)) {
      result.recurrence = "NONE";
    }

    console.log(`[AI Create] ── Done ────────────────────────────────────\n`);

    return NextResponse.json({
      success: true,
      event: {
        summary: result.summary,
        description: result.description,
        location: result.location || null,
        date: result.date,
        recurrence: result.recurrence,
        sourceUrl: result.sourceUrl,
        photoUrl: result.photoUrl || null,
      },
    });
  } catch (err: unknown) {
    console.error("[AI Create] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate event data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
