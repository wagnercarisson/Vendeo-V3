import { SEGMENT_COLOR_FALLBACK } from "@/lib/store";
import { uploadToStorage, persistSignature } from "./persistence";
import type { CascadeResult, VisualSignatureMetadata } from "./types";

export function getStoreInitials(storeName: string): string {
  const words = storeName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return storeName.trim().slice(0, 2).toUpperCase();
}

export class TypographicFallbackGenerator {
  async generate(params: {
    storeId: string;
    storeName: string;
    brandColor?: string | null;
    segment?: string;
  }): Promise<CascadeResult> {
    const initials = getStoreInitials(params.storeName);
    const brandColor =
      params.brandColor ??
      (params.segment ? SEGMENT_COLOR_FALLBACK[params.segment] : undefined) ??
      "#22C55E";

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200">
  <circle cx="200" cy="80" r="60" fill="${brandColor}" />
  <text x="200" y="95" fill="#FFFFFF" font-family="sans-serif" font-weight="700" font-size="48px" text-anchor="middle">${initials}</text>
  <text x="200" y="160" fill="${brandColor}" font-family="sans-serif" font-weight="500" font-size="20px" text-anchor="middle">${params.storeName}</text>
</svg>`;

    const buffer = Buffer.from(svgString, "utf-8");

    try {
      const { storagePath, assetUrl } = await uploadToStorage({
        storeId: params.storeId,
        buffer,
        mimeType: "image/svg+xml",
      });

      const metadata: VisualSignatureMetadata = {
        generation_tier: "typographic",
      };

      await persistSignature({
        store_id: params.storeId,
        storage_path: storagePath,
        asset_url: assetUrl,
        type: "fallback_typographic",
        status: "active",
        generation_mode: "fallback",
        prompt: undefined,
        metadata,
      });

      return {
        tier: "typographic",
        assetUrl,
        storagePath,
        mimeType: "image/svg+xml",
      };
    } catch (error) {
      throw new Error(
        `TypographicFallbackGenerator failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
