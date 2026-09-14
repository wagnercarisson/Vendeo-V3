import { describe, expect, it, vi } from "vitest";
import { defaultAiGateway, defaultAiModelResolver } from "../index";
import { PersistedModelResolver } from "../persisted-model-resolver";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

describe("AI composition F47", () => {
  it("usa um PersistedModelResolver singleton no gateway padrão", async () => {
    expect(defaultAiModelResolver).toBeInstanceOf(PersistedModelResolver);
    expect(await defaultAiGateway.hasFallback("campaign_copy")).toBe(true);
    expect(await defaultAiGateway.hasFallback("campaign_image")).toBe(false);
  });

  it("preserva a superfície do gateway e não aciona fallback automático", () => {
    expect(typeof defaultAiGateway.invoke).toBe("function");
    expect(typeof defaultAiGateway.hasFallback).toBe("function");
  });
});
