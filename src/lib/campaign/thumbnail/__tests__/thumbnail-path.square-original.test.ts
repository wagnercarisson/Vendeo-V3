// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  COMPOSITION_SQUARE_ORIGINAL_PATH_RE,
  COMPOSITION_VERTICAL_PATH_RE,
  THUMBNAIL_RECIPE_VERSION,
  deriveThumbnailPath,
  isEligibleCampaignArtPath,
  isThumbnailPath,
} from "../thumbnail-path";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";

const SQUARE = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`;
const SQUARE_UPPER = `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.JPG`;
const PREPARED = `${STORE}/${CAMPAIGN}/${OPERATION}/square_prepared.jpg`;
const VERTICAL = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

describe("thumbnail path for the composition square_original", () => {
  it("reconhece o caminho canônico e deriva a miniatura v1", () => {
    expect(COMPOSITION_SQUARE_ORIGINAL_PATH_RE.test(SQUARE)).toBe(true);
    expect(isEligibleCampaignArtPath(SQUARE)).toBe(true);
    expect(deriveThumbnailPath(SQUARE)).toBe(
      `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
    );
    expect(
      isThumbnailPath(
        `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
      ),
    ).toBe(true);
  });

  it("aceita case-insensitive apenas no padrão canônico de quatro segmentos", () => {
    expect(isEligibleCampaignArtPath(SQUARE_UPPER)).toBe(true);
    expect(deriveThumbnailPath(SQUARE_UPPER)).toBe(
      `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
    );
  });

  it("mantém o padrão vertical e não confunde papéis", () => {
    expect(COMPOSITION_VERTICAL_PATH_RE.test(VERTICAL)).toBe(true);
    expect(COMPOSITION_SQUARE_ORIGINAL_PATH_RE.test(VERTICAL)).toBe(false);
    expect(COMPOSITION_VERTICAL_PATH_RE.test(SQUARE)).toBe(false);
    expect(COMPOSITION_SQUARE_ORIGINAL_PATH_RE.test(PREPARED)).toBe(false);
  });

  it("mantém square_prepared inelegível como entrega", () => {
    expect(isEligibleCampaignArtPath(PREPARED)).toBe(false);
    expect(deriveThumbnailPath(PREPARED)).toBeNull();
  });

  it("preserva os caminhos legados e do fluxo novo (matriz de regressão)", () => {
    const matrix: ReadonlyArray<readonly [string, string]> = [
      [
        `${STORE}/${CAMPAIGN}.jpg`,
        `${STORE}/${CAMPAIGN}.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
      ],
      [
        `${STORE}/${CAMPAIGN}/v2.jpg`,
        `${STORE}/${CAMPAIGN}/v2.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
      ],
      [
        `${STORE}/${CAMPAIGN}/v3.jpg`,
        `${STORE}/${CAMPAIGN}/v3.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
      ],
      [
        `${STORE}/${CAMPAIGN}/product-1-1/${OPERATION}/art-1024.jpg`,
        `${STORE}/${CAMPAIGN}/product-1-1/${OPERATION}/art-1024.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
      ],
      [
        `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg`,
        `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
      ],
      [
        VERTICAL,
        `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
      ],
    ];

    for (const [original, thumbnail] of matrix) {
      expect(isEligibleCampaignArtPath(original)).toBe(true);
      expect(deriveThumbnailPath(original)).toBe(thumbnail);
    }
  });

  it("recusa entradas hostis do novo padrão", () => {
    const rejected = [
      `/${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`,
      `${STORE}/${CAMPAIGN}/${OPERATION}/../square_original.jpg`,
      `${STORE}/${CAMPAIGN}/${OPERATION}/%2e%2e/square_original.jpg`,
      `${STORE}/${CAMPAIGN}/${OPERATION}\\square_original.jpg`,
      `${STORE}/${CAMPAIGN}/${OPERATION}/extra/square_original.jpg`,
      `${STORE}/${CAMPAIGN}/${OPERATION}/square_art.jpg`,
      `${STORE}/${CAMPAIGN}/${OPERATION}/unknown_role.jpg`,
      `${STORE}/${CAMPAIGN}/square_original.jpg`,
      `${STORE}/square_original.JPG`,
      `${STORE}/${CAMPAIGN}/${OPERATION}/square_original.png`,
    ];

    for (const path of rejected) {
      expect(isEligibleCampaignArtPath(path)).toBe(false);
      expect(deriveThumbnailPath(path)).toBeNull();
    }
  });
});
