// @vitest-environment node
// F47.3 — resolução da configuração dedicada da Assinatura Visual
// (visual_signature_model_config). Nenhum banco/rede real: o client é um fake
// do query builder e o módulo `@/lib/supabase/server` é mockado vazio.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  deriveVisualSignaturePreset,
  resolveVisualSignatureGenerationConfig,
  VisualSignatureModelConfigError,
  VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
  VISUAL_SIGNATURE_MODEL_CONFIG_READ_FAILED,
} from "../model-config";

const SELECTED_COLUMNS =
  "orchestrator_model,image_model,image_quality,image_preset,config_version_id";

const CONFIG_VERSION_ID = "11111111-1111-4111-8111-111111111111";

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    orchestrator_model: "gpt-6-luna",
    image_model: "gpt-image-2.5-sunburst",
    image_quality: "medium",
    image_preset: "sunburst_medium",
    config_version_id: CONFIG_VERSION_ID,
    ...overrides,
  };
}

function fakeClient(
  options: { row?: Record<string, unknown> | null; error?: { message: string } | null } = {},
) {
  const maybeSingle = vi.fn(async () => ({
    data: options.row ?? null,
    error: options.error ?? null,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, from, select, eq, maybeSingle };
}

describe("deriveVisualSignaturePreset — tabela fechada de presets", () => {
  it("mapeia as quatro combinações válidas", () => {
    expect(deriveVisualSignaturePreset("gpt-image-2.5-flare", "low")).toBe("flare_low");
    expect(deriveVisualSignaturePreset("gpt-image-2.5-flare", "medium")).toBe("flare_medium");
    expect(deriveVisualSignaturePreset("gpt-image-2.5-sunburst", "low")).toBe("sunburst_low");
    expect(deriveVisualSignaturePreset("gpt-image-2.5-sunburst", "medium")).toBe(
      "sunburst_medium",
    );
  });

  it.each([
    ["gpt-image-2.5-flare", "high"],
    ["gpt-image-2", "low"],
  ])("par inválido (%s, %s) lança invalid", (model, quality) => {
    expect(() => deriveVisualSignaturePreset(model, quality)).toThrowError(
      VisualSignatureModelConfigError,
    );
    try {
      deriveVisualSignaturePreset(model, quality);
    } catch (err) {
      expect((err as VisualSignatureModelConfigError).code).toBe(
        VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
      );
      expect((err as Error).message).toBe(
        `${VISUAL_SIGNATURE_MODEL_CONFIG_INVALID}:invalid_preset_tuple`,
      );
    }
  });
});

describe("resolveVisualSignatureGenerationConfig — leitura única e validação fechada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lê a tabela/escopo/colunas corretos com exatamente um maybeSingle", async () => {
    const fake = fakeClient({ row: validRow() });

    await resolveVisualSignatureGenerationConfig(fake.client as never);

    expect(fake.from).toHaveBeenCalledWith("visual_signature_model_config");
    expect(fake.select).toHaveBeenCalledWith(SELECTED_COLUMNS);
    expect(fake.eq).toHaveBeenCalledWith("scope", "visual_signature");
    expect(fake.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["gpt-image-2.5-flare", "low", "flare_low"],
    ["gpt-image-2.5-flare", "medium", "flare_medium"],
    ["gpt-image-2.5-sunburst", "low", "sunburst_low"],
    ["gpt-image-2.5-sunburst", "medium", "sunburst_medium"],
  ])(
    "linha válida (%s, %s) → dedicated com preset %s e camelCase completo",
    async (imageModel, imageQuality, imagePreset) => {
      const fake = fakeClient({
        row: validRow({
          orchestrator_model: "gpt-5.5",
          image_model: imageModel,
          image_quality: imageQuality,
          image_preset: imagePreset,
        }),
      });

      const resolution = await resolveVisualSignatureGenerationConfig(fake.client as never);

      expect(resolution).toEqual({
        source: "dedicated",
        config: {
          orchestratorModel: "gpt-5.5",
          imageModel,
          imageQuality,
          imagePreset,
          configVersionId: CONFIG_VERSION_ID,
        },
      });
    },
  );

  it("ausência de linha (data null, error null) → legacy explícito", async () => {
    const fake = fakeClient({ row: null });

    const resolution = await resolveVisualSignatureGenerationConfig(fake.client as never);

    expect(resolution).toEqual({ source: "legacy", config: null });
  });

  it("erro de leitura → read_failed (nunca legacy silencioso)", async () => {
    const fake = fakeClient({ error: { message: "connection refused" } });

    await expect(
      resolveVisualSignatureGenerationConfig(fake.client as never),
    ).rejects.toMatchObject({ code: VISUAL_SIGNATURE_MODEL_CONFIG_READ_FAILED });
  });

  it("orquestrador fora da lista → invalid", async () => {
    const fake = fakeClient({ row: validRow({ orchestrator_model: "gpt-4o" }) });

    await expect(
      resolveVisualSignatureGenerationConfig(fake.client as never),
    ).rejects.toMatchObject({ code: VISUAL_SIGNATURE_MODEL_CONFIG_INVALID });
  });

  it("image_model fora da lista → invalid", async () => {
    const fake = fakeClient({ row: validRow({ image_model: "gpt-image-2" }) });

    await expect(
      resolveVisualSignatureGenerationConfig(fake.client as never),
    ).rejects.toMatchObject({ code: VISUAL_SIGNATURE_MODEL_CONFIG_INVALID });
  });

  it("image_quality fora da lista → invalid", async () => {
    const fake = fakeClient({ row: validRow({ image_quality: "high" }) });

    await expect(
      resolveVisualSignatureGenerationConfig(fake.client as never),
    ).rejects.toMatchObject({ code: VISUAL_SIGNATURE_MODEL_CONFIG_INVALID });
  });

  it("image_preset incoerente com o par → invalid (sem correção silenciosa)", async () => {
    const fake = fakeClient({ row: validRow({ image_preset: "flare_low" }) });

    const error = await resolveVisualSignatureGenerationConfig(fake.client as never).catch(
      (err) => err,
    );

    expect(error).toBeInstanceOf(VisualSignatureModelConfigError);
    expect(error.code).toBe(VISUAL_SIGNATURE_MODEL_CONFIG_INVALID);
    expect(error.message).toBe(`${VISUAL_SIGNATURE_MODEL_CONFIG_INVALID}:image_preset`);
  });

  it("image_preset ausente → invalid", async () => {
    const fake = fakeClient({ row: validRow({ image_preset: null }) });

    await expect(
      resolveVisualSignatureGenerationConfig(fake.client as never),
    ).rejects.toMatchObject({ code: VISUAL_SIGNATURE_MODEL_CONFIG_INVALID });
  });

  it.each([[null], [""], ["   "]])(
    "config_version_id ausente/vazio (%s) → invalid",
    async (configVersionId) => {
      const fake = fakeClient({ row: validRow({ config_version_id: configVersionId }) });

      await expect(
        resolveVisualSignatureGenerationConfig(fake.client as never),
      ).rejects.toMatchObject({ code: VISUAL_SIGNATURE_MODEL_CONFIG_INVALID });
    },
  );
});
