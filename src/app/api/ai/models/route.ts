import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  console.log("Hitting GET /api/ai/models. Key is:", !!process.env.GEMINI_API_KEY);
  
  if (!process.env.GEMINI_API_KEY) {
    console.log("No API key found in server");
    return NextResponse.json({ models: [] });
  }

  try {
    const ai = new GoogleGenAI({});
    const response = await ai.models.list();
    
    const models = [];
    for await (const m of response) {
      if (m.name && m.name.includes("gemini")) {
        models.push({
          name: m.name.replace("models/", ""),
          displayName: m.displayName || m.name,
        });
      }
    }

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Failed to fetch AI models:", error);
    import('fs').then(fs => fs.writeFileSync('/tmp/gca-models-error.log', String(error)));
    return NextResponse.json({ models: [] });
  }
}
