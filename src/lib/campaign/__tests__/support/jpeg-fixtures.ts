import sharp from "sharp";

/**
 * F60.2/F60.3 — Helpers e fixtures JPEG/PNG determinísticas compartilhadas.
 *
 * Extraído de `square-preparation/__tests__/support/jpeg-fixtures.ts` (F60.3,
 * extração com re-export). Nenhuma fonte externa, texto, rede ou IA: os bytes
 * saem de buffers de pixel crus.
 *
 * Além dos helpers do quadrado, este módulo fornece as fixtures do vertical:
 * - `buildVertical1152x2048Fixture()` — retorno plausível do provider para a
 *   expansão (marcador central distinguível das bordas);
 * - `buildVertical1080x1920Fixture()` — vertical ENTREGUE válido, gerado por
 *   Sharp, **sem metadata de evidência** (semente de objeto órfão).
 */

export const RED: RGB = { r: 200, g: 30, b: 30 };
export const BLUE: RGB = { r: 30, g: 30, b: 200 };
export const BLACK: RGB = { r: 0, g: 0, b: 0 };
export const WHITE: RGB = { r: 255, g: 255, b: 255 };

/** Largura da fixture de retorno do provider (9:16). */
export const VERTICAL_PROVIDER_WIDTH = 1152;
/** Altura da fixture de retorno do provider (9:16). */
export const VERTICAL_PROVIDER_HEIGHT = 2048;
/** Largura do vertical entregue. */
export const VERTICAL_DELIVERED_WIDTH = 1080;
/** Altura do vertical entregue. */
export const VERTICAL_DELIVERED_HEIGHT = 1920;

/** Fundo da fixture vertical do provider. */
export const VERTICAL_BACKGROUND: RGB = { r: 214, g: 208, b: 198 };
/** Marcador central da fixture vertical do provider. */
export const VERTICAL_MARKER: RGB = { r: 12, g: 12, b: 16 };
/** Lado do marcador central. */
export const VERTICAL_MARKER_SIDE = 128;

export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function fillRaw(width: number, height: number, background: RGB): Buffer {
  const data = Buffer.alloc(width * height * 3);
  for (let offset = 0; offset < data.length; offset += 3) {
    data[offset] = background.r;
    data[offset + 1] = background.g;
    data[offset + 2] = background.b;
  }
  return data;
}

export function paintMarker(
  data: Buffer,
  width: number,
  center: { readonly x: number; readonly y: number },
  side: number,
  color: RGB,
): void {
  const half = Math.floor(side / 2);
  for (let y = center.y - half; y < center.y - half + side; y += 1) {
    for (let x = center.x - half; x < center.x - half + side; x += 1) {
      const offset = (y * width + x) * 3;
      data[offset] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
    }
  }
}

/** JPEG sólido de dimensão arbitrária (ex.: 1080×1080 ou 1152×1152). */
export async function buildJpeg(
  width: number,
  height: number,
  background: RGB = { r: 10, g: 20, b: 30 },
): Promise<Buffer> {
  return sharp(fillRaw(width, height, background), {
    raw: { width, height, channels: 3 },
  })
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/** PNG de dimensão arbitrária (saída real do provider e entrada não-JPEG). */
export async function buildPng(
  width: number,
  height: number,
  background: RGB = { r: 40, g: 80, b: 120 },
): Promise<Buffer> {
  return sharp(fillRaw(width, height, background), {
    raw: { width, height, channels: 3 },
  })
    .png()
    .toBuffer();
}

/** Corta o JPEG pela metade para simular truncamento real. */
export function truncateJpeg(bytes: Buffer): Buffer {
  return bytes.subarray(0, Math.floor(bytes.byteLength / 2));
}

/**
 * Retorno plausível do provider: JPEG 1152×2048 com fundo distinto e marcador
 * central (o pixel central difere das bordas).
 */
export async function buildVertical1152x2048Fixture(): Promise<Buffer> {
  const data = fillRaw(
    VERTICAL_PROVIDER_WIDTH,
    VERTICAL_PROVIDER_HEIGHT,
    VERTICAL_BACKGROUND,
  );
  paintMarker(
    data,
    VERTICAL_PROVIDER_WIDTH,
    {
      x: Math.floor(VERTICAL_PROVIDER_WIDTH / 2),
      y: Math.floor(VERTICAL_PROVIDER_HEIGHT / 2),
    },
    VERTICAL_MARKER_SIDE,
    VERTICAL_MARKER,
  );

  return sharp(data, {
    raw: {
      width: VERTICAL_PROVIDER_WIDTH,
      height: VERTICAL_PROVIDER_HEIGHT,
      channels: 3,
    },
  })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/**
 * Vertical ENTREGUE válido (JPEG 1080×1920) gerado por Sharp e SEM metadata de
 * evidência: usado como semente de objeto órfão (o probe deve classificá-lo como
 * `object_unverified`, nunca como objeto inválido).
 */
export async function buildVertical1080x1920Fixture(): Promise<Buffer> {
  return sharp(
    fillRaw(VERTICAL_DELIVERED_WIDTH, VERTICAL_DELIVERED_HEIGHT, {
      r: 32,
      g: 48,
      b: 64,
    }),
    {
      raw: {
        width: VERTICAL_DELIVERED_WIDTH,
        height: VERTICAL_DELIVERED_HEIGHT,
        channels: 3,
      },
    },
  )
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/**
 * Vertical ENTREGUE truncado (metade do JPEG): `metadata()` pode reconhecer o
 * header, mas o decode COMPLETO falha. Usado para provar que o gate não aceita
 * objeto ilegível e que a validação de retorno não persiste lixo.
 */
export async function buildTruncatedVerticalFixture(): Promise<Buffer> {
  return truncateJpeg(await buildVertical1080x1920Fixture());
}

/** Bytes que não são imagem: nenhum decoder reconhece este conteúdo. */
export function buildNonImageBuffer(): Buffer {
  return Buffer.from("vendeo-f60.3-not-an-image", "utf8");
}
