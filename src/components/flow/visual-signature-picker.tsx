"use client";

import type { CascadeResult } from "@/lib/visual-signature/types";
import { Loader2 } from "lucide-react";

interface VisualSignaturePickerProps {
  variations: CascadeResult[];
  selectedId: string | null;
  onSelect: (variation: CascadeResult) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

function getVariationKey(variation: CascadeResult, index: number): string {
  return variation.storagePath || `var-${index}`;
}

export function VisualSignaturePicker({
  variations,
  selectedId,
  onSelect,
  onConfirm,
  isLoading,
}: VisualSignaturePickerProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {variations.map((variation, index) => {
          const key = getVariationKey(variation, index);
          const isSelected = selectedId === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(variation)}
              className={`relative rounded-xl border-2 transition-all duration-200 overflow-hidden text-left ${
                isSelected
                  ? "border-accent-blue ring-2 ring-accent-blue/20"
                  : "border-border-light hover:border-text-muted"
              }`}
            >
              <div className="aspect-[5/3] bg-bg-elevated flex items-center justify-center overflow-hidden">
                <img
                  src={variation.assetUrl}
                  alt={`Variação ${index + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-text-primary text-sm font-body">
                  Opção {index + 1}
                </span>
                {variation.tier === "typographic" && (
                  <span className="px-2 py-0.5 bg-bg-elevated text-text-muted text-xs font-body rounded-full">
                    Simples
                  </span>
                )}
                {variation.tier !== "typographic" && (
                  <span className="px-2 py-0.5 bg-accent-blue/10 text-accent-blue text-xs font-body rounded-full">
                    Gerado por IA
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!selectedId || isLoading}
        onClick={onConfirm}
        className="w-full px-6 py-3 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Salvando...
          </>
        ) : (
          "Usar esta assinatura"
        )}
      </button>
    </div>
  );
}
