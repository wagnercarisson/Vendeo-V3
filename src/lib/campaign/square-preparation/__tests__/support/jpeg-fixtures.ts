import sharp from "sharp";

/**
 * F60.2 (quick 261111-idz) — Fixtures determinísticas geradas a partir de
 * buffers de pixel crus (sem fonte externa, texto, rede ou IA).
 *
 * O quadrado 1024×1024 tem metade esquerda vermelha, metade direita azul e dois
 * marcadores 64×64 (preto à esquerda, branco à direita), o que permite provar
 * escala uniforme e ausência de crop/pad após o fator único 9/8.
 */

export const FIXTURE_WIDTH = 1024;
export const FIXTURE_HEIGHT = 1024;

export const RED: RGB = { r: 200, g: 30, b: 30 };
export const BLUE: RGB = { r: 30, g: 30, b: 200 };
export const BLACK: RGB = { r: 0, g: 0, b: 0 };
export const WHITE: RGB = { r: 255, g: 255, b: 255 };

/** Lado do marcador na fonte 1024×1024. */
export const SOURCE_MARKER_SIDE = 64;
/** Centro do marcador preto na fonte. */
export const SOURCE_BLACK_CENTER = { x: 256, y: 256 } as const;
/** Centro do marcador branco na fonte. */
export const SOURCE_WHITE_CENTER = { x: 768, y: 768 } as const;
/** Coluna de transição vermelho→azul na fonte. */
export const SOURCE_TRANSITION_COLUMN = 512;

/** 1024 × 9/8 = 1152 — fator único de escala. */
export const SCALE = 1.125;

/** Centro esperado do marcador preto após a escala (256 × 1,125). */
export const SCALED_BLACK_CENTROID = { x: 288, y: 288 } as const;
/** Centro esperado do marcador branco após a escala (768 × 1,125). */
export const SCALED_WHITE_CENTROID = { x: 864, y: 864 } as const;
/** Lado esperado de cada marcador após a escala (64 × 1,125). */
export const SCALED_MARKER_SIDE = 72;
/** Coluna de transição esperada na saída 1152 (512 × 1,125). */
export const SCALED_TRANSITION_COLUMN = 576;

export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

function fillRaw(
  width: number,
  height: number,
  background: RGB,
): Buffer {
  const data = Buffer.alloc(width * height * 3);
  for (let offset = 0; offset < data.length; offset += 3) {
    data[offset] = background.r;
    data[offset + 1] = background.g;
    data[offset + 2] = background.b;
  }
  return data;
}

function paintMarker(
  data: Buffer,
  width: number,
  center: { readonly x: number; readonly y: number },
  side: number,
  color: RGB,
): void {
  const half = Math.floor(side / 2);
  for (
    let y = center.y - half;
    y < center.y - half + side;
    y += 1
  ) {
    for (
      let x = center.x - half;
      x < center.x - half + side;
      x += 1
    ) {
      const offset = (y * width + x) * 3;
      data[offset] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
    }
  }
}

function squareFixturePixels(): Buffer {
  const data = fillRaw(FIXTURE_WIDTH, FIXTURE_HEIGHT, RED);

  // Metade direita azul.
  for (let y = 0; y < FIXTURE_HEIGHT; y += 1) {
    for (let x = SOURCE_TRANSITION_COLUMN; x < FIXTURE_WIDTH; x += 1) {
      const offset = (y * FIXTURE_WIDTH + x) * 3;
      data[offset] = BLUE.r;
      data[offset + 1] = BLUE.g;
      data[offset + 2] = BLUE.b;
    }
  }

  paintMarker(data, FIXTURE_WIDTH, SOURCE_BLACK_CENTER, SOURCE_MARKER_SIDE, BLACK);
  paintMarker(data, FIXTURE_WIDTH, SOURCE_WHITE_CENTER, SOURCE_MARKER_SIDE, WHITE);

  return data;
}

/** Quadrado 1024×1024 JPEG q95 4:4:4 (fixture canônica da fonte). */
export async function buildSquare1024Fixture(): Promise<Buffer> {
  return sharp(squareFixturePixels(), {
    raw: { width: FIXTURE_WIDTH, height: FIXTURE_HEIGHT, channels: 3 },
  })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();
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

/** PNG de dimensão arbitrária (entrada não-JPEG). */
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
