"use client";

import { useMemo, useRef, useEffect } from "react";
import { Image, AlertCircle, Camera, Plus } from "lucide-react";
import { MAX_CAMPAIGN_IMAGES } from "@/lib/image-generation/config";
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
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const atLimit = productImages.length >= MAX_CAMPAIGN_IMAGES;

  // F41 (D4): object URLs por item para preview imediato de arquivos novos
  // (item.dataUrl só existe pós-restore/compressão). Revoked ao mudar/remover.
  const objectUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of productImages) {
      if (item.file instanceof File) {
        map.set(item.id, URL.createObjectURL(item.file));
      }
    }
    return map;
  }, [productImages]);

  useEffect(() => {
    const urls = [...objectUrls.values()];
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [objectUrls]);

  const resolveSrc = (item: CampaignProductFormImage): string =>
    item.dataUrl ?? objectUrls.get(item.id) ?? "";

  return (
    <div>
      <label className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
        Imagem do Produto *
      </label>

      <div
        onClick={() => {
          if (!atLimit) galleryRef.current?.click();
        }}
        className={`rounded-xl p-8 text-center min-h-[160px] cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center ${
          atLimit
            ? "border-2 border-dashed border-border-light opacity-50 cursor-not-allowed"
            : error
              ? "border-2 border-dashed border-accent-red bg-red-900/5"
              : "border-2 border-dashed border-border-light hover:border-text-muted hover:bg-bg-elevated/50"
        }`}
      >
        {productImages.length === 0 ? (
          <>
            <Image className="w-10 h-10 text-text-muted mb-3" />
            <p className="text-text-secondary text-sm font-body">
              Clique para selecionar a imagem
            </p>
            <p className="text-text-muted text-xs font-body mt-1">
              PNG, JPG, WEBP ou HEIC — Máximo 5MB
            </p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 w-full">
              {productImages.map((item, idx) => (
                <div
                  key={item.id}
                  className="relative rounded-lg overflow-hidden border border-border-light"
                >
                  <img
                    src={resolveSrc(item)}
                    alt={`Imagem ${idx + 1} do produto`}
                    className="w-full h-20 object-cover"
                  />
                  {item.role === "primary" && (
                    <span className="absolute top-1 left-1 bg-accent-green text-bg-base text-[10px] font-heading font-medium uppercase tracking-wider px-1.5 py-0.5 rounded">
                      Principal
                    </span>
                  )}
                  {item.source === "camera" && (
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      Câmera
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded hover:bg-black/80"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <p className="text-text-muted text-xs font-body mt-2">
              Clique para adicionar mais imagens
            </p>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={atLimit}
          onClick={() => galleryRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-xs font-body text-text-secondary hover:text-text-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Galeria
        </button>
        <button
          type="button"
          disabled={atLimit}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-xs font-body text-text-secondary hover:text-text-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera className="w-3.5 h-3.5" />
          Câmera
        </button>
        {atLimit && (
          <span className="text-text-muted text-xs font-body">
            Máximo de {MAX_CAMPAIGN_IMAGES} imagens
          </span>
        )}
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          for (const f of files) onAdd(f, "upload");
          e.target.value = "";
        }}
      />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (file) {
            onAdd(file, "camera");
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
