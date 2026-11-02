"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, ImageOff } from "lucide-react";

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
      className="group flex min-h-[80px] items-center gap-3 rounded-xl border border-border bg-bg-surface p-2.5 transition-colors duration-200 hover:border-border-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep sm:p-3"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-bg-elevated sm:h-16 sm:w-16">
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
              className="h-5 w-5 text-text-disabled"
              aria-hidden="true"
            />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span
          lang=""
          className="line-clamp-2 break-words text-sm font-semibold leading-normal text-text-primary font-heading"
        >
          {productName}
        </span>
        <span className="mt-0.5 block whitespace-nowrap text-xs text-text-secondary font-body">
          {dateLabel}
        </span>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-text-muted"
        aria-hidden="true"
      />
    </Link>
  );
}
