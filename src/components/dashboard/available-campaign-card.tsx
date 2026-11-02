"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ImageOff } from "lucide-react";

interface AvailableCampaignCardProps {
  id: string;
  productName: string;
  dateLabel: string;
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
  thumbnailUrl,
  openAria,
  openLabel,
}: AvailableCampaignCardProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(thumbnailUrl) && !failed;

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3 sm:flex-1">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-elevated sm:h-24 sm:w-24">
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
          <span className="mt-1 block whitespace-nowrap text-sm text-text-secondary font-body">
            {dateLabel}
          </span>
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
