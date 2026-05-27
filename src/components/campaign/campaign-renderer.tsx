"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { CampaignSpec } from "@/lib/campaign-intelligence/schema";
import type { StoreIdentitySnapshot } from "./types";
import {
  resolveCampaignAccentColor,
  resolveCampaignBackgroundColor,
  getStoreInitials,
} from "./types";

interface CampaignRendererProps {
  spec: CampaignSpec;
  storeIdentity: StoreIdentitySnapshot;
  productImageUrl: string | null;
}

export function CampaignRenderer({
  spec,
  storeIdentity,
  productImageUrl,
}: CampaignRendererProps) {
  const [showInitialsFallback, setShowInitialsFallback] = useState(false);

  const accentColor = resolveCampaignAccentColor(
    spec.visual_parameters.palette_accent,
    storeIdentity.storeSegment,
    storeIdentity.brandColor
  );

  const bgColor = resolveCampaignBackgroundColor(storeIdentity.storeSegment);

  const productNameSize =
    spec.offer.product_name.length > 40 ? "36px" : "42px";

  const cta = spec.commercial_copy.cta || "Aproveite Agora!";

  return (
    <div
      className="relative w-full max-w-[1080px] aspect-[1/1] mx-auto overflow-hidden rounded-xl flex flex-col"
      style={{ backgroundColor: bgColor }}
    >
      {/* Product Image Zone — 60% */}
      <div
        className="flex-[6] relative overflow-hidden"
        style={{ boxShadow: "inset 0 -8px 12px -8px rgba(0,0,0,0.08)" }}
      >
        {productImageUrl ? (
          <img
            src={productImageUrl}
            alt={spec.offer.product_name}
            className="w-full h-full object-contain object-center"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400 gap-2">
            <ImageOff className="w-10 h-10" />
            <p className="text-sm font-body">Imagem do produto não disponível</p>
          </div>
        )}

        {/* Badge */}
        {spec.offer.badge_text && spec.offer.badge_text.length > 0 && (
          <div className="absolute top-6 right-6 z-10">
            <span
              className="inline-block px-[10px] py-[6px] rounded-full text-white font-heading font-bold text-[24px] leading-none shadow-sm"
              style={{ backgroundColor: accentColor }}
            >
              {spec.offer.badge_text}
            </span>
          </div>
        )}
      </div>

      {/* Text Zone — 40% */}
      <div className="flex-[4] flex flex-col items-center justify-center px-10 pb-4 pt-2">
        {/* Product Name */}
        <h2
          className="text-center font-heading font-bold text-[#1E293B] line-clamp-2 overflow-hidden text-ellipsis"
          style={{ fontSize: productNameSize }}
        >
          {spec.offer.product_name}
        </h2>

        {/* Price Block */}
        {spec.offer.original_price_display && (
          <p className="text-center font-body text-[24px] text-slate-400 line-through italic mt-1">
            {spec.offer.original_price_display}
          </p>
        )}
        <p
          className="text-center font-heading font-extrabold leading-tight tracking-tight"
          style={{
            fontSize: "56px",
            color: accentColor,
            textShadow: "0 2px 4px rgba(0,0,0,0.06)",
            letterSpacing: "-0.02em",
          }}
        >
          {spec.offer.discounted_price_display}
        </p>

        {/* Hook — only if present */}
        {spec.commercial_copy.hook && spec.commercial_copy.hook.length > 0 && (
          <p className="text-center font-body text-[24px] text-slate-600 italic leading-relaxed line-clamp-2 overflow-hidden text-ellipsis max-w-[960px] mx-auto mt-2">
            {spec.commercial_copy.hook}
          </p>
        )}

        {/* Bottom group: CTA + Store Identity */}
        <div className="flex flex-col items-center gap-1 mt-auto">
          {/* CTA Visual Pill — non-interactive campaign element */}
          <div
            className="px-6 py-3 rounded-full text-white font-heading font-bold text-[22px] whitespace-nowrap max-w-[90%]"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 4px 12px ${accentColor}1A`,
            }}
          >
            {cta}
          </div>

          {/* Store Identity */}
          <div className="flex flex-col items-center gap-1">
            {storeIdentity.logoUrl && !showInitialsFallback ? (
              <img
                src={storeIdentity.logoUrl}
                alt={storeIdentity.storeName}
                className="w-[40px] h-[40px] rounded-full object-cover"
                onError={() => setShowInitialsFallback(true)}
              />
            ) : (
              <div
                className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-white font-heading font-semibold text-[18px]"
                style={{
                  backgroundColor: storeIdentity.brandColor || accentColor,
                }}
              >
                {getStoreInitials(storeIdentity.storeName)}
              </div>
            )}
            <p className="text-center font-body text-[16px] text-slate-500 max-w-[600px] truncate">
              {storeIdentity.storeName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
