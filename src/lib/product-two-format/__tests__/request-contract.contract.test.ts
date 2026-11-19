// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  GenerateImageRequestSchema,
  NewFlowGenerateImageRequestSchema,
} from "@/lib/image-generation/schema";

import {
  TwoFormatDeclarationSchema,
  parseTwoFormatDeclaration,
} from "../request-contract";
import {
  TWO_FORMAT_CAMPAIGN_FORMAT,
  TWO_FORMAT_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_ORIGIN,
} from "../types";

const CANONICAL = {
  campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
  formatContractVersion: TWO_FORMAT_CONTRACT_VERSION,
  generationOrigin: TWO_FORMAT_GENERATION_ORIGIN,
  generationContractVersion: TWO_FORMAT_GENERATION_CONTRACT_VERSION,
} as const;

const VALID_NEW_FLOW_BODY = {
  storeId: "11111111-1111-4111-8111-111111111111",
  productName: "Cafeteira elétrica",
  backgroundDirection: "studio",
  campaignId: "22222222-2222-4222-8222-222222222222",
  operationId: "33333333-3333-4333-8333-333333333333",
} as const;

describe("TwoFormatDeclarationSchema", () => {
  it("aceita o corpo canônico e devolve objeto congelado com quatro chaves", () => {
    const parsed = TwoFormatDeclarationSchema.safeParse(CANONICAL);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(Object.isFrozen(parsed.data)).toBe(true);
    expect(Object.keys(parsed.data).sort()).toEqual([
      "campaignFormat",
      "formatContractVersion",
      "generationContractVersion",
      "generationOrigin",
    ]);
    expect(parsed.data).toEqual(CANONICAL);
  });

  const REJECTIONS: ReadonlyArray<readonly [string, unknown]> = [
    ["lista campaignFormats", { ...CANONICAL, campaignFormats: ["1:1", "9:16"] }],
    ["campo formats", { ...CANONICAL, formats: ["1:1"] }],
    ["campo additionalFormats", { ...CANONICAL, additionalFormats: ["9:16"] }],
    ["campo format", { ...CANONICAL, format: TWO_FORMAT_CAMPAIGN_FORMAT }],
    ["array no lugar de string", { ...CANONICAL, campaignFormat: [TWO_FORMAT_CAMPAIGN_FORMAT] }],
    ["campaignFormat 1:1", { ...CANONICAL, campaignFormat: "1:1" }],
    ["campaignFormat 9:16", { ...CANONICAL, campaignFormat: "9:16" }],
    ["versão conjunta v2", { ...CANONICAL, formatContractVersion: "f60.7-two-format-v2" }],
    [
      "versão de origem v2",
      { ...CANONICAL, generationContractVersion: "f60.7-two-format-v2" },
    ],
    ["origem individual", { ...CANONICAL, generationOrigin: "9_16_two_stage" }],
    ["chave extra", { ...CANONICAL, storeId: "11111111-1111-4111-8111-111111111111" }],
    ["objeto vazio", {}],
    ["não-objeto", "1:1+9:16"],
    ["array", []],
  ];

  it.each(REJECTIONS)("recusa %s", (_label, body) => {
    expect(TwoFormatDeclarationSchema.safeParse(body).success).toBe(false);
  });
});

describe("parseTwoFormatDeclaration", () => {
  it("devolve o contrato conjunto tipado para o corpo canônico", () => {
    expect(parseTwoFormatDeclaration(CANONICAL)).toEqual({
      kind: "two_format",
      declaration: CANONICAL,
    });
  });

  const INVALID_REASONS: ReadonlyArray<readonly [string, unknown, string]> = [
    [
      "lista campaignFormats",
      { ...CANONICAL, campaignFormats: ["1:1", "9:16"] },
      "unexpected_field",
    ],
    ["campo formats", { ...CANONICAL, formats: ["1:1"] }, "unexpected_field"],
    [
      "campo additionalFormats",
      { ...CANONICAL, additionalFormats: ["9:16"] },
      "unexpected_field",
    ],
    [
      "campo format",
      { ...CANONICAL, format: TWO_FORMAT_CAMPAIGN_FORMAT },
      "unexpected_field",
    ],
    ["chave extra", { ...CANONICAL, storeId: "x" }, "unexpected_field"],
    [
      "campaignFormat individual",
      { ...CANONICAL, campaignFormat: "9:16" },
      "unsupported_format",
    ],
    [
      "campaignFormat array",
      { ...CANONICAL, campaignFormat: [TWO_FORMAT_CAMPAIGN_FORMAT] },
      "unsupported_format",
    ],
    [
      "versão conjunta desconhecida",
      { ...CANONICAL, formatContractVersion: "f60.7-two-format-v2" },
      "unsupported_version",
    ],
    [
      "versão de origem desconhecida",
      { ...CANONICAL, generationContractVersion: "f60.7-two-format-v2" },
      "unsupported_version",
    ],
    [
      "origem individual",
      { ...CANONICAL, generationOrigin: "9_16_two_stage" },
      "unsupported_origin",
    ],
    ["objeto vazio", {}, "unsupported_format"],
    ["não-objeto", "1:1+9:16", "malformed"],
    ["array", [], "malformed"],
    ["null", null, "malformed"],
  ];

  it.each(INVALID_REASONS)(
    "mapeia %s para motivo tipado",
    (_label, body, reason) => {
      const result = parseTwoFormatDeclaration(body);

      expect(result).toEqual({ kind: "invalid", reason });
    },
  );

  it("nunca lança para entradas hostis", () => {
    for (const value of [undefined, 0, true, Symbol("s"), () => undefined]) {
      expect(() => parseTwoFormatDeclaration(value)).not.toThrow();
    }
  });
});

describe("C1 — schema de produção do fluxo novo", () => {
  it("aceita o valor conjunto exato; a validação de contrato é da rota", () => {
    expect(
      NewFlowGenerateImageRequestSchema.safeParse({
        ...VALID_NEW_FLOW_BODY,
        campaignFormat: TWO_FORMAT_CAMPAIGN_FORMAT,
      }).success,
    ).toBe(true);
  });

  it("o fluxo novo continua aceitando 9:16 e 1:1 individuais", () => {
    expect(
      NewFlowGenerateImageRequestSchema.safeParse({
        ...VALID_NEW_FLOW_BODY,
        campaignFormat: "9:16",
      }).success,
    ).toBe(true);
    expect(
      NewFlowGenerateImageRequestSchema.safeParse({
        ...VALID_NEW_FLOW_BODY,
        campaignFormat: "1:1",
      }).success,
    ).toBe(true);
    expect(
      NewFlowGenerateImageRequestSchema.safeParse(VALID_NEW_FLOW_BODY).success,
    ).toBe(true);
  });

  it("o schema legado continua recusando campaignFormat", () => {
    expect(
      GenerateImageRequestSchema.safeParse({
        storeId: VALID_NEW_FLOW_BODY.storeId,
        productName: VALID_NEW_FLOW_BODY.productName,
        campaignFormat: "1:1",
      }).success,
    ).toBe(false);
    expect(
      GenerateImageRequestSchema.safeParse({
        storeId: VALID_NEW_FLOW_BODY.storeId,
        productName: VALID_NEW_FLOW_BODY.productName,
      }).success,
    ).toBe(true);
  });
});
