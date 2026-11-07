// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  FORMAT_CONTRACT_VERSION,
  formatUnavailableMessageKey,
  isCampaignFormatAvailable,
  resolveCampaignFormat,
  type CampaignFormatResolution,
} from "@/lib/campaign/format-resolution";
import * as verticalFormat from "@/lib/product-vertical-9-16/format";

function code(resolution: CampaignFormatResolution): string {
  return resolution.kind === "unavailable"
    ? `unavailable:${resolution.reason}`
    : resolution.kind === "1:1"
      ? "1:1"
      : `9:16:${resolution.contractVersion}`;
}

const V1 = FORMAT_CONTRACT_VERSION;

describe("F59 — format-resolution (tabela total e fail-closed)", () => {
  const cases: ReadonlyArray<readonly [string, unknown, string]> = [
    ["null", null, "unavailable:malformed_format"],
    ["undefined", undefined, "unavailable:malformed_format"],
    ["string", "x", "unavailable:malformed_format"],
    ["number", 123, "unavailable:malformed_format"],
    ["boolean", true, "unavailable:malformed_format"],
    ["array", [], "unavailable:malformed_format"],
    ["objeto vazio", {}, "1:1"],
    [
      "campaignFormat null",
      { campaignFormat: null },
      "unavailable:malformed_format",
    ],
    [
      "campaignFormat vazio",
      { campaignFormat: "" },
      "unavailable:malformed_format",
    ],
    [
      "campaignFormat numérico",
      { campaignFormat: 123 },
      "unavailable:malformed_format",
    ],
    [
      "campaignFormat booleano",
      { campaignFormat: true },
      "unavailable:malformed_format",
    ],
    [
      "campaignFormat array",
      { campaignFormat: [] },
      "unavailable:malformed_format",
    ],
    [
      "1:1 sem versão",
      { campaignFormat: "1:1" },
      "unavailable:explicit_one_to_one",
    ],
    [
      "1:1 com versão",
      { campaignFormat: "1:1", formatContractVersion: V1 },
      "unavailable:explicit_one_to_one",
    ],
    [
      "9:16 com versão v1",
      { campaignFormat: "9:16", formatContractVersion: V1 },
      `9:16:${V1}`,
    ],
    [
      "9:16 sem versão",
      { campaignFormat: "9:16" },
      "unavailable:missing_version",
    ],
    [
      "9:16 com versão null",
      { campaignFormat: "9:16", formatContractVersion: null },
      "unavailable:missing_version",
    ],
    [
      "9:16 com versão vazia",
      { campaignFormat: "9:16", formatContractVersion: "" },
      "unavailable:missing_version",
    ],
    [
      "9:16 com versão não-string",
      { campaignFormat: "9:16", formatContractVersion: 1 },
      "unavailable:missing_version",
    ],
    [
      "9:16 com versão desconhecida",
      { campaignFormat: "9:16", formatContractVersion: "f59-vertical-9-16-v2" },
      "unavailable:unsupported_version",
    ],
    [
      "9:16 com versão genérica",
      { campaignFormat: "9:16", formatContractVersion: "v1" },
      "unavailable:unsupported_version",
    ],
    [
      "versão sem formato",
      { formatContractVersion: V1 },
      "unavailable:incoherent_pair",
    ],
    [
      "versão desconhecida sem formato",
      { formatContractVersion: "v1" },
      "unavailable:incoherent_pair",
    ],
    [
      "formato desconhecido 16:9",
      { campaignFormat: "16:9" },
      "unavailable:unsupported_format",
    ],
    [
      "formato desconhecido vertical",
      { campaignFormat: "vertical" },
      "unavailable:unsupported_format",
    ],
    [
      "campaignFormat undefined é ausente",
      { campaignFormat: undefined },
      "1:1",
    ],
    [
      "ambas as chaves undefined são ausentes",
      { campaignFormat: undefined, formatContractVersion: undefined },
      "1:1",
    ],
    [
      "campaignFormat undefined + versão presente",
      { campaignFormat: undefined, formatContractVersion: V1 },
      "unavailable:incoherent_pair",
    ],
  ];

  it.each(cases)("%s", (_label, snapshot, expected) => {
    expect(code(resolveCampaignFormat(snapshot))).toBe(expected);
  });

  it("nunca lança para entradas não-objeto ou malformadas", () => {
    for (const value of [null, undefined, [], "x", 123, true, Symbol("s")]) {
      expect(() => resolveCampaignFormat(value)).not.toThrow();
    }
  });

  it("'1:1' NUNCA resolve para 9:16 (com ou sem versão)", () => {
    expect(resolveCampaignFormat({ campaignFormat: "1:1" })).not.toMatchObject(
      { kind: "9:16" },
    );
    expect(
      resolveCampaignFormat({
        campaignFormat: "1:1",
        formatContractVersion: V1,
      }),
    ).not.toMatchObject({ kind: "9:16" });
  });

  it("isCampaignFormatAvailable distingue disponível de indisponível", () => {
    expect(isCampaignFormatAvailable(resolveCampaignFormat({}))).toBe(true);
    expect(
      isCampaignFormatAvailable(
        resolveCampaignFormat({
          campaignFormat: "9:16",
          formatContractVersion: V1,
        }),
      ),
    ).toBe(true);
    expect(
      isCampaignFormatAvailable(
        resolveCampaignFormat({ campaignFormat: "16:9" }),
      ),
    ).toBe(false);
  });

  it("formatUnavailableMessageKey é estável e não é texto de UI", () => {
    expect(formatUnavailableMessageKey("missing_version")).toBe(
      "campaign_format_unavailable_missing_version",
    );
    expect(formatUnavailableMessageKey("incoherent_pair")).not.toMatch(/\s/);
  });

  it("o namespace vertical apenas reexporta a mesma tabela", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/product-vertical-9-16/format.ts"),
      "utf8",
    );
    expect(source).toContain("format-resolution");
    expect(source).not.toContain("function resolveCampaignFormat");
    expect(source).not.toContain("malformed_format");
    expect(verticalFormat.FORMAT_CONTRACT_VERSION).toBe(V1);
    expect(verticalFormat.resolveCampaignFormat({})).toEqual({
      kind: "1:1",
      source: "absent",
    });
  });
});
