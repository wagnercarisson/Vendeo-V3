/**
 * Responsive delivery contract for the `/campanhas-para-sua-loja` images.
 *
 * Two WebP candidates per image (480w and 1024w), preserving the intrinsic
 * aspect ratio of each asset. The widths derive from the layout:
 *
 * - Case 1 (1:1 pair): each column measures ~452px CSS at 1440 (max-w-5xl),
 *   ~357px at 834 and up to 342px on a 390px viewport. 480w covers 1x; 1024w
 *   covers 2x. The ration photo is 1310×1201, so 1024w is capped at 1024×939.
 * - Case 2 (vertical pair): the grid tracks size to the photo (300px) and the
 *   9:16 campaign (270px) from 640px up; on mobile both use the 342px content
 *   width and the case stacks.
 *
 * No upscale is applied. The 9:16 campaign is never forced through the square
 * pipeline: it keeps 480×853 and 1024×1820.
 *
 * Pure module: no imports, no side effects.
 */

export const CAMPANHAS_PAIR_SIZES =
  "(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(342px, calc(100vw - 48px))";

export const CAMPANHAS_VERTICAL_PHOTO_SIZES =
  "(min-width: 640px) 300px, min(342px, calc(100vw - 48px))";

export const CAMPANHAS_VERTICAL_CAMPAIGN_SIZES =
  "(min-width: 640px) 270px, min(342px, calc(100vw - 48px))";

export interface DemonstrationImage {
  /** Largest candidate, also the `src` fallback. */
  src: string;
  srcSet: string;
  sizes: string;
  /** Intrinsic dimensions of the largest candidate. */
  width: number;
  height: number;
}

export const RATION_PHOTO: DemonstrationImage = {
  src: "/demonstracao/foto-racao-confiance-1024w.webp",
  srcSet:
    "/demonstracao/foto-racao-confiance-480w.webp 480w, /demonstracao/foto-racao-confiance-1024w.webp 1024w",
  sizes: CAMPANHAS_PAIR_SIZES,
  width: 1024,
  height: 939,
};

export const RATION_CAMPAIGN: DemonstrationImage = {
  src: "/demonstracao/campanha-racao-confiance-bicho-fofo-1024w.webp",
  srcSet:
    "/demonstracao/campanha-racao-confiance-bicho-fofo-480w.webp 480w, /demonstracao/campanha-racao-confiance-bicho-fofo-1024w.webp 1024w",
  sizes: CAMPANHAS_PAIR_SIZES,
  width: 1024,
  height: 1024,
};

export const BED_PHOTO: DemonstrationImage = {
  src: "/demonstracao/foto-cama-pet-comfort-1024w.webp",
  srcSet:
    "/demonstracao/foto-cama-pet-comfort-480w.webp 480w, /demonstracao/foto-cama-pet-comfort-1024w.webp 1024w",
  sizes: CAMPANHAS_VERTICAL_PHOTO_SIZES,
  width: 1024,
  height: 1536,
};

export const BED_CAMPAIGN: DemonstrationImage = {
  src: "/demonstracao/campanha-cama-pet-comfort-bicho-fofo-1024w.webp",
  srcSet:
    "/demonstracao/campanha-cama-pet-comfort-bicho-fofo-480w.webp 480w, /demonstracao/campanha-cama-pet-comfort-bicho-fofo-1024w.webp 1024w",
  sizes: CAMPANHAS_VERTICAL_CAMPAIGN_SIZES,
  width: 1024,
  height: 1820,
};
