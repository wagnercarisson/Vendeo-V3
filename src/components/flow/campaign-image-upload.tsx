"use client";

import { useRef } from "react";
import { Image, AlertCircle } from "lucide-react";

interface CampaignImageUploadProps {
  imageFile: File | null;
  error: string | null;
  previewUrl: string | null;
  onSelect: (file: File | null) => void;
}

export function CampaignImageUpload({
  imageFile,
  error,
  previewUrl,
  onSelect,
}: CampaignImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

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
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Preview do produto"
              className="max-h-[200px] mx-auto rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
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
              PNG, JPG ou WEBP — Máximo 5MB
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => {
          onSelect(e.target.files?.[0] ?? null);
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
