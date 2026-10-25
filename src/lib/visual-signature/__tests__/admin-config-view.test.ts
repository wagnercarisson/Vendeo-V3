// @vitest-environment node
// F47.3-lh9 — view administrativa discriminada da configuração dedicada.
// Prova dedicated/legacy/error, "nunca legacy em erro" e ausência de cache.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  buildVisualSignatureAdminConfigView,
  toVisualSignatureAdminConfigView,
} from "../admin-config-view";
import {
  VisualSignatureModelConfigError,
  VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
  VISUAL_SIGNATURE_MODEL_CONFIG_READ_FAILED,
  type VisualSignatureGenerationConfig,
} from "../model-config";

const CONFIG: VisualSignatureGenerationConfig = {
  orchestratorModel: "gpt-6-luna",
  imageModel: "gpt-image-2.5-sunburst",
  imageQuality: "medium",
  imagePreset: "sunburst_medium",
  configVersionId: "11111111-1111-4111-8111-111111111111",
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe("toVisualSignatureAdminConfigView", () => {
  it("mapeia dedicated para o config", () => {
    expect(toVisualSignatureAdminConfigView({ source: "dedicated", config: CONFIG })).toEqual({
      status: "dedicated",
      config: CONFIG,
    });
  });

  it("mapeia legacy confirmado", () => {
    expect(toVisualSignatureAdminConfigView({ source: "legacy", config: null })).toEqual({
      status: "legacy",
    });
  });
});

describe("buildVisualSignatureAdminConfigView", () => {
  it("dedicated do resolver passa adiante", async () => {
    const resolver = vi.fn().mockResolvedValue({ source: "dedicated", config: CONFIG });
    await expect(buildVisualSignatureAdminConfigView(resolver)).resolves.toEqual({
      status: "dedicated",
      config: CONFIG,
    });
  });

  it("legacy confirmado do resolver passa adiante", async () => {
    const resolver = vi.fn().mockResolvedValue({ source: "legacy", config: null });
    await expect(buildVisualSignatureAdminConfigView(resolver)).resolves.toEqual({
      status: "legacy",
    });
  });

  it("read_failed do resolver vira error/read_failed e NUNCA legacy", async () => {
    const resolver = vi
      .fn()
      .mockRejectedValue(new VisualSignatureModelConfigError(VISUAL_SIGNATURE_MODEL_CONFIG_READ_FAILED));
    const view = await buildVisualSignatureAdminConfigView(resolver);
    expect(view).toEqual({ status: "error", code: "read_failed" });
    expect(view.status).not.toBe("legacy");
  });

  it("invalid do resolver vira error/invalid", async () => {
    const resolver = vi
      .fn()
      .mockRejectedValue(new VisualSignatureModelConfigError(VISUAL_SIGNATURE_MODEL_CONFIG_INVALID, "image_model"));
    await expect(buildVisualSignatureAdminConfigView(resolver)).resolves.toEqual({
      status: "error",
      code: "invalid",
    });
  });

  it("erro genérico vira error/read_failed", async () => {
    const resolver = vi.fn().mockRejectedValue(new Error("connection reset"));
    const view = await buildVisualSignatureAdminConfigView(resolver);
    expect(view).toEqual({ status: "error", code: "read_failed" });
  });

  it("não faz cache: duas chamadas executam o resolver duas vezes", async () => {
    const resolver = vi.fn().mockResolvedValue({ source: "legacy", config: null });
    await buildVisualSignatureAdminConfigView(resolver);
    await buildVisualSignatureAdminConfigView(resolver);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("log de erro recebe apenas { code }, sem mensagem crua ou URL", async () => {
    const resolver = vi
      .fn()
      .mockRejectedValue(new Error("https://secret.supabase.co connection reset"));
    await buildVisualSignatureAdminConfigView(resolver);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[visual-signature-admin-config-view]",
      { code: "read_failed" },
    );
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain("secret.supabase.co");
  });
});
