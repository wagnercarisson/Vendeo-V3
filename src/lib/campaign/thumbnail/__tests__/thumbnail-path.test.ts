// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  THUMBNAIL_RECIPE_VERSION,
  deriveThumbnailPath,
  isEligibleCampaignArtPath,
  isThumbnailPath,
} from "../thumbnail-path";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";

const LEGACY = `${STORE}/${CAMPAIGN}.jpg`;
const CORRECTION_V2 = `${STORE}/${CAMPAIGN}/v2.jpg`;
const CORRECTION_V3 = `${STORE}/${CAMPAIGN}/v3.jpg`;
const NEW_FLOW = `${STORE}/${CAMPAIGN}/product-1-1/${OPERATION}/art-1024.jpg`;
const VERTICAL_FLOW = `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg`;

describe("thumbnail-path", () => {
  it("deriva o caminho dos quatro shapes canônicos com versão da recipe", () => {
    expect(deriveThumbnailPath(LEGACY)).toBe(
      `${STORE}/${CAMPAIGN}.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
    );
    expect(deriveThumbnailPath(CORRECTION_V2)).toBe(
      `${STORE}/${CAMPAIGN}/v2.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
    );
    expect(deriveThumbnailPath(CORRECTION_V3)).toBe(
      `${STORE}/${CAMPAIGN}/v3.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
    );
    expect(deriveThumbnailPath(NEW_FLOW)).toBe(
      `${STORE}/${CAMPAIGN}/product-1-1/${OPERATION}/art-1024.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
    );
    expect(deriveThumbnailPath(VERTICAL_FLOW)).toBe(
      `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
    );
  });

  it("é determinístico e único por original", () => {
    const paths = [LEGACY, CORRECTION_V2, CORRECTION_V3, NEW_FLOW, VERTICAL_FLOW].map(
      deriveThumbnailPath,
    );
    expect(new Set(paths).size).toBe(5);
    expect(deriveThumbnailPath(LEGACY)).toBe(deriveThumbnailPath(LEGACY));
    expect(deriveThumbnailPath(VERTICAL_FLOW)).toBe(
      deriveThumbnailPath(VERTICAL_FLOW),
    );
  });

  it("aceita extensão .jpeg no legado, v2 e v3", () => {
    expect(isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}.jpeg`)).toBe(true);
    expect(isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}/v2.jpeg`)).toBe(true);
    expect(isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}/v3.jpeg`)).toBe(true);
    expect(
      isEligibleCampaignArtPath(
        `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpeg`,
      ),
    ).toBe(true);
  });

  it("reconhece o path vertical 9:16 e deriva sua miniatura", () => {
    expect(isEligibleCampaignArtPath(VERTICAL_FLOW)).toBe(true);
    expect(isThumbnailPath(deriveThumbnailPath(VERTICAL_FLOW)!)).toBe(true);
  });

  it("não confunde 1:1 e 9:16", () => {
    expect(
      isEligibleCampaignArtPath(
        `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1024.jpg`,
      ),
    ).toBe(false);
    expect(
      isEligibleCampaignArtPath(
        `${STORE}/${CAMPAIGN}/product-1-1/${OPERATION}/art-1080x1920.jpg`,
      ),
    ).toBe(false);
  });

  it("rejeita inputs, logos, assinaturas, bench, lab e paths arbitrários", () => {
    const rejected = [
      `${STORE}/${CAMPAIGN}/inputs/${OPERATION}.jpg`,
      `${STORE}/${CAMPAIGN}/product-9-16/inputs/art-1080x1920.jpg`,
      `${STORE}/logo.png`,
      `logos/${STORE}/logo.png`,
      `${STORE}/signature.png`,
      `bench/${CAMPAIGN}/inputs/1.jpg`,
      `bench/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg`,
      `lab/${CAMPAIGN}.jpg`,
      `lab/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg`,
      `${STORE}/${CAMPAIGN}/v1.jpg`,
      `${STORE}/${CAMPAIGN}/v4.jpg`,
      `${STORE}/${CAMPAIGN}/v10.jpg`,
      `${STORE}/${CAMPAIGN}/v02.jpg`,
      `${STORE}/${CAMPAIGN}/v03.jpg`,
      `${STORE}/${CAMPAIGN}/v3.png`,
      `${STORE}/${CAMPAIGN}/v3`,
      `${STORE}/${CAMPAIGN}.png`,
      "arbitrary/path.jpg",
      "",
    ];
    for (const path of rejected) {
      expect(isEligibleCampaignArtPath(path)).toBe(false);
      expect(deriveThumbnailPath(path)).toBeNull();
    }
  });

  it("rejeita miniatura como original e reconhece miniatura derivada", () => {
    const thumb = deriveThumbnailPath(NEW_FLOW)!;
    expect(isThumbnailPath(thumb)).toBe(true);
    expect(isEligibleCampaignArtPath(thumb)).toBe(false);
    expect(deriveThumbnailPath(thumb)).toBeNull();
  });

  it("rejeita store/campaign/operation fora do formato UUID canônico", () => {
    expect(isEligibleCampaignArtPath("store-1/camp-1.jpg")).toBe(false);
    expect(
      isEligibleCampaignArtPath(
        `store-1/${CAMPAIGN}/product-1-1/${OPERATION}/art-1024.jpg`,
      ),
    ).toBe(false);
  });
});
