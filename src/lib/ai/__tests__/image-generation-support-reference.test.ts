import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PUBLIC_GENERATION_FAILURE_CODE,
  buildPublicGenerationFailure,
  generateSupportReference,
  isSupportReference,
  sanitizeDiagnosisText,
  type ImageGenerationDiagnosisInput,
} from "../image-generation-support-reference";
import { SupabaseImageGenerationDiagnosisRepository } from "../image-generation-diagnosis-repository";

/** UUID v4 no formato canônico (a referência opaca de atendimento, D-18). */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Termos proibidos na mensagem pública (D-19): não revelar o motivo interno. */
const FORBIDDEN_PUBLIC_TERMS = [
  "quota",
  "saldo",
  "faturamento",
  "billing",
  "auth",
  "autentic",
  "rate limit",
  "rate_limit",
  "chave",
  "api key",
  "apikey",
  "http://",
  "https://",
  "stack",
  "traceback",
] as const;

function baseDiagnosis(overrides: Partial<ImageGenerationDiagnosisInput> = {}): ImageGenerationDiagnosisInput {
  return {
    internalCategory: "provider_error",
    model: "gpt-image-2.5-sunburst",
    quality: "medium",
    target: "primary",
    attemptNumber: 1,
    normalizedError: "upstream timeout while contacting the image provider",
    ...overrides,
  };
}

/** Cliente Supabase falso (mapa em memória) — apenas para o mapeamento/sanitização. */
function createFakeSupabase() {
  const rows: Array<Record<string, unknown>> = [];
  const client = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (table !== "image_generation_failure_diagnoses") {
          throw new Error(`tabela inesperada: ${table}`);
        }
        rows.push(row);
        return { error: null };
      },
      select: () => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: async () => ({
            data: rows.find((row) => row.reference === value) ?? null,
            error: null,
          }),
        }),
      }),
    }),
  };
  return { client: client as unknown as SupabaseClient, rows };
}

describe("image-generation-support-reference — resposta pública IMG-001 + UUID v4 (F56.1 D-18)", () => {
  it("usa o código público estável IMG-001", () => {
    expect(PUBLIC_GENERATION_FAILURE_CODE).toBe("IMG-001");
  });

  it("gera referência opaca em UUID v4 e mensagem PT-BR genérica", () => {
    const failure = buildPublicGenerationFailure(baseDiagnosis());

    expect(failure.code).toBe("IMG-001");
    expect(failure.reference).toMatch(UUID_V4);
    expect(isSupportReference(failure.reference)).toBe(true);
    expect(failure.message).toContain("IMG-001");
    expect(failure.message.length).toBeGreaterThan(0);
  });

  it("reutiliza a referência informada quando presente", () => {
    const provided = generateSupportReference();
    const failure = buildPublicGenerationFailure(baseDiagnosis({ reference: provided }));

    expect(failure.reference).toBe(provided);
  });

  it("gera referências únicas por ocorrência", () => {
    const a = buildPublicGenerationFailure(baseDiagnosis());
    const b = buildPublicGenerationFailure(baseDiagnosis());

    expect(a.reference).not.toBe(b.reference);
    expect(generateSupportReference()).not.toBe(generateSupportReference());
  });

  it("congela o resultado público", () => {
    const failure = buildPublicGenerationFailure(baseDiagnosis());
    expect(Object.isFrozen(failure)).toBe(true);
  });

  it("não revela quota/saldo/faturamento/auth/rate limit, chave, URL ou stack", () => {
    const messageLower = buildPublicGenerationFailure(baseDiagnosis()).message.toLowerCase();

    for (const term of FORBIDDEN_PUBLIC_TERMS) {
      expect(messageLower).not.toContain(term);
    }
  });

  it("não inclui o texto cru do provider na mensagem pública", () => {
    const raw = "RAW_PROVIDER_TEXT_sk-secret123 https://internal.provider/api";
    const failure = buildPublicGenerationFailure(baseDiagnosis({ normalizedError: raw }));

    expect(failure.message).not.toContain("RAW_PROVIDER_TEXT");
    expect(failure.message).not.toContain("secret123");
    expect(failure.message).not.toContain("internal.provider");
  });

  it("sanitiza chave/URL/bearer de textos do diagnóstico antes de persistir (D-19)", () => {
    const sanitized = sanitizeDiagnosisText(
      "Bearer abc.def.ghi failed via sk-abcd1234efgh5678 at https://api.openai.com/v1/images",
    );

    expect(sanitized).not.toContain("sk-abcd1234efgh5678");
    expect(sanitized).not.toContain("https://api.openai.com");
    expect(sanitized).toContain("[redacted");
  });
});

