// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ROLE_POLICY } from "@/lib/campaign/composition-artifacts/role-policy";
import { PROVIDER_SIZE } from "@/lib/product-vertical-9-16/dimensions";

import {
  DESTINATION_ROLE,
  EXPANSION_CAPABILITY,
  EXPANSION_FORBIDDEN_KEYS,
  EXPANSION_ORIGIN,
  EXPANSION_PROMPT_VERSION,
  EXPANSION_PROTOCOL,
  EXPANSION_PROVIDER,
  EXPANSION_QUALITY,
  EXPANSION_SOURCE,
  EXPANSION_STAGE,
  EXPANSION_TARGET,
  EXPANSION_TIMEOUT_MS,
  EXPECTED_MODEL,
  SOURCE_ROLE,
  effectiveTimeout,
  parseExpandVerticalInput,
} from "../policy";

const STORE_ID = "1A2B3C4D-1A2B-4C3D-8E4F-1A2B3C4D5E6F";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const DEST_OPERATION_ID = "4D5E6F7A-4D5E-4F6A-8B8C-4D5E6F7A8B9C";

/** Entrada mínima válida: só identidade, operação, tentativa, autorização e timeout. */
function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: SOURCE_OPERATION_ID,
      role: "square_prepared",
    },
    operationId: DEST_OPERATION_ID,
    attempt: { number: 1, reference: "attempt-ref-1" },
    authorization: { kind: "system" },
    ...overrides,
  };
}

/**
 * Matriz fechada das 16 chaves proibidas (T-60.3-01). Cada chave é testada
 * isoladamente com valor `undefined`, provando a recusa por `hasOwnProperty`
 * (a presença da chave já é suficiente para recusar).
 */
const FORBIDDEN_MATRIX = [
  ["storagePath", "path_not_accepted"],
  ["path", "path_not_accepted"],
  ["bucket", "path_not_accepted"],
  ["storageBucket", "path_not_accepted"],
  ["url", "url_not_accepted"],
  ["publicUrl", "url_not_accepted"],
  ["signedUrl", "url_not_accepted"],
  ["downloadUrl", "url_not_accepted"],
  ["bytes", "bytes_not_accepted"],
  ["imageBase64", "bytes_not_accepted"],
  ["model", "model_not_accepted"],
  ["modelPrimary", "model_not_accepted"],
  ["modelFallback", "model_not_accepted"],
  ["quality", "quality_not_accepted"],
  ["prompt", "prompt_not_accepted"],
  ["size", "size_not_accepted"],
] as const;

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

describe("F60.3 policy — entrada aceita", () => {
  it("aceita entrada sem path/bucket/url/bytes/modelo/qualidade/prompt/tamanho", () => {
    const parsed = parseExpandVerticalInput(validInput());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.source).toEqual({
      storeId: STORE_ID.toLowerCase(),
      campaignId: CAMPAIGN_ID.toLowerCase(),
      operationId: SOURCE_OPERATION_ID.toLowerCase(),
      role: "square_prepared",
    });
    expect(parsed.input.operationId).toBe(DEST_OPERATION_ID.toLowerCase());
    expect(parsed.input.attempt).toEqual({ number: 1, reference: "attempt-ref-1" });
    expect(parsed.input.authorization).toEqual({ kind: "system" });
    expect(parsed.input.timeoutMs).toBe(EXPANSION_TIMEOUT_MS);
    expect(Object.isFrozen(parsed.input)).toBe(true);
    expect(Object.isFrozen(parsed.input.source)).toBe(true);
    expect(Object.isFrozen(parsed.input.attempt)).toBe(true);
  });

  it("aceita autorização owner resolvida no servidor", () => {
    const parsed = parseExpandVerticalInput(
      validInput({ authorization: { kind: "owner", userId: "user-owner" } }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.authorization).toEqual({ kind: "owner", userId: "user-owner" });
  });
});

