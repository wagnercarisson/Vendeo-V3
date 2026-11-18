// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { classifyTwoFormatCampaign } from "../contracts";
import {
  TWO_FORMAT_CAMPAIGN_FORMAT,
  TWO_FORMAT_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_ORIGIN,
} from "../types";

const JOINT_SNAPSHOT = {
  campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
  formatContractVersion: TWO_FORMAT_CONTRACT_VERSION,
  generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
  generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
} as const;

describe("classifyTwoFormatCampaign", () => {
  it("classifica como conjunta somente com as duas versões conjuntas", () => {
    expect(classifyTwoFormatCampaign(JOINT_SNAPSHOT)).toEqual({
      kind: "two_format",
    });
  });

  it("formato conjunto com origem ausente ou divergente é inconsistente", () => {
    expect(
      classifyTwoFormatCampaign({
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
        formatContractVersion: TWO_FORMAT_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "inconsistent", reason: "origin_not_two_format" });

    expect(
      classifyTwoFormatCampaign({
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
        formatContractVersion: TWO_FORMAT_CONTRACT_VERSION,
        generationOrigin: "9_16_two_stage",
        generationContractVersion: "f60.5-two-stage-9-16-v1",
      }),
    ).toEqual({ kind: "inconsistent", reason: "origin_not_two_format" });
  });

  it("origem conjunta com formato não conjunto é inconsistente", () => {
    expect(
      classifyTwoFormatCampaign({
        generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
        generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "inconsistent", reason: "format_not_two_format" });

    expect(
      classifyTwoFormatCampaign({
        campaignFormat: "9:16",
        formatContractVersion: "f59-vertical-9-16-v1",
        generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
        generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "inconsistent", reason: "format_not_two_format" });
  });

  it("snapshot sem nenhuma chave conjunta não é campanha conjunta", () => {
    expect(classifyTwoFormatCampaign({})).toEqual({ kind: "not_two_format" });
    expect(classifyTwoFormatCampaign(null)).toEqual({ kind: "not_two_format" });
    expect(
      classifyTwoFormatCampaign({
        campaignFormat: "9:16",
        formatContractVersion: "f59-vertical-9-16-v1",
        generationOrigin: "9_16_two_stage",
        generationContractVersion: "f60.5-two-stage-9-16-v1",
      }),
    ).toEqual({ kind: "not_two_format" });
  });

  it("par conjunto inválido é inconsistente com o motivo fechado", () => {
    expect(
      classifyTwoFormatCampaign({ campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT }),
    ).toEqual({
      kind: "inconsistent",
      reason: "format_unavailable:missing_version",
    });

    expect(
      classifyTwoFormatCampaign({
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
        formatContractVersion: TWO_FORMAT_CONTRACT_VERSION,
        generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
      }),
    ).toEqual({
      kind: "inconsistent",
      reason: "origin_not_two_format",
    });

    expect(
      classifyTwoFormatCampaign({
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
        formatContractVersion: "f60.7-two-format-v2",
      }),
    ).toEqual({
      kind: "inconsistent",
      reason: "format_unavailable:unsupported_version",
    });
  });

  it("lista de formatos nunca é classificada como conjunta", () => {
    expect(
      classifyTwoFormatCampaign({
        campaignFormats: ["1:1", "9:16"],
        generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
        generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "inconsistent", reason: "format_not_two_format" });

    expect(classifyTwoFormatCampaign({ formats: ["1:1"] })).toEqual({
      kind: "not_two_format",
    });
  });
});

describe("fronteira dos contratos puros", () => {
  const MODULES = [
    "src/lib/product-two-format/types.ts",
    "src/lib/product-two-format/format.ts",
    "src/lib/product-two-format/origin.ts",
    "src/lib/product-two-format/contracts.ts",
  ] as const;

  it.each(MODULES)("%s não importa runtime de servidor", (modulePath) => {
    const source = readFileSync(path.resolve(process.cwd(), modulePath), "utf8");

    expect(source).not.toContain("server-only");
    expect(source).not.toContain("@supabase/");
    expect(source).not.toContain('from "next/');
    expect(source).not.toContain("from 'next/");
    expect(source).not.toContain('from "sharp"');
    expect(source).not.toContain("node:fs");
  });
});
