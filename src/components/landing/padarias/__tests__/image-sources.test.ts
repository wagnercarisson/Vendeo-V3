// @vitest-environment node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  BREAD_CAMPAIGN_IMAGE,
  CAKE_CAMPAIGN_IMAGE,
  PADARIAS_BREAD_SIZES,
  PADARIAS_PAIR_SIZES,
  SUBMITTED_CAKE_PHOTO,
} from "../image-sources";

/**
 * Contrato offline das duas variantes WebP por imagem de `/padarias`.
 *
 * Roda no ambiente node, sem rede, e usa o `sharp` já instalado para provar que
 * cada arquivo existe, é WebP, tem a dimensão contratada e pesa menos que o
 * original correspondente. Nenhum framework de imagem novo é introduzido.
 */

const PUBLIC_DIR = path.resolve("public");

/**
 * Pesos dos arquivos-fonte aprovados, registrados na implementação
 * (2026-11-04) para que o teste seja reproduzível sem depender de caminhos em
 * `Downloads`:
 * - foto: 1024×1024 PNG, 1.877.770 B
 * - campanha do bolo: 1024×1024 JPEG, 291.804 B
 * - campanha do pão: 1024×1024 JPEG, 266.104 B
 */
const ORIGINAL_BYTES = {
  photo: 1877770,
  cake: 291804,
  bread: 266104,
} as const;

const CASES = [
  {
    label: "foto do bolo",
    sizes: [
      { file: "/padarias/foto-bolo-naked-fruit-480w.webp", width: 480 },
      { file: "/padarias/foto-bolo-naked-fruit-1024w.webp", width: 1024 },
    ],
    originalBytes: ORIGINAL_BYTES.photo,
  },
  {
    label: "campanha do bolo",
    sizes: [
      {
        file: "/padarias/campanha-bolo-naked-fruit-dona-maria-480w.webp",
        width: 480,
      },
      {
        file: "/padarias/campanha-bolo-naked-fruit-dona-maria-1024w.webp",
        width: 1024,
      },
    ],
    originalBytes: ORIGINAL_BYTES.cake,
  },
  {
    label: "campanha do pão",
    sizes: [
      {
        file: "/padarias/campanha-pao-frances-fresquinho-dona-maria-480w.webp",
        width: 480,
      },
      {
        file: "/padarias/campanha-pao-frances-fresquinho-dona-maria-1024w.webp",
        width: 1024,
      },
    ],
    originalBytes: ORIGINAL_BYTES.bread,
  },
] as const;

function resolvePublic(url: string): string {
  return path.join(PUBLIC_DIR, url.replace(/^\//, ""));
}

describe("variantes WebP de /padarias", () => {
  it("expõe duas variantes por imagem com srcset de dois candidatos", () => {
    expect(SUBMITTED_CAKE_PHOTO.srcSet.split(", ")).toHaveLength(2);
    expect(CAKE_CAMPAIGN_IMAGE.srcSet.split(", ")).toHaveLength(2);
    expect(BREAD_CAMPAIGN_IMAGE.srcSet.split(", ")).toHaveLength(2);
    expect(SUBMITTED_CAKE_PHOTO.sizes).toBe(PADARIAS_PAIR_SIZES);
    expect(CAKE_CAMPAIGN_IMAGE.sizes).toBe(PADARIAS_PAIR_SIZES);
    expect(BREAD_CAMPAIGN_IMAGE.sizes).toBe(PADARIAS_BREAD_SIZES);
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
        expect(meta.height).toBe(entry.width);
        expect(meta.width! / meta.height!).toBeCloseTo(1, 5);
      }
    },
  );

  it("o candidato maior é o src e o menor aparece primeiro no srcset", () => {
    expect(SUBMITTED_CAKE_PHOTO.src).toBe(
      "/padarias/foto-bolo-naked-fruit-1024w.webp",
    );
    expect(CAKE_CAMPAIGN_IMAGE.src).toBe(
      "/padarias/campanha-bolo-naked-fruit-dona-maria-1024w.webp",
    );
    expect(BREAD_CAMPAIGN_IMAGE.src).toBe(
      "/padarias/campanha-pao-frances-fresquinho-dona-maria-1024w.webp",
    );
    expect(
      SUBMITTED_CAKE_PHOTO.srcSet.startsWith(
        "/padarias/foto-bolo-naked-fruit-480w.webp 480w",
      ),
    ).toBe(true);
    expect(
      CAKE_CAMPAIGN_IMAGE.srcSet.startsWith(
        "/padarias/campanha-bolo-naked-fruit-dona-maria-480w.webp 480w",
      ),
    ).toBe(true);
    expect(
      BREAD_CAMPAIGN_IMAGE.srcSet.startsWith(
        "/padarias/campanha-pao-frances-fresquinho-dona-maria-480w.webp 480w",
      ),
    ).toBe(true);
  });

  it("as três imagens permanecem quadradas (1:1)", () => {
    expect(SUBMITTED_CAKE_PHOTO.width).toBe(SUBMITTED_CAKE_PHOTO.height);
    expect(CAKE_CAMPAIGN_IMAGE.width).toBe(CAKE_CAMPAIGN_IMAGE.height);
    expect(BREAD_CAMPAIGN_IMAGE.width).toBe(BREAD_CAMPAIGN_IMAGE.height);
  });
});