describe("image-generation-support-reference — não revelação entre causas (F56.1 D-18/D-19)", () => {
  const CAUSES = ["quota", "billing", "auth", "rate_limit"] as const;

  it("quota/faturamento/auth/rate limit compartilham o mesmo código e a mesma mensagem públicas", () => {
    const results = CAUSES.map((internalCategory) =>
      buildPublicGenerationFailure(baseDiagnosis({ internalCategory })),
    );

    for (const result of results) {
      expect(result.code).toBe(PUBLIC_GENERATION_FAILURE_CODE);
      expect(result.message).toBe(results[0].message);
    }
  });

  it("a mensagem pública não contém os termos proibidos para nenhuma causa", () => {
    for (const internalCategory of CAUSES) {
      const messageLower = buildPublicGenerationFailure(
        baseDiagnosis({ internalCategory }),
      ).message.toLowerCase();

      for (const term of FORBIDDEN_PUBLIC_TERMS) {
        expect(messageLower).not.toContain(term);
      }
    }
  });

  it("a referência é estável quando reapresentada e única entre ocorrências", () => {
    const stable = generateSupportReference();

    expect(buildPublicGenerationFailure(baseDiagnosis({ reference: stable })).reference).toBe(stable);
    expect(buildPublicGenerationFailure(baseDiagnosis()).reference).not.toBe(
      buildPublicGenerationFailure(baseDiagnosis()).reference,
    );
  });

  it("o registro persistido não vaza motivo interno nem texto cru (mensagem/erro)", async () => {
    const { client, rows } = createFakeSupabase();
    const repository = new SupabaseImageGenerationDiagnosisRepository(client);

    await repository.recordDiagnosis(
      baseDiagnosis({
        internalCategory: "billing",
        normalizedError:
          "billing_hard_limit_reached sk-verysecret123456 https://api.stripe.com/v1/charges",
      }),
    );

    const row = rows[0];
    const persistedMessageLower = String(row.message_public).toLowerCase();
    for (const term of FORBIDDEN_PUBLIC_TERMS) {
      expect(persistedMessageLower).not.toContain(term);
    }
    expect(String(row.normalized_error)).not.toContain("sk-verysecret123456");
    expect(String(row.normalized_error)).not.toContain("api.stripe.com");
  });
});

describe("image-generation-diagnosis-repository — persistência sanitizada (F56.1 D-19)", () => {
  it("recordDiagnosis grava campos sanitizados e devolve a referência", async () => {
    const { client, rows } = createFakeSupabase();
    const repository = new SupabaseImageGenerationDiagnosisRepository(client);

    const result = await repository.recordDiagnosis(
      baseDiagnosis({
        normalizedError: "Bearer supersecret sk-abcd1234efgh5678 https://api.openai.com/v1",
      }),
    );

    expect(result.reference).toMatch(UUID_V4);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.reference).toBe(result.reference);
    expect(row.code).toBe("IMG-001");
    expect(row.internal_category).toBe("provider_error");
    expect(row.normalized_error as string).not.toContain("sk-abcd1234efgh5678");
    expect(row.normalized_error as string).not.toContain("api.openai.com");
    expect(row.message_public as string).not.toContain("sk-abcd1234efgh5678");
    expect(row.message_public as string).not.toContain("api.openai.com");
  });

  it("findByReference recupera o diagnóstico interno pela referência UUID", async () => {
    const { client } = createFakeSupabase();
    const repository = new SupabaseImageGenerationDiagnosisRepository(client);

    const { reference } = await repository.recordDiagnosis(baseDiagnosis());
    const diagnosis = await repository.findByReference(reference);

    expect(diagnosis).not.toBeNull();
    expect(diagnosis?.reference).toBe(reference);
    expect(diagnosis?.internalCategory).toBe("provider_error");
    expect(diagnosis?.model).toBe("gpt-image-2.5-sunburst");
    expect(diagnosis?.quality).toBe("medium");
    expect(diagnosis?.target).toBe("primary");
    expect(diagnosis?.attemptNumber).toBe(1);
  });

  it("findByReference devolve null quando a referência não existe", async () => {
    const { client } = createFakeSupabase();
    const repository = new SupabaseImageGenerationDiagnosisRepository(client);

    const diagnosis = await repository.findByReference(generateSupportReference());

    expect(diagnosis).toBeNull();
  });
});