describe("F60.3 policy — 16 chaves proibidas (zero I/O)", () => {
  it("expõe exatamente 16 chaves proibidas", () => {
    expect(EXPANSION_FORBIDDEN_KEYS).toHaveLength(16);
    expect([...EXPANSION_FORBIDDEN_KEYS].sort()).toEqual(
      FORBIDDEN_MATRIX.map(([key]) => key).sort(),
    );
    expect(Object.isFrozen(EXPANSION_FORBIDDEN_KEYS)).toBe(true);
  });

  it.each(FORBIDDEN_MATRIX)("recusa a chave %s com %s", (key, reason) => {
    const parsed = parseExpandVerticalInput(validInput({ [key]: undefined }));

    expect(parsed).toEqual({ ok: false, reason });
  });

  it("recusa valor preenchido na chave proibida (não normaliza silenciosamente)", () => {
    const parsed = parseExpandVerticalInput(
      validInput({ model: "gpt-image-2.5-sunburst" }),
    );

    expect(parsed).toEqual({ ok: false, reason: "model_not_accepted" });
  });

  it("recusa entrada que não é objeto", () => {
    for (const value of [null, undefined, "string", 42, true, []]) {
      expect(parseExpandVerticalInput(value)).toEqual({
        ok: false,
        reason: "input_not_object",
      });
    }
  });
});

describe("F60.3 policy — identidade, papel e tentativa", () => {
  it("recusa UUID inválido na identidade de origem", () => {
    for (const field of ["storeId", "campaignId", "operationId"] as const) {
      const input = validInput();
      const source = { ...(input.source as Record<string, unknown>), [field]: "nope" };
      expect(parseExpandVerticalInput({ ...input, source })).toEqual({
        ok: false,
        reason: "source_identity_invalid",
      });
    }
  });

  it("recusa origem ausente ou que não é objeto", () => {
    for (const source of [undefined, null, "source", 7]) {
      expect(parseExpandVerticalInput(validInput({ source }))).toEqual({
        ok: false,
        reason: "source_identity_invalid",
      });
    }
  });

  it("recusa UUID inválido na operação de destino", () => {
    expect(parseExpandVerticalInput(validInput({ operationId: "nope" }))).toEqual({
      ok: false,
      reason: "operation_id_invalid",
    });
  });

  it("recusa papel de origem diferente de square_prepared", () => {
    for (const role of ["square_original", "vertical", "other", undefined]) {
      const input = validInput();
      const source = { ...(input.source as Record<string, unknown>), role };
      expect(parseExpandVerticalInput({ ...input, source })).toEqual({
        ok: false,
        reason: "source_role_not_prepared",
      });
    }
  });

  it("recusa attempt.number não inteiro, zero, negativo ou NaN", () => {
    for (const number of [0, -1, 1.5, Number.NaN, "1", undefined]) {
      expect(parseExpandVerticalInput(validInput({ attempt: { number, reference: "r" } }))).toEqual({
        ok: false,
        reason: "attempt_number_invalid",
      });
    }
  });

  it("recusa attempt.reference vazio, não-string, com espaços nas pontas ou > 200", () => {
    for (const reference of ["", "   ", 42, undefined, " padded ", "x".repeat(201)]) {
      expect(parseExpandVerticalInput(validInput({ attempt: { number: 1, reference } }))).toEqual({
        ok: false,
        reason: "attempt_reference_invalid",
      });
    }
  });

  it("aceita attempt.reference com exatamente 200 caracteres", () => {
    const parsed = parseExpandVerticalInput(
      validInput({ attempt: { number: 1, reference: "x".repeat(200) } }),
    );
    expect(parsed.ok).toBe(true);
  });

  it("recusa autorização ausente ou inválida com authorization_missing", () => {
    for (const authorization of [undefined, null, "system", {}, { kind: "owner" }]) {
      expect(parseExpandVerticalInput(validInput({ authorization }))).toEqual({
        ok: false,
        reason: "authorization_missing",
      });
    }
  });
});

describe("F60.3 policy — timeout efetivo (contrato único: inválido => null)", () => {
  it("sem argumento devolve o padrão de 180 s", () => {
    expect(effectiveTimeout()).toBe(EXPANSION_TIMEOUT_MS);
    expect(EXPANSION_TIMEOUT_MS).toBe(180_000);
  });

  it("prazo menor do chamador prevalece", () => {
    expect(effectiveTimeout(90_000)).toBe(90_000);
    expect(effectiveTimeout(1)).toBe(1);
    expect(effectiveTimeout(EXPANSION_TIMEOUT_MS)).toBe(EXPANSION_TIMEOUT_MS);
  });

  it("nunca alonga um prazo maior que o teto", () => {
    expect(effectiveTimeout(600_000)).toBe(EXPANSION_TIMEOUT_MS);
    expect(effectiveTimeout(EXPANSION_TIMEOUT_MS + 1)).toBe(EXPANSION_TIMEOUT_MS);
  });

  it("devolve exatamente null (e só null) para prazo inválido", () => {
    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(effectiveTimeout(timeoutMs)).toBeNull();
    }
  });

  it("parse traduz prazo inválido em timeout_invalid", () => {
    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseExpandVerticalInput(validInput({ timeoutMs }))).toEqual({
        ok: false,
        reason: "timeout_invalid",
      });
    }
  });

  it("parse reverbera o timeout efetivo (menor prazo do chamador)", () => {
    const parsed = parseExpandVerticalInput(validInput({ timeoutMs: 90_000 }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.timeoutMs).toBe(90_000);
  });
});

