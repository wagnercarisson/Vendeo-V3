import { describe, expect, it } from "vitest";

import {
  COMPOSITION_VERTICAL_PATH_RE,
  THUMBNAIL_RECIPE_VERSION,
  deriveThumbnailPath,
  isEligibleCampaignArtPath,
  isThumbnailPath,
} from "../thumbnail-path";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";

const VERTICAL = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

describe("thumbnail path for the composition vertical", () => {
  it("recognizes and derives the thumb-v1 path", () => {
    expect(COMPOSITION_VERTICAL_PATH_RE.test(VERTICAL)).toBe(true);
    expect(isEligibleCampaignArtPath(VERTICAL)).toBe(true);
    expect(deriveThumbnailPath(VERTICAL)).toBe(
      `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
    );
    expect(
      isThumbnailPath(
        `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
      ),
    ).toBe(true);
  });

  it("keeps internal square roles and inputs ineligible", () => {
    expect(
      isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}/${OPERATION}/square_original.jpg`),
    ).toBe(false);
    expect(
      isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}/${OPERATION}/square_prepared.jpg`),
    ).toBe(false);
    expect(
      isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}/inputs/vertical.jpg`),
    ).toBe(false);
    expect(
      isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}/${OPERATION}/logo.jpg`),
    ).toBe(false);
    expect(
      isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}/${OPERATION}/signature.jpg`),
    ).toBe(false);
    expect(isEligibleCampaignArtPath(`bench/${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`)).toBe(
      false,
    );
    expect(isEligibleCampaignArtPath(`lab/${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`)).toBe(
      false,
    );
  });

  it("keeps the legacy and direct vertical patterns intact", () => {
    expect(deriveThumbnailPath(`${STORE}/${CAMPAIGN}.jpg`)).toBe(
      `${STORE}/${CAMPAIGN}.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
    );
    expect(
      deriveThumbnailPath(
        `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg`,
      ),
    ).toBe(
      `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.thumb-v${THUMBNAIL_RECIPE_VERSION}.webp`,
    );
  });

  it("rejects malformed composition paths", () => {
    expect(isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}/vertical.jpg`)).toBe(false);
    expect(
      isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}/${OPERATION}/vertical.png`),
    ).toBe(false);
    expect(
      isEligibleCampaignArtPath(`${STORE}/${CAMPAIGN}/${OPERATION}/extra/vertical.jpg`),
    ).toBe(false);
  });
});
