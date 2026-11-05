// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  supabaseAdmin: { from: vi.fn(), storage: { from: vi.fn() } },
}));
vi.mock("@/lib/image-generation/config", () => ({
  IMAGE_GENERATION_GLOBAL_TIMEOUT_MS: 300_000,
}));

import { mapRestoredForm } from "@/lib/campaign/display";

const CAMPAIGN_ID = "550e8400-e29b-41d4-a716-446655440000";

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    product: { name: "Produto F59" },
    commercial: { intent: "offer", originalPriceCents: 0 },
    ...overrides,
  };
}

function restored(overrides: Record<string, unknown> = {}) {
  return mapRestoredForm({
    campaignId: CAMPAIGN_ID,
    inputSnapshot: snapshot(overrides),
  });
}

describe("F59/59-08 — restore do formato persistido (display.ts)", () => {
  it("ausência das duas chaves ⇒ 1:1 histórico", () => {
    expect(restored()).toMatchObject({
      campaignFormat: "1:1",
      formatContractVersion: null,
      formatUnavailable: false,
    });
  });

  it("9:16 + v1 ⇒ vertical reconhecido", () => {
    expect(
      restored({
        campaignFormat: "9:16",
        formatContractVersion: "f59-vertical-9-16-v1",
      }),
    ).toMatchObject({
      campaignFormat: "9:16",
      formatContractVersion: "f59-vertical-9-16-v1",
      formatUnavailable: false,
    });
  });

  it.each([
    ["sem versão", { campaignFormat: "9:16" }, "missing_version"],
    [
      "versão desconhecida",
      { campaignFormat: "9:16", formatContractVersion: "f59-vertical-9-16-v9" },
      "unsupported_version",
    ],
  ])("9:16 %s ⇒ indisponível, sem virar 1:1", (_label, overrides, reason) => {
    expect(restored(overrides)).toMatchObject({
      campaignFormat: "9:16",
      formatContractVersion: null,
      formatUnavailable: true,
      formatUnavailableReason: reason,
    });
  });

  it.each([
    { label: "null", overrides: { campaignFormat: null }, reason: "malformed_format" },
    { label: "string vazia", overrides: { campaignFormat: "" }, reason: "malformed_format" },
    { label: "não-string", overrides: { campaignFormat: 123 }, reason: "malformed_format" },
    {
      label: "versão sem formato",
      overrides: { formatContractVersion: "f59-vertical-9-16-v1" },
      reason: "incoherent_pair",
    },
    {
      label: "1:1 sem versão",
      overrides: { campaignFormat: "1:1" },
      reason: "explicit_one_to_one",
    },
    {
      label: "1:1 com versão",
      overrides: {
        campaignFormat: "1:1",
        formatContractVersion: "f59-vertical-9-16-v1",
      },
      reason: "explicit_one_to_one",
    },
  ])("formato $label ⇒ indisponível", ({ overrides, reason }) => {
    expect(restored(overrides)).toMatchObject({
      formatUnavailable: true,
      formatUnavailableReason: reason,
    });
  });

  it("produto sem nome continua retornando null", () => {
    expect(
      mapRestoredForm({
        campaignId: CAMPAIGN_ID,
        inputSnapshot: { product: { name: "  " } },
      }),
    ).toBeNull();
  });

  it("display.ts usa a tabela neutra e NÃO importa o módulo vertical", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/campaign/display.ts"),
      "utf8",
    );
    expect(source).toMatch(/format-resolution/);
    expect(source).toMatch(/resolveCampaignFormat/);
    expect(source).not.toMatch(/product-vertical-9-16/);
  });

  it("a página nova resolve o formato e bloqueia quando indisponível/flag OFF", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/app/(app)/campanhas/nova/page.tsx"),
      "utf8",
    );
    expect(source).toMatch(/resolveCampaignFormat/);
    expect(source).toMatch(/campaignFormatPaused/);
    expect(source).toMatch(/restoredForm\.formatUnavailable/);
  });
});