describe("F60.3 policy — constantes derivadas (sem literais duplicados)", () => {
  it("EXPANSION_SOURCE espelha ROLE_POLICY.square_prepared", () => {
    expect(EXPANSION_SOURCE.role).toBe(SOURCE_ROLE);
    expect(EXPANSION_SOURCE.role).toBe("square_prepared");
    expect(EXPANSION_SOURCE.format).toBe(ROLE_POLICY.square_prepared.format);
    expect(EXPANSION_SOURCE.width).toBe(ROLE_POLICY.square_prepared.width);
    expect(EXPANSION_SOURCE.height).toBe(ROLE_POLICY.square_prepared.height);
    expect(EXPANSION_SOURCE.mimeType).toBe(ROLE_POLICY.square_prepared.mimeType);
    expect(EXPANSION_SOURCE.width).toBe(1152);
    expect(EXPANSION_SOURCE.height).toBe(1152);
    expect(EXPANSION_SOURCE.mimeType).toBe("image/jpeg");
  });

  it("EXPANSION_TARGET espelha ROLE_POLICY.vertical", () => {
    expect(EXPANSION_TARGET.role).toBe(DESTINATION_ROLE);
    expect(EXPANSION_TARGET.role).toBe("vertical");
    expect(EXPANSION_TARGET.format).toBe(ROLE_POLICY.vertical.format);
    expect(EXPANSION_TARGET.width).toBe(ROLE_POLICY.vertical.width);
    expect(EXPANSION_TARGET.height).toBe(ROLE_POLICY.vertical.height);
    expect(EXPANSION_TARGET.mimeType).toBe(ROLE_POLICY.vertical.mimeType);
    expect(EXPANSION_TARGET.width).toBe(1080);
    expect(EXPANSION_TARGET.height).toBe(1920);
  });

  it("PROVIDER_SIZE vem de dimensions.ts e os demais literais são fechados", () => {
    expect(PROVIDER_SIZE).toBe("1152x2048");
    expect(EXPANSION_ORIGIN).toBe("ai_expansion");
    expect(EXPANSION_QUALITY).toBe("low");
    expect(EXPANSION_STAGE).toBe("expansion");
    expect(EXPANSION_CAPABILITY).toBe("campaign_product_image");
    expect(EXPANSION_PROVIDER).toBe("openai");
    expect(EXPANSION_PROTOCOL).toBe("images");
    expect(EXPECTED_MODEL).toBe("gpt-image-2.5-sunburst");
    expect(EXPANSION_PROMPT_VERSION).toBe("f60.3-expand-9-16-v1");
    expect(Object.isFrozen(EXPANSION_SOURCE)).toBe(true);
    expect(Object.isFrozen(EXPANSION_TARGET)).toBe(true);
  });
});

describe("F60.3 policy — fronteira de módulo", () => {
  it("não importa runtime de servidor, imagem, banco, cripto ou filesystem", () => {
    for (const file of ["../types.ts", "../policy.ts"]) {
      const source = readFileSync(sourcePath(file), "utf8");
      expect(source).not.toMatch(/import\s+"server-only"/);
      expect(source).not.toMatch(/\bsharp\b/);
      expect(source).not.toMatch(/@supabase\//);
      expect(source).not.toMatch(/node:crypto/);
      expect(source).not.toMatch(/node:fs/);
    }
  });

  it("não retipar dimensões: policy.ts não contém 1152/1080/1920 como literal próprio", () => {
    const source = readFileSync(sourcePath("../policy.ts"), "utf8");
    expect(source).not.toContain("1152");
    expect(source).not.toContain("1080");
    expect(source).not.toContain("1920");
  });
});
