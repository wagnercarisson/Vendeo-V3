// @vitest-environment node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  LANDING_IMAGE_WIDTHS,
  buildLandingSrcSet,
} from "../landing-image-srcset";

/**
 * Offline asset contract for the responsive landing delivery.
 *
 * Runs in the node environment, never touches the network, and uses the
 * already-installed `sharp` to prove each generated variant exists with the
 * exact expected square dimensions. The two non-campaign assets (ration
 * thumbnail and logo) must never gain variants.
 */

const LANDING_DIR = path.resolve("public/landing");
const VARIANTS_DIR = path.join(LANDING_DIR, "variants");

const CAMPAIGN_BASENAMES = [
  "hero-oferta-cafe",
  "transformacao-petshop",
  "identidade-floricultura",
  "apresentacao-estudio",
  "apresentacao-ambientado",
  "apresentacao-fundo-original",
  "abordagens-oferta",
  "abordagens-destaque",
  "abordagens-exclusivo",
];

const VARIANT_WIDTHS = LANDING_IMAGE_WIDTHS.filter((width) => width !== 1024);

const NON_CAMPAIGN_BASENAMES = [
  "transformacao-produto-racao",
  "vendeo-logo-dark",
];

function variantPath(basename: string, width: number): string {
  return path.join(VARIANTS_DIR, `${basename}-${width}w.webp`);
}

describe("variantes responsivas da landing", () => {
  it("expõe exatamente as larguras contratadas e a original de 1024", () => {
    expect([...LANDING_IMAGE_WIDTHS]).toEqual([320, 480, 640, 768, 1024]);
  });

  it.each(CAMPAIGN_BASENAMES)(
    "gera as variantes quadradas de %s",
    async (basename) => {
      const originalPath = path.join(LANDING_DIR, `${basename}.webp`);
      const originalSize = statSync(originalPath).size;

      for (const width of VARIANT_WIDTHS) {
        const file = variantPath(basename, width);
        expect(existsSync(file), `faltando ${path.basename(file)}`).toBe(true);

        const size = statSync(file).size;
        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThanOrEqual(originalSize);

        const meta = await sharp(file).metadata();
        expect(meta.width).toBe(width);
        expect(meta.height).toBe(width);
      }
    },
  );

  it.each(NON_CAMPAIGN_BASENAMES)(
    "não cria variantes para o asset não-campanha %s",
    (basename) => {
      for (const width of VARIANT_WIDTHS) {
        expect(existsSync(variantPath(basename, width))).toBe(false);
      }
    },
  );
});

describe("buildLandingSrcSet", () => {
  it("monta a string exata com cinco candidatos em ordem crescente", () => {
    expect(buildLandingSrcSet("/landing/hero-oferta-cafe.webp")).toBe(
      [
        "/landing/variants/hero-oferta-cafe-320w.webp 320w",
        "/landing/variants/hero-oferta-cafe-480w.webp 480w",
        "/landing/variants/hero-oferta-cafe-640w.webp 640w",
        "/landing/variants/hero-oferta-cafe-768w.webp 768w",
        "/landing/hero-oferta-cafe.webp 1024w",
      ].join(", "),
    );
  });

  it("retorna string vazia para caminhos fora do padrão /landing/*.webp", () => {
    expect(buildLandingSrcSet("/landing/variants/hero-oferta-cafe-320w.webp")).toBe(
      "",
    );
    expect(buildLandingSrcSet("/images/hero.webp")).toBe("");
    expect(buildLandingSrcSet("https://example.com/landing/hero.webp")).toBe("");
    expect(buildLandingSrcSet("")).toBe("");
  });
});
