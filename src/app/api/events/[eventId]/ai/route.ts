import { type NextRequest, NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { updateEvent } from "@/lib/google/update-event";
import { google } from "googleapis";
import { GoogleGenAI, Type } from "@google/genai";

// Truncate overly long text to avoid hitting model output token limits.
// We cap the description at ~4000 chars so the translated output fits within limits.
const MAX_DESCRIPTION_CHARS = 4000;

const SYSTEM_INSTRUCTION = `You are a multilingual assistant specialized in translating and localizing Google Calendar events.

Your task is to translate the provided calendar event fields (title, location, description) into the requested target language.

Rules you must follow:
- Translate ALL provided fields into the target language. Never skip a field that has content.
- If a field is not present in the input, return an empty string for it in the JSON output.
- Output ONLY the translated text. Do NOT include any explanations, alternatives, notes, commentary, caveats, or reasoning — ever.
- Do not add phrases like "Note:", "Translation:", "Alternatively:", or parenthetical remarks.
- Preserve the meaning, tone, and intent of the original text. Do not add, remove, or invent information.
- Produce natural, fluent language appropriate for a calendar event — not a literal word-for-word translation.
- For the description: preserve its structure (line breaks, lists, URLs) as much as possible, only translating the human-readable text portions.
- Your output must always be valid JSON matching the required schema exactly. Nothing else.`;

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

  const { calendarId, targetLanguage, modelName = "gemini-3.1-flash-lite-preview" } = body;
  if (!calendarId || !targetLanguage) {
    return NextResponse.json(
      { error: "Missing calendarId or targetLanguage" },
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

    const hasTitle = !!event.summary;
    const hasDescription = !!event.description;
    const hasLocation = !!event.location;

    // Truncate description if extremely long to avoid output token limit issues
    const descriptionText = event.description
      ? event.description.length > MAX_DESCRIPTION_CHARS
        ? event.description.slice(0, MAX_DESCRIPTION_CHARS) + "\n... [truncated for translation]"
        : event.description
      : "";

    // 2. Prepare the user prompt with the raw event data
    let prompt = `Please translate the following calendar event into: "${targetLanguage}".\n\n`;
    if (hasTitle) prompt += `Title: ${event.summary}\n`;
    if (hasLocation) prompt += `Location: ${event.location}\n`;
    if (hasDescription) prompt += `Description:\n${descriptionText}\n`;

    // 3. Call Gemini API
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    console.log(`\n[AI Route] ── Request ──────────────────────────────────`);
    console.log(`[AI Route] Model:    ${modelName}`);
    console.log(`[AI Route] Language: ${targetLanguage}`);
    console.log(`[AI Route] Event:    ${event.summary ?? "(no title)"} (${eventId})`);
    console.log(`[AI Route] System instruction:\n${SYSTEM_INSTRUCTION.split("\n").map(l => "  " + l).join("\n")}`);
    console.log(`[AI Route] User prompt:\n${prompt.split("\n").map(l => "  " + l).join("\n")}`);
    console.log(`[AI Route] Prompt length: ${prompt.length} chars`);

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        // Set explicit output token limit to prevent truncation
        maxOutputTokens: 2048,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "The translated title (if provided), or empty string." },
            location: { type: Type.STRING, description: "The translated location (if provided), or empty string." },
            description: { type: Type.STRING, description: "The translated description (if provided), or empty string." },
          },
        },
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    console.log(`[AI Route] ── Response ─────────────────────────────────`);
    console.log(`[AI Route] Finish reason: ${finishReason}`);
    console.log(`[AI Route] Response length: ${response.text?.length ?? 0} chars`);
    console.log(`[AI Route] Raw response: ${response.text}`);

    const resultText = response.text;

    if (!resultText) {
      throw new Error(`Gemini returned no content. Finish reason: ${finishReason ?? "unknown"}`);
    }

    let result: { summary?: string; location?: string; description?: string };
    try {
      result = JSON.parse(resultText);
    } catch {
      console.error("[AI Route] Failed to parse Gemini JSON:", resultText?.slice(0, 500));
      throw new Error("Gemini returned invalid JSON. The event description may be too long to translate.");
    }

    // 4. Update the event
    const updates: Record<string, string> = {};
    if (hasTitle && result.summary) updates.summary = result.summary;
    if (hasLocation && result.location) updates.location = result.location;
    if (hasDescription && result.description) updates.description = result.description;

    const isRecurring = !!event.recurringEventId;
    console.log(`[AI Route] Fields to update: ${JSON.stringify(Object.keys(updates))}`);
    console.log(`[AI Route] Recurring: ${isRecurring}${isRecurring ? ` (series: ${event.recurringEventId})` : ""}`);

    if (Object.keys(updates).length > 0) {
      if (isRecurring) {
        // The only way to update ALL occurrences (including far-future unmaterialized
        // instances like 2027+) is to do a full PUT (events.update) on the master event.
        // events.patch on the master only affects the template for new instances.
        // events.instances only returns materialised instances within a limited window.
        const masterId = event.recurringEventId!;

        console.log(`[AI Route] Fetching master event: ${masterId}`);
        const { data: masterEvent } = await calendarApi.events.get({
          calendarId,
          eventId: masterId,
        });

        // Merge the translation into the full master event resource
        const updatedMaster = {
          ...masterEvent,
          ...updates,
        };

        console.log(`[AI Route] Full PUT on master event: ${masterId}`);
        await calendarApi.events.update({
          calendarId,
          eventId: masterId,
          requestBody: updatedMaster,
        });

        // Also directly patch the specific instance that was requested.
        // Existing materialized instances keep their own identity and don't
        // automatically inherit master changes, so we must patch them explicitly.
        if (eventId !== masterId) {
          console.log(`[AI Route] Patching specific instance: ${eventId}`);
          await calendarApi.events.patch({
            calendarId,
            eventId,
            requestBody: updates,
          });
        }

        console.log(`[AI Route] Master updated + instance patched`);
      } else {
        await updateEvent(client, calendarId, eventId, updates, "single");
      }
    }

    console.log(`[AI Route] ── Done ─────────────────────────────────────\n`);


    return NextResponse.json({
      success: true,
      model: modelName,
      language: targetLanguage,
      updatedFields: Object.keys(updates),
      debug: {
        eventId,
        isRecurring,
        masterId: event.recurringEventId ?? null,
        masterSummaryBeforeUpdate: isRecurring ? "(check logs)" : null,
      },
      result: {
        summary: result.summary ?? null,
        location: result.location ?? null,
        description: result.description ?? null,
      },
    });
  } catch (err: unknown) {
    console.error("[AI Route] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to process AI translation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
