// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { effectiveTimeout, SQUARE_BASE_TIMEOUT_MS } from "../policy";
import { parseSquareBaseInput } from "../validation";

const STORE_ID = "1A2B3C4D-1A2B-4C3D-8E4F-1A2B3C4D5E6F";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION_ID = "4D5E6F7A-4D5E-4F6A-8B8C-4D5E6F7A8B9C";

const BRIEFING = {
  backgroundDirection: "studio",
  product: { name: "Cafeteira Italiana", description: "Aço inox" },
  commercial: {
    intent: "offer",
    originalPriceText: "R$ 299,00",
    discountedPriceText: "R$ 199,00",
    badge: "Oferta",
    validity: "até domingo",
  },
  constraints: { mandatoryArtworkText: "Frete grátis" },
};

/** Entrada mínima válida: identidade, autorização, conteúdo congelável e tentativa. */
function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    authorization: { kind: "system" },
    briefing: BRIEFING,
    briefingText: "Cafeteira por R$ 199",
    campaignIntent: "offer",
    backgroundDirection: "studio",
    productImagesDataUrls: ["data:image/png;base64,AAAA"],
    attempt: { number: 1, target: "primary", reference: "attempt-ref-1" },
    ...overrides,
  };
}

/** Matriz fechada das 26 chaves proibidas (T-60.4-02). */
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
  ["file", "bytes_not_accepted"],
  ["model", "model_not_accepted"],
  ["modelPrimary", "model_not_accepted"],
  ["modelFallback", "model_not_accepted"],
  ["modelPair", "model_not_accepted"],
  ["quality", "quality_not_accepted"],
  ["prompt", "prompt_not_accepted"],
  ["promptBase", "prompt_not_accepted"],
  ["systemPrompt", "prompt_not_accepted"],
  ["size", "size_not_accepted"],
  ["width", "size_not_accepted"],
  ["height", "size_not_accepted"],
  ["maxRetries", "retry_not_accepted"],
  ["retry", "retry_not_accepted"],
  ["retries", "retry_not_accepted"],
  ["fallback", "retry_not_accepted"],
] as const;

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

