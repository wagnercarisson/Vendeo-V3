/**
 * Responsive delivery contract for the `/padarias` demonstration images.
 *
 * Two WebP candidates per image (480w and 1024w). The page intentionally does
 * NOT reuse `buildLandingSrcSet`, which requires the landing's closed five-variant
 * contract. Widths derive from the layout:
 *
 * - Demonstration pair: each column measures ~452px CSS at 1440 (max-w-5xl),
 *   ~357px at 834 and 342px on a 390px viewport. 480w covers 1x; 1024w covers 2x.
 * - Bread example: the image column measures ~468px CSS at 1440, ~373px at 834
 *   and 342px on mobile. 480w covers 1x; 1024w covers 2x.
 *
 * No upscale is applied: the source images are 1024×1024, so DPR 3 is capped at
 * the original width. The final `sizes` values are reconciled with browser
 * measurements before acceptance.
 *
 * Pure module: no imports, no side effects.
 */

export const PADARIAS_PAIR_SIZES =
  "(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(342px, calc(100vw - 48px))";

export const PADARIAS_BREAD_SIZES =
  "(min-width: 1024px) 468px, (min-width: 768px) calc(50vw - 44px), min(448px, calc(100vw - 48px))";

export interface PadariasImage {
  /** Largest candidate, also the `src` fallback. */
  src: string;
  srcSet: string;
  sizes: string;
  /** Intrinsic aspect-ratio box (largest candidate). */
  width: number;
  height: number;
}

export const SUBMITTED_CAKE_PHOTO: PadariasImage = {
  src: "/padarias/foto-bolo-naked-fruit-1024w.webp",
  srcSet:
    "/padarias/foto-bolo-naked-fruit-480w.webp 480w, /padarias/foto-bolo-naked-fruit-1024w.webp 1024w",
  sizes: PADARIAS_PAIR_SIZES,
  width: 1024,
  height: 1024,
};

export const CAKE_CAMPAIGN_IMAGE: PadariasImage = {
  src: "/padarias/campanha-bolo-naked-fruit-dona-maria-1024w.webp",
  srcSet:
    "/padarias/campanha-bolo-naked-fruit-dona-maria-480w.webp 480w, /padarias/campanha-bolo-naked-fruit-dona-maria-1024w.webp 1024w",
  sizes: PADARIAS_PAIR_SIZES,
  width: 1024,
  height: 1024,
};

/**
 * Complementary bread campaign. It sits below the opening, so the page renders
 * it lazily; the intrinsic dimensions keep the 1:1 box stable.
 */
export const BREAD_CAMPAIGN_IMAGE: PadariasImage = {
  src: "/padarias/campanha-pao-frances-fresquinho-dona-maria-1024w.webp",
  srcSet:
    "/padarias/campanha-pao-frances-fresquinho-dona-maria-480w.webp 480w, /padarias/campanha-pao-frances-fresquinho-dona-maria-1024w.webp 1024w",
  sizes: PADARIAS_BREAD_SIZES,
  width: 1024,
  height: 1024,
};
