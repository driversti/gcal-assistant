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
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105"
      title="Create event with AI"
    >
      <Sparkles className="h-6 w-6" />
    </Button>
  );
}
