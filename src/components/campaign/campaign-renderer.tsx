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
  const discountedPriceSize = spec.offer.original_price_display
    ? "52px"
    : "44px";

  const subtitle =
    spec.commercial_copy.subtitle && spec.commercial_copy.subtitle.length > 0
      ? spec.commercial_copy.subtitle
      : null;

  const cta = spec.commercial_copy.cta || "Aproveite Agora!";

  return (
    <div
      className="relative w-full max-w-[1080px] aspect-[1/1] mx-auto overflow-hidden rounded-xl"
      style={{ backgroundColor: bgColor }}
    >
      {/* Zone 1 — Product Image */}
      <div className="absolute top-0 left-0 right-0 h-[55%] overflow-hidden">
        {productImageUrl ? (
          <>
            <img
              src={productImageUrl}
              alt={spec.offer.product_name}
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute bottom-0 left-0 right-0 h-[30px] bg-gradient-to-t from-black/[0.15] to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-400 gap-2">
            <ImageOff className="w-10 h-10" />
            <p className="text-sm font-body">Imagem do produto indisponível</p>
          </div>
        )}
      </div>

      {/* Zone 2 — Badge */}
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

      {/* Zone 3 — Bottom Section */}
      <div className="absolute bottom-0 left-0 right-0 h-[45%] flex flex-col items-center justify-center px-[40px] pb-[24px]">
        {/* Product Name */}
        <h2
          className="text-center font-heading font-bold text-[#1E293B] line-clamp-2 overflow-hidden text-ellipsis"
          style={{ fontSize: productNameSize }}
        >
          {spec.offer.product_name}
        </h2>

        {/* Price Zone */}
        {spec.offer.original_price_display && (
          <p className="text-center font-body text-[28px] text-slate-400 line-through mb-1">
            {spec.offer.original_price_display}
          </p>
        )}
        <p
          className="text-center font-heading font-bold leading-none"
          style={{ fontSize: discountedPriceSize, color: accentColor }}
        >
          {spec.offer.discounted_price_display}
        </p>

        {/* Description */}
        {subtitle && (
          <p className="text-center font-body text-[24px] text-slate-600 max-w-[960px] mx-auto line-clamp-2 overflow-hidden text-ellipsis mt-2">
            {subtitle}
          </p>
        )}

        {/* CTA Pill Button */}
        <button
          disabled
          className="mt-auto px-[18px] py-[14px] rounded-full text-white font-heading font-bold text-[22px] shadow-lg max-w-[70%] disabled:opacity-80 cursor-default"
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 4px 12px ${accentColor}4D`,
          }}
        >
          {cta}
        </button>

        {/* Store Identity */}
        <div className="mt-auto flex flex-col items-center gap-1 pt-2">
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
          <p className="text-center font-body text-[18px] text-slate-500 max-w-[600px] truncate">
            {storeIdentity.storeName}
          </p>
        </div>
      </div>
    </div>
  );
}