describe("F60.4 validation — entrada aceita", () => {
  it("aceita entrada sem path/bucket/url/bytes/modelo/qualidade/prompt/tamanho/retry", () => {
    const parsed = parseSquareBaseInput(validInput());

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.storeId).toBe(STORE_ID.toLowerCase());
    expect(parsed.input.campaignId).toBe(CAMPAIGN_ID.toLowerCase());
    expect(parsed.input.operationId).toBe(OPERATION_ID.toLowerCase());
    expect(parsed.input.attempt).toEqual({
      number: 1,
      target: "primary",
      reference: "attempt-ref-1",
    });
    expect(parsed.input.authorization).toEqual({ kind: "system" });
    expect(parsed.input.timeoutMs).toBe(SQUARE_BASE_TIMEOUT_MS);
    expect(parsed.input.briefing.product.name).toBe("Cafeteira Italiana");
    expect(parsed.input.campaignIntent).toBe("offer");
    expect(parsed.input.backgroundDirection).toBe("studio");
    expect(Object.isFrozen(parsed.input)).toBe(true);
    expect(Object.isFrozen(parsed.input.attempt)).toBe(true);
    expect(Object.isFrozen(parsed.input.productImagesDataUrls)).toBe(true);
  });

  it("aceita conteúdo opcional (identidade, referências, seleções, copyContext)", () => {
    const parsed = parseSquareBaseInput(
      validInput({
        identityImageUrl: "data:image/png;base64,BBBB",
        identityDirective: "  Aplique o logo no canto superior direito.  ",
        references: ["ref-a", "ref-b"],
        referenceSelections: [
          { kind: "product", id: "hash-a", index: 0 },
          { kind: "reference", id: "hash-b", index: 1 },
          { kind: "identity", id: "hash-c", index: 2 },
        ],
        copyContext: { storeName: "Loja Central", segment: "Casa" },
        attempt: { number: 2, target: "fallback", reference: "attempt-ref-2" },
        timeoutMs: 90_000,
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.input.identityImageUrl).toBe("data:image/png;base64,BBBB");
    expect(parsed.input.identityDirective).toBe(
      "Aplique o logo no canto superior direito.",
    );
    expect(parsed.input.references).toEqual(["ref-a", "ref-b"]);
    expect(parsed.input.referenceSelections).toHaveLength(3);
    expect(parsed.input.copyContext).toEqual({
      storeName: "Loja Central",
      segment: "Casa",
    });
    expect(parsed.input.attempt.target).toBe("fallback");
    expect(parsed.input.timeoutMs).toBe(90_000);
  });

  it("aceita autorização owner resolvida no servidor", () => {
    const parsed = parseSquareBaseInput(
      validInput({ authorization: { kind: "owner", userId: "user-owner" } }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.authorization).toEqual({
      kind: "owner",
      userId: "user-owner",
    });
  });
});

describe("F60.4 validation — 26 chaves proibidas e precedência (zero I/O)", () => {
  it.each(FORBIDDEN_MATRIX)("recusa a chave %s com %s (mesmo undefined)", (key, reason) => {
    const parsed = parseSquareBaseInput(validInput({ [key]: undefined }));
    expect(parsed).toEqual({ ok: false, reason });
  });

  it("recusa valor preenchido na chave proibida (não normaliza)", () => {
    for (const key of ["model", "quality", "promptBase", "size", "maxRetries"] as const) {
      const parsed = parseSquareBaseInput(validInput({ [key]: "qualquer" }));
      expect(parsed.ok).toBe(false);
    }
  });

  it("a varredura de chaves proibidas precede a validação de identidade", () => {
    const parsed = parseSquareBaseInput(
      validInput({ storeId: "uuid-invalido", promptBase: "base-do-chamador" }),
    );
    expect(parsed).toEqual({ ok: false, reason: "prompt_not_accepted" });
  });

  it("recusa entrada que não é objeto", () => {
    for (const value of [null, undefined, "string", 42, true, []]) {
      expect(parseSquareBaseInput(value)).toEqual({
        ok: false,
        reason: "input_not_object",
      });
    }
  });
});

describe("F60.4 validation — identidade e autorização", () => {
  it("recusa UUID inválido de loja, campanha e operação com motivo próprio", () => {
    expect(parseSquareBaseInput(validInput({ storeId: "nope" }))).toEqual({
      ok: false,
      reason: "store_id_invalid",
    });
    expect(parseSquareBaseInput(validInput({ campaignId: "nope" }))).toEqual({
      ok: false,
      reason: "campaign_id_invalid",
    });
    expect(parseSquareBaseInput(validInput({ operationId: "nope" }))).toEqual({
      ok: false,
      reason: "operation_id_invalid",
    });
  });

  it("recusa autorização ausente ou inválida", () => {
    for (const authorization of [undefined, null, "system", {}, { kind: "owner" }]) {
      expect(parseSquareBaseInput(validInput({ authorization }))).toEqual({
        ok: false,
        reason: "authorization_missing",
      });
    }
  });
});

describe("F60.4 validation — tentativa", () => {
  it("recusa attempt.number não inteiro, zero, negativo ou NaN", () => {
    for (const number of [0, -1, 1.5, Number.NaN, "1", undefined]) {
      expect(
        parseSquareBaseInput(
          validInput({ attempt: { number, target: "primary", reference: "r" } }),
        ),
      ).toEqual({ ok: false, reason: "attempt_number_invalid" });
    }
  });

  it("recusa target fora de primary|fallback", () => {
    for (const target of ["tertiary", "", undefined, 2]) {
      expect(
        parseSquareBaseInput(
          validInput({ attempt: { number: 1, target, reference: "r" } }),
        ),
      ).toEqual({ ok: false, reason: "attempt_target_invalid" });
    }
  });

  it("recusa reference vazio, não-string, com espaços nas pontas ou > 200", () => {
    for (const reference of ["", "   ", 42, undefined, " padded ", "x".repeat(201)]) {
      expect(
        parseSquareBaseInput(
          validInput({ attempt: { number: 1, target: "primary", reference } }),
        ),
      ).toEqual({ ok: false, reason: "attempt_reference_invalid" });
    }
  });

  it("aceita reference com exatamente 200 caracteres", () => {
    const parsed = parseSquareBaseInput(
      validInput({
        attempt: { number: 1, target: "primary", reference: "x".repeat(200) },
      }),
    );
    expect(parsed.ok).toBe(true);
  });

  it("recusa attempt ausente ou que não é objeto", () => {
    for (const attempt of [undefined, null, "attempt", 7]) {
      expect(parseSquareBaseInput(validInput({ attempt }))).toEqual({
        ok: false,
        reason: "attempt_number_invalid",
      });
    }
  });
});

describe("F60.4 validation — imagens, referências e seleções", () => {
  it("recusa zero imagens de produto, não-array ou data URL inválida", () => {
    for (const productImagesDataUrls of [
      [],
      "data:image/png;base64,AAAA",
      [""],
      ["https://example.com/a.png"],
      ["data:image/png;base64,AAAA", 42],
      undefined,
    ]) {
      expect(parseSquareBaseInput(validInput({ productImagesDataUrls }))).toEqual({
        ok: false,
        reason: "product_images_invalid",
      });
    }
  });

  it("recusa identityImageUrl que não é data:image/", () => {
    for (const identityImageUrl of ["https://example.com/logo.png", "", 42]) {
      expect(parseSquareBaseInput(validInput({ identityImageUrl }))).toEqual({
        ok: false,
        reason: "identity_image_invalid",
      });
    }
  });

  it("recusa references que não seja array de strings não vazias", () => {
    for (const references of ["ref-a", [""], [42], [null]]) {
      expect(parseSquareBaseInput(validInput({ references }))).toEqual({
        ok: false,
        reason: "references_invalid",
      });
    }
  });

  it("recusa referenceSelections com shape inválido", () => {
    for (const referenceSelections of [
      "selections",
      [{}],
      [{ kind: "other", id: "x" }],
      [{ kind: "product", id: "" }],
      [{ kind: "product", id: "x", index: -1 }],
    ]) {
      expect(parseSquareBaseInput(validInput({ referenceSelections }))).toEqual({
        ok: false,
        reason: "reference_selections_invalid",
      });
    }
  });
});

describe("F60.4 validation — briefing, intenção e direção", () => {
  it("recusa briefing ausente/não-objeto ou com product.name vazio", () => {
    for (const briefing of [
      undefined,
      null,
      "briefing",
      { ...BRIEFING, product: undefined },
      { ...BRIEFING, product: { name: "   " } },
    ]) {
      expect(parseSquareBaseInput(validInput({ briefing }))).toEqual({
        ok: false,
        reason: "briefing_invalid",
      });
    }
  });

  it("recusa briefing.commercial ausente ou sem intent", () => {
    for (const commercial of [undefined, null, {}, { intent: "invalido" }]) {
      expect(
        parseSquareBaseInput(validInput({ briefing: { ...BRIEFING, commercial } })),
      ).toEqual({ ok: false, reason: "briefing_invalid" });
    }
  });

  it("recusa briefing com direção de fundo inválida ou divergente da entrada", () => {
    expect(
      parseSquareBaseInput(
        validInput({ briefing: { ...BRIEFING, backgroundDirection: "outro" } }),
      ),
    ).toEqual({ ok: false, reason: "briefing_invalid" });

    expect(
      parseSquareBaseInput(
        validInput({ briefing: { ...BRIEFING, backgroundDirection: "ambient" } }),
      ),
    ).toEqual({ ok: false, reason: "briefing_invalid" });
  });

  it("recusa briefing com intent divergente da intenção da entrada", () => {
    expect(
      parseSquareBaseInput(
        validInput({
          briefing: {
            ...BRIEFING,
            commercial: { ...BRIEFING.commercial, intent: "spotlight" },
          },
        }),
      ),
    ).toEqual({ ok: false, reason: "briefing_invalid" });
  });

  it("recusa copyContext estruturalmente inválido", () => {
    for (const copyContext of [
      "ctx",
      {},
      { storeName: "", segment: "Casa" },
      { storeName: "Loja", segment: "" },
    ]) {
      expect(parseSquareBaseInput(validInput({ copyContext }))).toEqual({
        ok: false,
        reason: "copy_context_invalid",
      });
    }
  });

  it("recusa campaignIntent fora da lista fechada", () => {
    for (const campaignIntent of ["invalido", "", undefined]) {
      expect(parseSquareBaseInput(validInput({ campaignIntent }))).toEqual({
        ok: false,
        reason: "campaign_intent_invalid",
      });
    }
  });

  it("recusa backgroundDirection fora da lista fechada", () => {
    for (const backgroundDirection of ["invalido", "", undefined]) {
      expect(parseSquareBaseInput(validInput({ backgroundDirection }))).toEqual({
        ok: false,
        reason: "background_direction_invalid",
      });
    }
  });
});

describe("F60.4 validation — timeout", () => {
  it("traduz prazo inválido em timeout_invalid", () => {
    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseSquareBaseInput(validInput({ timeoutMs }))).toEqual({
        ok: false,
        reason: "timeout_invalid",
      });
    }
  });

  it("reverbera o timeout efetivo (menor prazo do chamador / teto)", () => {
    const short = parseSquareBaseInput(validInput({ timeoutMs: 90_000 }));
    expect(short.ok).toBe(true);
    if (short.ok) expect(short.input.timeoutMs).toBe(90_000);

    const long = parseSquareBaseInput(validInput({ timeoutMs: 600_000 }));
    expect(long.ok).toBe(true);
    if (long.ok) expect(long.input.timeoutMs).toBe(effectiveTimeout(600_000));
  });
});

describe("F60.4 validation — fronteira de módulo", () => {
  it("validation.ts é módulo puro (sem server-only/sharp/Supabase/crypto/fs)", () => {
    const source = readFileSync(sourcePath("../validation.ts"), "utf8");
    expect(source).not.toMatch(/import\s+"server-only"/);
    expect(source).not.toMatch(/\bsharp\b/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toMatch(/node:crypto/);
    expect(source).not.toMatch(/node:fs/);
  });

  it("não aceita promptBase como campo de entrada (só como chave proibida)", () => {
    const validationSource = readFileSync(sourcePath("../validation.ts"), "utf8");
    const policySource = readFileSync(sourcePath("../policy.ts"), "utf8");

    // A chave proibida vive no grupo `prompt_not_accepted`; `validation.ts` nunca
    // lê `promptBase` da entrada — só delega a varredura de `hasOwnProperty`.
    expect(policySource).toContain('"promptBase"');
    expect(validationSource).not.toMatch(/raw\.promptBase|input\.promptBase/);
  });
});
