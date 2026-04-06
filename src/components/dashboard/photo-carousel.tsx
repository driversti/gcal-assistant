"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Sparkles, ImageOff, Check } from "lucide-react";

interface PhotoCarouselProps {
  photoUrl: string;
  onPhotoUrlChange: (url: string) => void;
  subject: string;
  sourceUrl?: string;
  modelName: string;
  disabled?: boolean;
}

interface PhotoCandidate {
  url: string;
  broken: boolean;
}

export function PhotoCarousel({
  photoUrl,
  onPhotoUrlChange,
  subject,
  sourceUrl,
  modelName,
  disabled = false,
}: PhotoCarouselProps) {
  const [candidates, setCandidates] = useState<PhotoCandidate[]>([]);
  const [loading, setLoading] = useState<"wikimedia" | "ai" | null>(null);
  const [rejectedUrls, setRejectedUrls] = useState<string[]>([]);

  function addCandidates(urls: string[]) {
    const existing = new Set(candidates.map((c) => c.url));
    const newCandidates = urls
      .filter((url) => !existing.has(url))
      .map((url) => ({ url, broken: false }));
    setCandidates((prev) => [...prev, ...newCandidates]);
  }

  async function handleSearchWikimedia() {
    if (!subject && !sourceUrl) return;
    setLoading("wikimedia");

    try {
      const res = await fetch("/api/ai/photo/wikimedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, sourceUrl }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to search Wikimedia");
      }

      const data = await res.json();
      const photos: string[] = data.photos || [];
      if (photos.length > 0) {
        addCandidates(photos);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(null);
    }
  }

  async function handleSearchAi() {
    if (!subject) return;
    setLoading("ai");

    try {
      const res = await fetch("/api/ai/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          rejectedUrls,
          modelName: modelName || "gemini-2.5-flash",
          count: 6,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to find photos");
      }

      const data = await res.json();
      const photos: string[] = data.photos || [];
      if (photos.length > 0) {
        addCandidates(photos);
        setRejectedUrls((prev) => [...prev, ...photos]);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(null);
    }
  }

  function markBroken(url: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.url === url ? { ...c, broken: true } : c))
    );
  }

  const isLoading = loading !== null;

  return (
    <div className="min-w-0 space-y-1.5">
      <label className="text-xs font-medium">Photo</label>

      {/* Carousel */}
      {candidates.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {candidates.map((candidate) => (
            <button
              key={candidate.url}
              type="button"
              disabled={disabled || candidate.broken}
              onClick={() => onPhotoUrlChange(candidate.url)}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                candidate.broken
                  ? "border-muted opacity-40"
                  : candidate.url === photoUrl
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-transparent hover:border-muted-foreground/30"
              }`}
            >
              {!candidate.broken ? (
                <img
                  src={candidate.url}
                  alt="Candidate"
                  className="h-full w-full object-cover"
                  onError={() => markBroken(candidate.url)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                  <ImageOff className="h-4 w-4" />
                </div>
              )}
              {candidate.url === photoUrl && !candidate.broken && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                  <Check className="h-5 w-5 text-primary drop-shadow" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* URL input */}
      <Input
        value={photoUrl}
        onChange={(e) => onPhotoUrlChange(e.target.value)}
        disabled={disabled}
        placeholder="Photo URL (optional)"
        className="text-xs"
      />

      {/* Search buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSearchWikimedia}
          disabled={disabled || isLoading || (!subject && !sourceUrl)}
          className="flex-shrink-0"
        >
          {loading === "wikimedia" ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Search className="mr-1 h-3 w-3" />
          )}
          Wikimedia
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSearchAi}
          disabled={disabled || isLoading || !subject}
          className="flex-shrink-0"
        >
          {loading === "ai" ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-3 w-3" />
          )}
          AI Search
        </Button>
      </div>

      {candidates.some((c) => c.broken) && (
        <p className="text-xs text-muted-foreground">
          {candidates.filter((c) => c.broken).length} broken image(s) hidden
        </p>
      )}
    </div>
  );
}
