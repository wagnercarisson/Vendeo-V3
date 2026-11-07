"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ImageOff } from "lucide-react";

interface AvailableCampaignCardProps {
  id: string;
  productName: string;
  dateLabel: string;
  formatLabel: string | null;
  thumbnailUrl: string | null;
  openAria: string;
  openLabel: string;
}

/**
 * Linha de campanha disponível no dashboard (F58).
 *
 * A linha é não interativa; apenas a ação visível “Abrir campanha” é um link,
 * evitando links/botões aninhados. A miniatura é decorativa (`alt=""`) e o
 * fallback preserva a ação mesmo quando a arte não está disponível.
 */
export function AvailableCampaignCard({
  id,
  productName,
  dateLabel,
  formatLabel,
  thumbnailUrl,
  openAria,
  openLabel,
}: AvailableCampaignCardProps) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const showImage = Boolean(thumbnailUrl) && !failed;

  useEffect(() => {
    // Uma URL nova precisa limpar a falha anterior: depois de um erro, trocar
    // por uma miniatura válida deve voltar a exibir a imagem.
    setFailed(false);

    // Se a imagem falhar antes da hidratação, o navegador não reemite `error`
    // para o React. Detecta o estado quebrado no mount e aplica o fallback.
    const image = imageRef.current;
    if (image && image.complete && image.naturalWidth === 0) {
      setFailed(true);
    }
  }, [thumbnailUrl]);

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3 sm:flex-1">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-elevated sm:h-24 sm:w-24">
          {showImage && thumbnailUrl ? (
            <img
              ref={imageRef}
              src={thumbnailUrl}
              alt=""
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageOff
                className="h-6 w-6 text-text-disabled"
                aria-hidden="true"
              />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <span
            lang=""
            className="break-words font-heading text-base font-semibold leading-snug text-text-primary sm:text-lg"
          >
            {productName}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary font-body">
            <span className="whitespace-nowrap">{dateLabel}</span>
            {formatLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <Link
        href={`/campanhas/${id}`}
        aria-label={openAria}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-border-light px-4 text-sm font-semibold text-text-primary transition-colors duration-200 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep sm:w-auto"
      >
        {openLabel}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
