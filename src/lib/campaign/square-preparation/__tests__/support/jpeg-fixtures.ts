import sharp from "sharp";

import { BLACK, BLUE, RED, WHITE, fillRaw, paintMarker } from "@/lib/campaign/__tests__/support/jpeg-fixtures";

/**
 * F60.2 (quick 261111-idz) → F60.3 — Fixtures determinísticas do QUADRADO.
 *
 * Os helpers comuns (`RGB`, `RED`, `BLUE`, `BLACK`, `WHITE`, `fillRaw`,
 * `buildJpeg`, `buildPng`, `truncateJpeg`, fixtures verticais) foram extraídos
 * para `src/lib/campaign/__tests__/support/jpeg-fixtures.ts` e são reexportados
 * aqui. Este arquivo mantém as constantes específicas do quadrado 1024×1024.
 */

export * from "@/lib/campaign/__tests__/support/jpeg-fixtures";

/**
 * O quadrado 1024×1024 tem metade esquerda vermelha, metade direita azul e dois
 * marcadores 64×64 (preto à esquerda, branco à direita), o que permite provar
 * escala uniforme e ausência de crop/pad após o fator único 9/8.
 */

export const FIXTURE_WIDTH = 1024;
export const FIXTURE_HEIGHT = 1024;

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
