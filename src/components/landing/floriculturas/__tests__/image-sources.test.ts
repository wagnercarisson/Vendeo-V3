// @vitest-environment node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  CAMPAIGN_IMAGE,
  FLORICULTURAS_IMAGE_SIZES,
  KALANDIVA_IMAGE,
  KALANDIVA_IMAGE_SIZES,
  SUBMITTED_PHOTO_IMAGE,
} from "../image-sources";

/**
 * Contrato offline das duas variantes WebP por imagem de `/floriculturas`.
 *
 * Roda no ambiente node, sem rede, e usa o `sharp` já instalado para provar que
 * cada arquivo existe, é WebP, tem a dimensão contratada e pesa menos que o
 * original correspondente. Nenhum framework de imagem novo é introduzido.
 */

const PUBLIC_DIR = path.resolve("public");
/**
 * Pesos dos arquivos-fonte aprovados, registrados na implementação
 * (2026-11-03) para que o teste seja reproduzível sem depender de caminhos em
 * `Downloads`:
 * - foto: 1312×1199 PNG, 2.266.014 B
 * - campanha: 1024×1024 JPEG, 254.571 B
 * - Kalandiva: 1024×1024 JPEG, 242.089 B
 */
const ORIGINAL_BYTES = {
  photo: 2266014,
  campaign: 254571,
  kalandiva: 242089,
} as const;

const CASES = [
  {
    label: "foto",
    sizes: [
      { file: "/floriculturas/foto-orquidea-balcao-480w.webp", width: 480 },
      { file: "/floriculturas/foto-orquidea-balcao-1024w.webp", width: 1024 },
    ],
    ratio: 1312 / 1199,
    originalBytes: ORIGINAL_BYTES.photo,
  },
  {
    label: "campanha",
    sizes: [
      { file: "/floriculturas/campanha-donna-flor-480w.webp", width: 480 },
      { file: "/floriculturas/campanha-donna-flor-1024w.webp", width: 1024 },
    ],
    ratio: 1,
    originalBytes: ORIGINAL_BYTES.campaign,
  },
  {
    label: "Kalandiva",
    sizes: [
      {
        file: "/floriculturas/campanha-kalandiva-donna-flor-480w.webp",
        width: 480,
      },
      {
        file: "/floriculturas/campanha-kalandiva-donna-flor-1024w.webp",
        width: 1024,
      },
    ],
    ratio: 1,
    originalBytes: ORIGINAL_BYTES.kalandiva,
  },
] as const;

function resolvePublic(url: string): string {
  return path.join(PUBLIC_DIR, url.replace(/^\//, ""));
}

describe("variantes WebP de /floriculturas", () => {
  it("expõe duas variantes por imagem com srcset de dois candidatos", () => {
    expect(SUBMITTED_PHOTO_IMAGE.srcSet.split(", ")).toHaveLength(2);
    expect(CAMPAIGN_IMAGE.srcSet.split(", ")).toHaveLength(2);
    expect(KALANDIVA_IMAGE.srcSet.split(", ")).toHaveLength(2);
    expect(SUBMITTED_PHOTO_IMAGE.sizes).toBe(FLORICULTURAS_IMAGE_SIZES);
    expect(CAMPAIGN_IMAGE.sizes).toBe(FLORICULTURAS_IMAGE_SIZES);
    expect(KALANDIVA_IMAGE.sizes).toBe(KALANDIVA_IMAGE_SIZES);
  });

  it.each(CASES)(
    "gera as duas variantes de $label com dimensão e proporção contratadas",
    async ({ sizes, ratio, originalBytes }) => {
      for (const entry of sizes) {
        const file = resolvePublic(entry.file);
        expect(existsSync(file), `faltando ${entry.file}`).toBe(true);

        const size = statSync(file).size;
        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThanOrEqual(originalBytes);

        const meta = await sharp(file).metadata();
        expect(meta.format).toBe("webp");
        expect(meta.width).toBe(entry.width);
        expect(meta.height).toBeDefined();
        expect(meta.width! / meta.height!).toBeCloseTo(ratio, 2);
      }
    },
  );

  it("o candidato maior é o src e o menor aparece primeiro no srcset", () => {
    expect(SUBMITTED_PHOTO_IMAGE.src).toBe(
      "/floriculturas/foto-orquidea-balcao-1024w.webp",
    );
    expect(CAMPAIGN_IMAGE.src).toBe(
      "/floriculturas/campanha-donna-flor-1024w.webp",
    );
    expect(KALANDIVA_IMAGE.src).toBe(
      "/floriculturas/campanha-kalandiva-donna-flor-1024w.webp",
    );
    expect(SUBMITTED_PHOTO_IMAGE.srcSet.startsWith("/floriculturas/foto-orquidea-balcao-480w.webp 480w")).toBe(true);
    expect(CAMPAIGN_IMAGE.srcSet.startsWith("/floriculturas/campanha-donna-flor-480w.webp 480w")).toBe(true);
    expect(KALANDIVA_IMAGE.srcSet.startsWith("/floriculturas/campanha-kalandiva-donna-flor-480w.webp 480w")).toBe(true);
  });

  it("a campanha permanece quadrada (1:1) e a foto preserva 1312×1199", () => {
    expect(CAMPAIGN_IMAGE.width).toBe(CAMPAIGN_IMAGE.height);
    expect(KALANDIVA_IMAGE.width).toBe(KALANDIVA_IMAGE.height);
    expect(SUBMITTED_PHOTO_IMAGE.width / SUBMITTED_PHOTO_IMAGE.height).toBeCloseTo(
      1312 / 1199,
      2,
    );
  });
});
