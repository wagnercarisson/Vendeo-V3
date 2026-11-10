/**
 * Responsive delivery contract for the `/ofertas-para-mercados` images.
 *
 * Two WebP candidates per image (480w and 1024w), preserving the intrinsic
 * aspect ratio of each asset:
 *
 * - Demonstration pair: on desktop the photo is capped at 360 px and the
 *   campaign at 480 px. The centered grid distributes the available width
 *   proportionally on tablet: at 834 the photo measures ~306 px and the
 *   campaign ~408 px; on mobile both are capped at 420 px / the content width.
 *   480w covers 1x; 1024w covers 2x.
 * - Photo is 1536×1024 (3:2), so 1024w is capped at 1024×683. The campaign is
 *   1024×1024 (1:1). The photo is vertically centered against the taller
 *   campaign.
 * - Coffee example: text left, image right; the image column measures ~468 px
 *   at 1440, ~373 px at 834 and up to 420 px on mobile. The approved coffee
 *   already has 480w and a 1024×1024 base WebP, so it is reused as-is.
 *
 * No upscale is applied. The final `sizes` values are reconciled with browser
 * measurements before acceptance.
 *
 * Pure module: no imports, no side effects.
 */

export const MERCADOS_PAIR_PHOTO_SIZES =
  "(min-width: 1024px) 360px, (min-width: 768px) min(360px, calc((100vw - 120px) * 0.428571)), min(420px, calc(100vw - 48px))";

export const MERCADOS_PAIR_CAMPAIGN_SIZES =
  "(min-width: 1024px) 480px, (min-width: 768px) min(480px, calc((100vw - 120px) * 0.571429)), min(420px, calc(100vw - 48px))";

export const MERCADOS_COFFEE_SIZES =
  "(min-width: 1024px) 468px, (min-width: 768px) calc(50vw - 44px), min(420px, calc(100vw - 48px))";

export interface MercadosImage {
  /** Largest candidate, also the `src` fallback. */
  src: string;
  srcSet: string;
  sizes: string;
  /** Intrinsic aspect-ratio box (largest candidate). */
  width: number;
  height: number;
}

export const BEEF_PHOTO: MercadosImage = {
  src: "/mercados/foto-coxao-mole-acougue-1024w.webp",
  srcSet:
    "/mercados/foto-coxao-mole-acougue-480w.webp 480w, /mercados/foto-coxao-mole-acougue-1024w.webp 1024w",
  sizes: MERCADOS_PAIR_PHOTO_SIZES,
  width: 1024,
  height: 683,
};

export const BEEF_CAMPAIGN: MercadosImage = {
  src: "/mercados/campanha-coxao-mole-tio-joao-1024w.webp",
  srcSet:
    "/mercados/campanha-coxao-mole-tio-joao-480w.webp 480w, /mercados/campanha-coxao-mole-tio-joao-1024w.webp 1024w",
  sizes: MERCADOS_PAIR_CAMPAIGN_SIZES,
  width: 1024,
  height: 1024,
};

/**
 * Approved coffee campaign already delivered by the landing. The 480w variant
 * and the 1024×1024 base WebP are reused; no redundant derivative is created.
 */
export const COFFEE_CAMPAIGN: MercadosImage = {
  src: "/landing/hero-oferta-cafe.webp",
  srcSet:
    "/landing/variants/hero-oferta-cafe-480w.webp 480w, /landing/hero-oferta-cafe.webp 1024w",
  sizes: MERCADOS_COFFEE_SIZES,
  width: 1024,
  height: 1024,
};
