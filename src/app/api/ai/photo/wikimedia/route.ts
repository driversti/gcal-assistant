import { NextResponse } from "next/server";
import { getAuthClient } from "@/lib/auth/get-auth-client";

/**
 * Search Wikimedia Commons for images related to a Wikipedia article or subject.
 * Uses two strategies:
 * 1. If a Wikipedia sourceUrl is provided, fetch images from that article
 * 2. Otherwise, search Commons directly by subject text
 */
export async function POST(request: Request) {
  const client = await getAuthClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { subject, sourceUrl } = body;

  if (!subject && !sourceUrl) {
    return NextResponse.json(
      { error: "Missing subject or sourceUrl" },
      { status: 400 }
    );
  }

  try {
    let photos: string[] = [];

    // Strategy 1: Extract images from the Wikipedia article
    if (sourceUrl && sourceUrl.includes("wikipedia.org")) {
      photos = await fetchFromWikipediaArticle(sourceUrl);
    }

    // Strategy 2: Search Commons directly if we don't have enough
    if (photos.length < 6 && subject) {
      const commonsPhotos = await searchCommons(subject);
      // Deduplicate
      const existing = new Set(photos);
      for (const url of commonsPhotos) {
        if (!existing.has(url)) {
          photos.push(url);
          existing.add(url);
        }
      }
    }

    // Limit to 12 max
    photos = photos.slice(0, 12);

    return NextResponse.json({ photos });
  } catch (err: unknown) {
    console.error("[Wikimedia] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to search Wikimedia";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Fetch images embedded in a Wikipedia article
 */
async function fetchFromWikipediaArticle(url: string): Promise<string[]> {
  // Extract language and title from URL
  // e.g. https://uk.wikipedia.org/wiki/Тарас_Шевченко
  const match = url.match(
    /https?:\/\/(\w+)\.wikipedia\.org\/wiki\/(.+?)(?:#.*)?$/
  );
  if (!match) return [];

  const [, lang, rawTitle] = match;
  const title = decodeURIComponent(rawTitle);

  // Get images from the article via Wikipedia API
  const apiUrl = `https://${lang}.wikipedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      titles: title,
      prop: "images",
      imlimit: "50",
      format: "json",
      origin: "*",
    });

  const res = await fetch(apiUrl);
  if (!res.ok) return [];

  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return [];

  const page = Object.values(pages)[0] as { images?: { title: string }[] };
  const imageFiles = (page.images || [])
    .map((img) => img.title)
    .filter((title) => /\.(jpg|jpeg|png|svg)$/i.test(title))
    // Filter out common non-useful images
    .filter((title) => {
      const lower = title.toLowerCase();
      return (
        !lower.includes("icon") &&
        !lower.includes("logo") &&
        !lower.includes("flag") &&
        !lower.includes("commons-logo") &&
        !lower.includes("wiki") &&
        !lower.includes("stub") &&
        !lower.includes("edit-clear") &&
        !lower.includes("question_book") &&
        !lower.includes("disambig") &&
        !lower.includes("p_") &&
        !lower.includes("crystal_clear") &&
        !lower.includes("ambox") &&
        !lower.includes("gnome-") &&
        !lower.includes("nuvola")
      );
    });

  if (imageFiles.length === 0) return [];

  // Resolve file names to actual URLs via Wikimedia Commons API
  return resolveFileUrls(imageFiles.slice(0, 12));
}

/**
 * Search Wikimedia Commons directly by text
 */
async function searchCommons(subject: string): Promise<string[]> {
  const apiUrl = `https://commons.wikimedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${subject} filetype:bitmap`,
      gsrlimit: "12",
      gsrnamespace: "6", // File namespace
      prop: "imageinfo",
      iiprop: "url|size",
      iiurlwidth: "800",
      format: "json",
      origin: "*",
    });

  const res = await fetch(apiUrl);
  if (!res.ok) return [];

  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return [];

  return Object.values(pages)
    .map((page: unknown) => {
      const p = page as {
        imageinfo?: { thumburl?: string; url?: string; width?: number }[];
      };
      const info = p.imageinfo?.[0];
      // Prefer the 800px thumbnail for faster loading, fall back to original
      return info?.thumburl || info?.url || "";
    })
    .filter((url) => url.length > 0);
}

/**
 * Resolve Wikimedia file titles to direct URLs
 */
async function resolveFileUrls(fileTitles: string[]): Promise<string[]> {
  // Batch into groups of 50 (API limit)
  const batch = fileTitles.slice(0, 50).join("|");

  const apiUrl = `https://commons.wikimedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      titles: batch,
      prop: "imageinfo",
      iiprop: "url|size",
      iiurlwidth: "800",
      format: "json",
      origin: "*",
    });

  const res = await fetch(apiUrl);
  if (!res.ok) return [];

  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return [];

  return Object.values(pages)
    .map((page: unknown) => {
      const p = page as {
        imageinfo?: { thumburl?: string; url?: string; width?: number }[];
      };
      const info = p.imageinfo?.[0];
      return info?.thumburl || info?.url || "";
    })
    .filter((url) => url.length > 0);
}
