/**
 * Responsive delivery contract for the landing campaign images.
 *
 * The 1024px candidate is the existing original asset; the smaller candidates
 * (320/480/640/768) are deterministic Sharp variants generated into
 * `public/landing/variants/` by `scripts/generate-landing-image-variants.mjs`.
 * Google-invalid, network-free module: no side effects.
 */

export const LANDING_IMAGE_WIDTHS = [320, 480, 640, 768, 1024] as const;

const LANDING_SRC_PATTERN = /^\/landing\/([a-z0-9-]+)\.webp$/;
const VARIANT_WIDTHS: readonly number[] = LANDING_IMAGE_WIDTHS.filter(
  (width) => width !== 1024,
);

/**
 * Build the `srcset` for a landing-owned webp asset.
 *
 * Input must be exactly `/landing/<name>.webp`; anything else returns an empty
 * string so we never emit phantom variant URLs.
 */
export function buildLandingSrcSet(src: string): string {
  const match = LANDING_SRC_PATTERN.exec(src);
  if (!match) return "";

  const basename = match[1];
  const candidates = VARIANT_WIDTHS.map(
    (width) => `/landing/variants/${basename}-${width}w.webp ${width}w`,
  );
  candidates.push(`${src} 1024w`);

  return candidates.join(", ");
}
