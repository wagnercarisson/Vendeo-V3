/**
 * Responsive delivery contract for the `/floriculturas` demonstration pair.
 *
 * Two WebP candidates per image (small and large) — the page intentionally does
 * NOT reuse `buildLandingSrcSet`, which requires the landing's closed five-variant
 * contract. Widths derive from the layout: each column measures ~452px CSS on
 * desktop, and at DPR 2 the largest useful candidate is ~904px, so 1024 covers it
 * with headroom and 480 covers 1x and smaller viewports. No upscale is applied.
 *
 * Pure module: no imports, no side effects.
 */

export const FLORICULTURAS_IMAGE_SIZES =
  "(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(342px, calc(100vw - 48px))";

export interface FloriculturasImage {
  /** Largest candidate, also the `src` fallback. */
  src: string;
  srcSet: string;
  sizes: string;
  /** Intrinsic aspect-ratio box (largest candidate). */
  width: number;
  height: number;
}

export const SUBMITTED_PHOTO_IMAGE: FloriculturasImage = {
  src: "/floriculturas/foto-orquidea-balcao-1024w.webp",
  srcSet:
    "/floriculturas/foto-orquidea-balcao-480w.webp 480w, /floriculturas/foto-orquidea-balcao-1024w.webp 1024w",
  sizes: FLORICULTURAS_IMAGE_SIZES,
  width: 1024,
  height: 936,
};

export const CAMPAIGN_IMAGE: FloriculturasImage = {
  src: "/floriculturas/campanha-donna-flor-1024w.webp",
  srcSet:
    "/floriculturas/campanha-donna-flor-480w.webp 480w, /floriculturas/campanha-donna-flor-1024w.webp 1024w",
  sizes: FLORICULTURAS_IMAGE_SIZES,
  width: 1024,
  height: 1024,
};
