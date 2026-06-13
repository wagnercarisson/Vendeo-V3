"use client";

import { Loader2 } from "lucide-react";

interface DriftDiscreetButtonProps {
  onClick: () => Promise<void>
  isLoading: boolean
}

export function DriftDiscreetButton({ onClick, isLoading }: DriftDiscreetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="text-text-muted text-xs underline cursor-pointer hover:text-text-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
    >
      {isLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
      Direção visual pode estar desatualizada
    </button>
  );
}
