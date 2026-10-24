import { describe, expect, it } from "vitest";
import { isVisualSignatureSmokeNoRetry } from "../smoke-retry-policy";

describe("F47.2 — retry zero escopado ao smoke", () => {
  it("desligado por padrão", () => {
    expect(isVisualSignatureSmokeNoRetry({})).toBe(false);
    expect(isVisualSignatureSmokeNoRetry({ VENDEO_VS_SMOKE_NO_RETRY: "true" })).toBe(false);
  });

  it("ligado somente com valor explícito 1", () => {
    expect(isVisualSignatureSmokeNoRetry({ VENDEO_VS_SMOKE_NO_RETRY: "1" })).toBe(true);
  });
});
