// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  FORMAT_CONTRACT_VERSION,
  resolveCampaignFormat,
} from "@/lib/campaign/format-resolution";

import { resolveTwoFormatContract } from "../format";
import {
  TWO_FORMAT_CAMPAIGN_FORMAT,
  TWO_FORMAT_CONTRACT_VERSION,
} from "../types";

const JOINT_SNAPSHOT = {
  campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
  formatContractVersion: TWO_FORMAT_CONTRACT_VERSION,
} as const;

describe("resolveTwoFormatContract — par conjunto explícito", () => {
  it("reconhece o par conjunto exato e devolve resultado congelado", () => {
    const resolution = resolveTwoFormatContract(JOINT_SNAPSHOT);

    expect(resolution).toEqual({
      kind: "two_format",
      contractVersion: TWO_FORMAT_CONTRACT_VERSION,
    });
    expect(Object.isFrozen(resolution)).toBe(true);
  });

  it("exige a versão conjunta reconhecida (nunca cai para 1:1)", () => {
    expect(
      resolveTwoFormatContract({ campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT }),
    ).toEqual({ kind: "unavailable", reason: "missing_version" });
    expect(
      resolveTwoFormatContract({
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
        formatContractVersion: null,
      }),
    ).toEqual({ kind: "unavailable", reason: "missing_version" });
    expect(
      resolveTwoFormatContract({
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
        formatContractVersion: "",
      }),
    ).toEqual({ kind: "unavailable", reason: "missing_version" });
    expect(
      resolveTwoFormatContract({
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
        formatContractVersion: 42,
      }),
    ).toEqual({ kind: "unavailable", reason: "missing_version" });
    expect(
      resolveTwoFormatContract({
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
        formatContractVersion: FORMAT_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "unavailable", reason: "incoherent_pair" });
    expect(
      resolveTwoFormatContract({
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
        formatContractVersion: "f60.7-two-format-v2",
      }),
    ).toEqual({ kind: "unavailable", reason: "unsupported_version" });
  });

  it("falha fechado para versão conjunta órfã ou com outro formato", () => {
    expect(
      resolveTwoFormatContract({
        formatContractVersion: TWO_FORMAT_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "unavailable", reason: "incoherent_pair" });
    expect(
      resolveTwoFormatContract({
        campaignFormat: "9:16",
        formatContractVersion: TWO_FORMAT_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "unavailable", reason: "incoherent_pair" });
    expect(
      resolveTwoFormatContract({
        campaignFormat: "1:1",
        formatContractVersion: TWO_FORMAT_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "unavailable", reason: "incoherent_pair" });
  });

  it("recusa listas de formatos sem delegar e sem fallback para 1:1", () => {
    expect(
      resolveTwoFormatContract({ campaignFormats: ["1:1", "9:16"] }),
    ).toEqual({ kind: "unavailable", reason: "unsupported_format" });
    expect(
      resolveTwoFormatContract({
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
        campaignFormats: ["1:1", "9:16"],
      }),
    ).toEqual({ kind: "unavailable", reason: "unsupported_format" });
    expect(resolveTwoFormatContract({ formats: ["1:1"] })).toEqual({
      kind: "unavailable",
      reason: "unsupported_format",
    });
    expect(
      resolveTwoFormatContract({ campaignFormat: "1:1", formats: ["1:1"] }),
    ).toEqual({ kind: "unavailable", reason: "unsupported_format" });
  });

  it("trata formato malformado de campanha conjunta como malformado", () => {
    expect(resolveTwoFormatContract({ campaignFormat: null })).toEqual({
      kind: "unavailable",
      reason: "malformed_format",
    });
    expect(resolveTwoFormatContract({ campaignFormat: "" })).toEqual({
      kind: "unavailable",
      reason: "malformed_format",
    });
  });
});

describe("resolveTwoFormatContract — delegação byte-idêntica", () => {
  const NON_JOINT_MATRIX: readonly unknown[] = [
    null,
    undefined,
    [],
    "x",
    {},
    { campaignFormat: "1:1" },
    {
      campaignFormat: "9:16",
      formatContractVersion: FORMAT_CONTRACT_VERSION,
    },
    { campaignFormat: "9:16" },
    { campaignFormat: "9:16", formatContractVersion: "desconhecida" },
    { formatContractVersion: FORMAT_CONTRACT_VERSION },
    { campaignFormat: 42 },
  ];

  it.each(NON_JOINT_MATRIX.map((value, index) => [index, value] as const))(
    "snapshot #%s é idêntico ao resolvedor existente",
    (_index, snapshot) => {
      expect(resolveTwoFormatContract(snapshot)).toEqual(
        resolveCampaignFormat(snapshot),
      );
    },
  );

  it("1:1 sem chaves continua resolvendo como antes", () => {
    expect(resolveTwoFormatContract({})).toEqual({
      kind: "1:1",
      source: "absent",
    });
  });

  it("9:16 individual continua resolvendo com a versão f59", () => {
    expect(
      resolveTwoFormatContract({
        campaignFormat: "9:16",
        formatContractVersion: FORMAT_CONTRACT_VERSION,
      }),
    ).toEqual({
      kind: "9:16",
      contractVersion: FORMAT_CONTRACT_VERSION,
    });
  });
});

describe("auditoria 1.5 — resolvedor compartilhado permanece fail-closed", () => {
  it("o par conjunto canônico NÃO é reconhecido pelo resolvedor existente", () => {
    const shared = resolveCampaignFormat(JOINT_SNAPSHOT);

    expect(shared).toMatchObject({ kind: "unavailable" });
    expect(shared).not.toMatchObject({ kind: "1:1" });
    expect(shared).not.toMatchObject({ kind: "9:16" });
  });

  it("o contrato dedicado é a única superfície que reconhece o par conjunto", () => {
    expect(resolveTwoFormatContract(JOINT_SNAPSHOT)).toEqual({
      kind: "two_format",
      contractVersion: TWO_FORMAT_CONTRACT_VERSION,
    });
  });

  it("a integração do resolvedor compartilhado pertence à Subfatia C", () => {
    // Documenta a fronteira: nenhum consumidor de produção é conectado nesta
    // subfatia e o par conjunto continua indisponível para os consumidores atuais.
    expect(resolveCampaignFormat({ campaignFormat: "1:1" })).toEqual({
      kind: "unavailable",
      reason: "explicit_one_to_one",
    });
    expect(
      resolveCampaignFormat({
        campaignFormat: "9:16",
        formatContractVersion: FORMAT_CONTRACT_VERSION,
      }),
    ).toEqual({ kind: "9:16", contractVersion: FORMAT_CONTRACT_VERSION });
  });
});
