// @vitest-environment node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  BEEF_CAMPAIGN,
  BEEF_PHOTO,
  COFFEE_CAMPAIGN,
  MERCADOS_COFFEE_SIZES,
  MERCADOS_PAIR_CAMPAIGN_SIZES,
  MERCADOS_PAIR_PHOTO_SIZES,
} from "../image-sources";

/**
 * Contrato offline das variantes WebP de `/ofertas-para-mercados`.
 *
 * Roda no ambiente node, sem rede, e usa o `sharp` já instalado para provar que
 * cada arquivo existe, é WebP, tem a dimensão contratada e pesa menos que o
 * original correspondente. Nenhum framework de imagem novo é introduzido.
 */

const PUBLIC_DIR = path.resolve("public");

/**
 * Pesos dos arquivos-fonte aprovados, registrados na implementação
 * (2026-11-09):
 * - foto do açougue: 1536×1024 PNG, 3.048.371 B
 * - campanha da carne: 1024×1024 JPEG, 289.145 B
 * - café: 1024×1024 PNG, 1.570.960 B (reutilizado a partir do WebP existente)
 */
const ORIGINAL_BYTES = {
  photo: 3048371,
  campaign: 289145,
  coffee: 1570960,
} as const;

const CASES = [
  {
    label: "foto do açougue",
    sizes: [
      {
        file: "/mercados/foto-coxao-mole-acougue-480w.webp",
        width: 480,
        height: 320,
      },
      {
        file: "/mercados/foto-coxao-mole-acougue-1024w.webp",
        width: 1024,
        height: 683,
      },
    ],
    originalBytes: ORIGINAL_BYTES.photo,
  },
  {
    label: "campanha da carne",
    sizes: [
      {
        file: "/mercados/campanha-coxao-mole-tio-joao-480w.webp",
        width: 480,
        height: 480,
      },
      {
        file: "/mercados/campanha-coxao-mole-tio-joao-1024w.webp",
        width: 1024,
        height: 1024,
      },
    ],
    originalBytes: ORIGINAL_BYTES.campaign,
  },
] as const;

function resolvePublic(url: string): string {
  return path.join(PUBLIC_DIR, url.replace(/^\//, ""));
}

describe("variantes WebP de /ofertas-para-mercados", () => {
  it("expõe duas variantes por imagem com srcset de dois candidatos", () => {
    expect(BEEF_PHOTO.srcSet.split(", ")).toHaveLength(2);
    expect(BEEF_CAMPAIGN.srcSet.split(", ")).toHaveLength(2);
    expect(COFFEE_CAMPAIGN.srcSet.split(", ")).toHaveLength(2);
    expect(BEEF_PHOTO.sizes).toBe(MERCADOS_PAIR_PHOTO_SIZES);
    expect(BEEF_CAMPAIGN.sizes).toBe(MERCADOS_PAIR_CAMPAIGN_SIZES);
    expect(COFFEE_CAMPAIGN.sizes).toBe(MERCADOS_COFFEE_SIZES);
  });

  it.each(CASES)(
    "gera as duas variantes de $label com dimensão e proporção contratadas",
    async ({ sizes, originalBytes }) => {
      for (const entry of sizes) {
        const file = resolvePublic(entry.file);
        expect(existsSync(file), `faltando ${entry.file}`).toBe(true);

        const size = statSync(file).size;
        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThanOrEqual(originalBytes);

        const meta = await sharp(file).metadata();
        expect(meta.format).toBe("webp");
        expect(meta.width).toBe(entry.width);
        expect(meta.height).toBe(entry.height);
      }
    },
  );

  it("o candidato maior é o src e o menor aparece primeiro no srcset", () => {
    expect(BEEF_PHOTO.src).toBe(
      "/mercados/foto-coxao-mole-acougue-1024w.webp",
    );
    expect(BEEF_CAMPAIGN.src).toBe(
      "/mercados/campanha-coxao-mole-tio-joao-1024w.webp",
    );
    expect(COFFEE_CAMPAIGN.src).toBe("/landing/hero-oferta-cafe.webp");
    expect(
      BEEF_PHOTO.srcSet.startsWith(
        "/mercados/foto-coxao-mole-acougue-480w.webp 480w",
      ),
    ).toBe(true);
    expect(
      BEEF_CAMPAIGN.srcSet.startsWith(
        "/mercados/campanha-coxao-mole-tio-joao-480w.webp 480w",
      ),
    ).toBe(true);
    expect(
      COFFEE_CAMPAIGN.srcSet.startsWith(
        "/landing/variants/hero-oferta-cafe-480w.webp 480w",
      ),
    ).toBe(true);
  });

  it("preserva a proporção 3:2 da foto e 1:1 da campanha e do café", () => {
    expect(BEEF_PHOTO.width / BEEF_PHOTO.height).toBeCloseTo(3 / 2, 2);
    expect(BEEF_CAMPAIGN.width).toBe(BEEF_CAMPAIGN.height);
    expect(COFFEE_CAMPAIGN.width).toBe(COFFEE_CAMPAIGN.height);
  });

  it("reutiliza o WebP de 1024 e a variante de 480 do café aprovado", async () => {
    const coffeeBase = resolvePublic(COFFEE_CAMPAIGN.src);
    const coffeeSmall = resolvePublic(
      "/landing/variants/hero-oferta-cafe-480w.webp",
    );

    expect(existsSync(coffeeBase)).toBe(true);
    expect(existsSync(coffeeSmall)).toBe(true);

    const baseMeta = await sharp(coffeeBase).metadata();
    const smallMeta = await sharp(coffeeSmall).metadata();
    expect(baseMeta.format).toBe("webp");
    expect(smallMeta.format).toBe("webp");
    expect(baseMeta.width).toBe(1024);
    expect(baseMeta.height).toBe(1024);
    expect(smallMeta.width).toBe(480);
    expect(smallMeta.height).toBe(480);
    expect(statSync(coffeeBase).size).toBeLessThanOrEqual(ORIGINAL_BYTES.coffee);
    expect(statSync(coffeeSmall).size).toBeLessThanOrEqual(ORIGINAL_BYTES.coffee);
  });
});
