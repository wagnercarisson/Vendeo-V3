"use client";

import Link from "next/link";
import { useState } from "react";
import { ImageOff } from "lucide-react";

interface AvailableCampaignCardProps {
  id: string;
  productName: string;
  dateLabel: string;
  thumbnailUrl: string | null;
  openAria: string;
}

/**
 * Cartão de campanha disponível no dashboard (F58).
 *
 * O cartão inteiro é um único link para `/campanhas/[id]`; a miniatura é
 * decorativa (`alt=""`) porque o nome acessível vem do `aria-label`
 * localizado. Falha de imagem troca o conteúdo da moldura em lugar, mantendo
 * o link funcional e sem deslocamento de layout.
 */
export function AvailableCampaignCard({
  id,
  productName,
  dateLabel,
  thumbnailUrl,
  openAria,
}: AvailableCampaignCardProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(thumbnailUrl) && !failed;

  return (
    <Link
      href={`/campanhas/${id}`}
      aria-label={openAria}
      className="group block overflow-hidden rounded-xl border border-border bg-bg-surface transition-colors duration-200 hover:border-border-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-bg-elevated">
        {showImage && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff
              className="h-8 w-8 text-text-disabled"
              aria-hidden="true"
            />
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <span
          lang=""
          className="line-clamp-2 break-words text-sm font-semibold leading-normal text-text-primary font-heading"
        >
          {productName}
        </span>
        <span className="mt-1 block whitespace-nowrap text-xs text-text-secondary font-body">
          {dateLabel}
        </span>
      </div>
    </Link>
  );
}
