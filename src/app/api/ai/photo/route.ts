import { NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are a photo research assistant. Given a subject (person, event, place), find multiple direct URLs to portraits or relevant images.

Rules:
- Return direct image URLs (must end in .jpg, .jpeg, .png, .svg, or be Wikimedia Commons file URLs)
- Prefer Wikimedia Commons images — they are the most reliable
- For people: prefer portrait/headshot photos
- For events: prefer iconic or representative images
- Do NOT return thumbnail URLs — return the full-resolution original
- Return diverse images — different poses, angles, time periods, or sources
- Each URL must be unique — no duplicates
- If given rejected URLs, do NOT return any of them
- Output ONLY valid JSON matching the required schema`;

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
  const { subject, rejectedUrls = [], modelName = "gemini-2.5-flash", count = 6 } = body;

  if (!subject) {
    return NextResponse.json(
      { error: "Missing subject" },
      { status: 400 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let prompt = `Find ${count} different photos for: "${subject}"`;
    if (rejectedUrls.length > 0) {
      prompt += `\n\nDo NOT return any of these URLs (they are broken or unsuitable):\n${rejectedUrls.map((u: string) => `- ${u}`).join("\n")}`;
      prompt += `\n\nFind completely different images.`;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        maxOutputTokens: 1024,
        tools: [{ googleSearch: {} }],
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            photos: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
                description: "Direct URL to an image file",
              },
              description: `Array of ${count} unique image URLs`,
            },
          },
          required: ["photos"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Gemini returned no content");
    }

    const result = JSON.parse(resultText);
    const photos: string[] = (result.photos || []).filter((u: string) => u && typeof u === "string");
    return NextResponse.json({ photos });
  } catch (err: unknown) {
    console.error("[AI Photo] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to find photos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
