"use client";

import { useRef } from "react";
import { Image, AlertCircle } from "lucide-react";
import type { CampaignProductFormImage } from "./use-campaign-form";

interface CampaignImageUploadProps {
  productImages: CampaignProductFormImage[];
  error: string | null;
  onAdd: (file: File, source: "upload" | "camera") => void;
  onRemove: (id: string) => void;
}

export function CampaignImageUpload({
  productImages,
  error,
  onAdd,
  onRemove,
}: CampaignImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const primary = productImages[0];

  return (
    <div>
      <label className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
        Imagem do Produto *
      </label>

      <div
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl p-8 text-center min-h-[160px] cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center ${
          error
            ? "border-2 border-dashed border-accent-red bg-red-900/5"
            : "border-2 border-dashed border-border-light hover:border-text-muted hover:bg-bg-elevated/50"
        }`}
      >
        {primary?.dataUrl ? (
          <>
            <img
              src={primary.dataUrl}
              alt="Preview do produto"
              className="max-h-[200px] mx-auto rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(primary.id);
              }}
              className="mt-3 text-text-muted hover:text-text-primary text-xs underline transition-colors duration-200"
            >
              Remover imagem
            </button>
          </>
        ) : (
          <>
            <Image className="w-10 h-10 text-text-muted mb-3" />
            <p className="text-text-secondary text-sm font-body">
              Clique para selecionar a imagem
            </p>
            <p className="text-text-muted text-xs font-body mt-1">
              PNG, JPG, WEBP ou HEIC — Máximo 5MB
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (file) {
            onAdd(file, "upload");
          }
          e.target.value = "";
        }}
      />

      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-accent-red text-xs">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}
