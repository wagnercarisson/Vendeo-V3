// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  GENERATION_CONTRACT_VERSION,
  resolveCampaignGenerationOrigin,
} from "@/lib/product-9-16-two-stage/orchestration/origin";

import { resolveTwoFormatOrigin } from "../origin";
import {
  TWO_FORMAT_GENERATION_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_ORIGIN,
} from "../types";

const JOINT_ORIGIN_SNAPSHOT = {
  generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
  generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
} as const;

describe("resolveTwoFormatOrigin — par conjunto explícito", () => {
  it("reconhece o par conjunto exato e congela o resultado", () => {
    const resolution = resolveTwoFormatOrigin(JOINT_ORIGIN_SNAPSHOT);

    expect(resolution).toEqual({ kind: "two_format_two_stage" });
    expect(Object.isFrozen(resolution)).toBe(true);
  });

  it("exige a versão conjunta quando a origem é conjunta", () => {
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
      }),
    ).toEqual({ kind: "indeterminate", reason: "incomplete_origin_pair" });
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
        generationContractVersion: null,
      }),
    ).toEqual({ kind: "indeterminate", reason: "incomplete_origin_pair" });
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
        generationContractVersion: "",
      }),
    ).toEqual({ kind: "indeterminate", reason: "incomplete_origin_pair" });
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
        generationContractVersion: 42,
      }),
    ).toEqual({ kind: "indeterminate", reason: "incomplete_origin_pair" });
  });

  it("detecta pares incoerentes entre origem e versão", () => {
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
        generationContractVersion: GENERATION_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "indeterminate", reason: "incoherent_origin_pair" });
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: "9_16_two_stage",
        generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "indeterminate", reason: "incoherent_origin_pair" });
    expect(
      resolveTwoFormatOrigin({
        generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "indeterminate", reason: "incomplete_origin_pair" });
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: null,
        generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "indeterminate", reason: "malformed_origin" });
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: 42,
        generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "indeterminate", reason: "malformed_origin" });
  });

  it("recusa versão conjunta desconhecida e origem desconhecida", () => {
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
        generationContractVersion: "f60.7-two-format-v2",
      }),
    ).toEqual({ kind: "indeterminate", reason: "unsupported_version" });
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: "desconhecida",
        generationContractVersion: "x",
      }),
    ).toEqual({ kind: "indeterminate", reason: "unsupported_origin" });
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: "9_16_two_stage",
        generationContractVersion: "f60.7-two-format-v2",
      }),
    ).toEqual({ kind: "indeterminate", reason: "unsupported_version" });
  });
});

describe("resolveTwoFormatOrigin — delegação byte-idêntica", () => {
  const NON_JOINT_MATRIX: readonly unknown[] = [
    null,
    undefined,
    [],
    "x",
    {},
    {
      generationOrigin: "9_16_two_stage",
      generationContractVersion: GENERATION_CONTRACT_VERSION,
    },
    { generationOrigin: "9_16_two_stage" },
    { generationOrigin: 42 },
    { generationContractVersion: GENERATION_CONTRACT_VERSION },
    {
      generationOrigin: "desconhecida",
      generationContractVersion: "desconhecida",
    },
  ];

  it.each(NON_JOINT_MATRIX.map((value, index) => [index, value] as const))(
    "snapshot #%s é idêntico ao resolvedor existente",
    (_index, snapshot) => {
      expect(resolveTwoFormatOrigin(snapshot)).toEqual(
        resolveCampaignGenerationOrigin(snapshot),
      );
    },
  );

  it("preserva 9:16 individual, histórico e indeterminado", () => {
    expect(
      resolveTwoFormatOrigin({
        generationOrigin: "9_16_two_stage",
        generationContractVersion: GENERATION_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "two_stage_9_16" });
    expect(resolveTwoFormatOrigin({})).toEqual({ kind: "historical" });
    expect(resolveTwoFormatOrigin(null)).toEqual({ kind: "historical" });
  });
});

describe("auditoria 1.5 — origem conjunta no resolvedor compartilhado", () => {
  it("o par conjunto canônico NÃO é reconhecido pelo resolvedor existente", () => {
    const shared = resolveCampaignGenerationOrigin(JOINT_ORIGIN_SNAPSHOT);

    expect(shared).toMatchObject({ kind: "indeterminate" });
    expect(shared).not.toMatchObject({ kind: "historical" });
    expect(shared).not.toMatchObject({ kind: "two_stage_9_16" });
  });
});
