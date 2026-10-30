/**
 * Responsive delivery contract for the landing campaign images.
 *
 * The 1024px candidate is the existing original asset; the smaller candidates
 * (320/480/640/768) are deterministic Sharp variants generated into
 * `public/landing/variants/` by `scripts/generate-landing-image-variants.mjs`.
 * Google-invalid, network-free module: no side effects.
 */

export const LANDING_IMAGE_WIDTHS = [320, 480, 640, 768, 1024] as const;

/**
 * The only landing assets that received generated variants. Keep this list in
 * sync with the generator allowlist; any other `/landing/*.webp` file (logo,
 * ration thumbnail, future assets) has no variants and must not receive a
 * `srcset` pointing at files that do not exist.
 */
export const LANDING_CAMPAIGN_BASENAMES = [
  "hero-oferta-cafe",
  "transformacao-petshop",
  "identidade-floricultura",
  "apresentacao-estudio",
  "apresentacao-ambientado",
  "apresentacao-fundo-original",
  "abordagens-oferta",
  "abordagens-destaque",
  "abordagens-exclusivo",
] as const;

const ALLOWED_BASENAMES = new Set<string>(LANDING_CAMPAIGN_BASENAMES);
const LANDING_SRC_PATTERN = /^\/landing\/([a-z0-9-]+)\.webp$/;
const VARIANT_WIDTHS: readonly number[] = LANDING_IMAGE_WIDTHS.filter(
  (width) => width !== 1024,
);

/**
 * Build the `srcset` for an authorized landing campaign asset.
 *
 * Input must be exactly `/landing/<campaign>.webp` with `<campaign>` in
 * `LANDING_CAMPAIGN_BASENAMES`; anything else returns an empty string so we
 * never emit phantom variant URLs.
 */
export function buildLandingSrcSet(src: string): string {
  const match = LANDING_SRC_PATTERN.exec(src);
  if (!match || !ALLOWED_BASENAMES.has(match[1])) return "";

  const basename = match[1];
  const candidates = VARIANT_WIDTHS.map(
    (width) => `/landing/variants/${basename}-${width}w.webp ${width}w`,
  );
  candidates.push(`${src} 1024w`);

  return candidates.join(", ");
}
