// @vitest-environment node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  BED_CAMPAIGN,
  BED_PHOTO,
  CAMPANHAS_PAIR_SIZES,
  CAMPANHAS_VERTICAL_CAMPAIGN_SIZES,
  CAMPANHAS_VERTICAL_PHOTO_SIZES,
  RATION_CAMPAIGN,
  RATION_PHOTO,
} from "../image-sources";

/**
 * Contrato offline das duas variantes WebP por imagem de
 * `/campanhas-para-sua-loja`.
 *
 * Roda no ambiente node, sem rede, e usa o `sharp` já instalado para provar que
 * cada arquivo existe, é WebP, tem a dimensão contratada e pesa menos que o
 * original correspondente. Nenhum framework de imagem novo é introduzido.
 */

const PUBLIC_DIR = path.resolve("public");

/**
 * Pesos dos arquivos-fonte aprovados, registrados na implementação
 * (2026-11-07) para que o teste seja reproduzível sem depender de caminhos em
 * `Downloads`:
 * - foto da ração: 1310×1201 PNG, 1.899.777 B
 * - campanha 1:1: 1024×1024 PNG, 1.396.972 B
 * - foto da cama: 1024×1536 PNG, 2.722.361 B
 * - campanha 9:16: 1080×1920 JPEG, 660.163 B
 */
const ORIGINAL_BYTES = {
  rationPhoto: 1899777,
  rationCampaign: 1396972,
  bedPhoto: 2722361,
  bedCampaign: 660163,
} as const;

const CASES = [
  {
    label: "foto da ração",
    sizes: [
      {
        file: "/demonstracao/foto-racao-confiance-480w.webp",
        width: 480,
        height: 440,
      },
      {
        file: "/demonstracao/foto-racao-confiance-1024w.webp",
        width: 1024,
        height: 939,
      },
    ],
    originalBytes: ORIGINAL_BYTES.rationPhoto,
  },
  {
    label: "campanha 1:1 da ração",
    sizes: [
      {
        file: "/demonstracao/campanha-racao-confiance-bicho-fofo-480w.webp",
        width: 480,
        height: 480,
      },
      {
        file: "/demonstracao/campanha-racao-confiance-bicho-fofo-1024w.webp",
        width: 1024,
        height: 1024,
      },
    ],
    originalBytes: ORIGINAL_BYTES.rationCampaign,
  },
  {
    label: "foto da cama",
    sizes: [
      {
        file: "/demonstracao/foto-cama-pet-comfort-480w.webp",
        width: 480,
        height: 720,
      },
      {
        file: "/demonstracao/foto-cama-pet-comfort-1024w.webp",
        width: 1024,
        height: 1536,
      },
    ],
    originalBytes: ORIGINAL_BYTES.bedPhoto,
  },
  {
    label: "campanha 9:16 da cama",
    sizes: [
      {
        file: "/demonstracao/campanha-cama-pet-comfort-bicho-fofo-480w.webp",
        width: 480,
        height: 853,
      },
      {
        file: "/demonstracao/campanha-cama-pet-comfort-bicho-fofo-1024w.webp",
        width: 1024,
        height: 1820,
      },
    ],
    originalBytes: ORIGINAL_BYTES.bedCampaign,
  },
] as const;

function resolvePublic(url: string): string {
  return path.join(PUBLIC_DIR, url.replace(/^\//, ""));
}

describe("variantes WebP de /campanhas-para-sua-loja", () => {
  it("expõe duas variantes por imagem com srcset de dois candidatos", () => {
    for (const image of [
      RATION_PHOTO,
      RATION_CAMPAIGN,
      BED_PHOTO,
      BED_CAMPAIGN,
    ]) {
      expect(image.srcSet.split(", ")).toHaveLength(2);
    }
    expect(RATION_PHOTO.sizes).toBe(CAMPANHAS_PAIR_SIZES);
    expect(RATION_CAMPAIGN.sizes).toBe(CAMPANHAS_PAIR_SIZES);
    expect(BED_PHOTO.sizes).toBe(CAMPANHAS_VERTICAL_PHOTO_SIZES);
    expect(BED_CAMPAIGN.sizes).toBe(CAMPANHAS_VERTICAL_CAMPAIGN_SIZES);
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
    expect(RATION_PHOTO.src).toBe(
      "/demonstracao/foto-racao-confiance-1024w.webp",
    );
    expect(RATION_CAMPAIGN.src).toBe(
      "/demonstracao/campanha-racao-confiance-bicho-fofo-1024w.webp",
    );
    expect(BED_PHOTO.src).toBe(
      "/demonstracao/foto-cama-pet-comfort-1024w.webp",
    );
    expect(BED_CAMPAIGN.src).toBe(
      "/demonstracao/campanha-cama-pet-comfort-bicho-fofo-1024w.webp",
    );

    expect(
      RATION_PHOTO.srcSet.startsWith(
        "/demonstracao/foto-racao-confiance-480w.webp 480w",
      ),
    ).toBe(true);
    expect(
      RATION_CAMPAIGN.srcSet.startsWith(
        "/demonstracao/campanha-racao-confiance-bicho-fofo-480w.webp 480w",
      ),
    ).toBe(true);
    expect(
      BED_PHOTO.srcSet.startsWith(
        "/demonstracao/foto-cama-pet-comfort-480w.webp 480w",
      ),
    ).toBe(true);
    expect(
      BED_CAMPAIGN.srcSet.startsWith(
        "/demonstracao/campanha-cama-pet-comfort-bicho-fofo-480w.webp 480w",
      ),
    ).toBe(true);
  });

  it("preserva as proporções dos originais, sem o pipeline quadrado no 9:16", () => {
    expect(RATION_PHOTO.width / RATION_PHOTO.height).toBeCloseTo(
      1310 / 1201,
      3,
    );
    expect(RATION_CAMPAIGN.width / RATION_CAMPAIGN.height).toBeCloseTo(1, 5);
    expect(BED_PHOTO.width / BED_PHOTO.height).toBeCloseTo(2 / 3, 5);
    expect(BED_CAMPAIGN.width / BED_CAMPAIGN.height).toBeCloseTo(9 / 16, 3);
  });
});
