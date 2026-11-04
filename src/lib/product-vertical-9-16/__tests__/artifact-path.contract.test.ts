// @vitest-environment node
import { describe, expect, it } from "vitest";

import { NEW_FLOW_ARTIFACT_PATH_RE } from "@/lib/product-1-1/artifact/artifact-path";
import {
  VERTICAL_ARTIFACT_PATH_RE,
  artifactStoragePath,
  isVerticalArtifactPath,
} from "../artifact/artifact-path";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";

const VERTICAL = `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg`;
const ONE_TO_ONE = `${STORE}/${CAMPAIGN}/product-1-1/${OPERATION}/art-1024.jpg`;

describe("F59 — path do artefato vertical 9:16", () => {
  it("é determinístico", () => {
    expect(artifactStoragePath(STORE, CAMPAIGN, OPERATION)).toBe(VERTICAL);
    expect(isVerticalArtifactPath(VERTICAL)).toBe(true);
  });

  it("o regex vertical casa o path vertical e rejeita o 1:1", () => {
    expect(VERTICAL_ARTIFACT_PATH_RE.test(VERTICAL)).toBe(true);
    expect(VERTICAL_ARTIFACT_PATH_RE.test(ONE_TO_ONE)).toBe(false);
    expect(isVerticalArtifactPath(ONE_TO_ONE)).toBe(false);
  });

  it("o regex 1:1 continua rejeitando o path vertical", () => {
    expect(NEW_FLOW_ARTIFACT_PATH_RE.test(VERTICAL)).toBe(false);
    expect(NEW_FLOW_ARTIFACT_PATH_RE.test(ONE_TO_ONE)).toBe(true);
  });

  it("rejeita arte 1:1 sob o diretório vertical", () => {
    expect(
      isVerticalArtifactPath(
        `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1024.jpg`,
      ),
    ).toBe(false);
  });

  it("rejeita extensão, segmentos e shape fora do contrato", () => {
    const rejected = [
      `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpeg`,
      `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.png`,
      `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg.tmp`,
      `store-1/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg`,
      `${STORE}/camp-1/product-9-16/${OPERATION}/art-1080x1920.jpg`,
      `${STORE}/${CAMPAIGN}/product-9-16/op-1/art-1080x1920.jpg`,
      "",
    ];
    for (const path of rejected) {
      expect(isVerticalArtifactPath(path)).toBe(false);
    }
  });

  it("aceita maiúsculas por ser case-insensitive", () => {
    expect(isVerticalArtifactPath(VERTICAL.toUpperCase())).toBe(true);
  });
});
