"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AiCreateFabProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AiCreateFab({ onClick, disabled }: AiCreateFabProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="icon"
      className="absolute bottom-6 right-4 z-30 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      title="Create event with AI"
    >
      <Sparkles className="h-6 w-6" />
    </Button>
  );
}
