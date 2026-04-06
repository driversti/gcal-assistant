import { NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";
import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are a photo research assistant. Given a subject (person, event, place), find a direct URL to a portrait or relevant image.

Rules:
- Return a direct image URL (must end in .jpg, .jpeg, .png, .svg, or be a Wikimedia Commons file URL)
- Prefer Wikimedia Commons images — they are the most reliable
- For people: prefer portrait/headshot photos
- For events: prefer iconic or representative images
- Do NOT return thumbnail URLs — return the full-resolution original
- If given rejected URLs, find a DIFFERENT image — do not return any of the rejected URLs
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
  const { subject, rejectedUrls = [], modelName = "gemini-2.5-flash" } = body;

  if (!subject) {
    return NextResponse.json(
      { error: "Missing subject" },
      { status: 400 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let prompt = `Find a photo for: "${subject}"`;
    if (rejectedUrls.length > 0) {
      prompt += `\n\nDo NOT return any of these URLs (they are broken or unsuitable):\n${rejectedUrls.map((u: string) => `- ${u}`).join("\n")}`;
      prompt += `\n\nFind a completely different image.`;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        maxOutputTokens: 512,
        tools: [{ googleSearch: {} }],
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            photoUrl: {
              type: Type.STRING,
              description: "Direct URL to an image file",
            },
          },
          required: ["photoUrl"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Gemini returned no content");
    }

    const result = JSON.parse(resultText);
    return NextResponse.json({ photoUrl: result.photoUrl || "" });
  } catch (err: unknown) {
    console.error("[AI Photo] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to find photo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
