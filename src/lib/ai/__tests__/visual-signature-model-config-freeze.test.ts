// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  VisualSignatureConfigDivergentError,
  VisualSignatureConfigOutsideEnvironmentError,
  VisualSignatureConfigReadError,
  loadVisualSignatureModelConfigSnapshot,
  resolveVisualSignatureModelConfigDiagnostic,
  type VisualSignatureModelConfigRow,
  type VisualSignatureModelConfigReader,
} from "../visual-signature-model-config-service";
import { createFrozenVisualSignatureResolver } from "../visual-signature-frozen-resolver";
import { AiGateway } from "../gateway";
import type { AiAdapter, AiInvocationResult, AiModelConfig, AiModelResolver } from "../types";

const ENVIRONMENT = {
  instanceIdentity: "127.0.0.1:57781",
  supabaseOrigin: "http://127.0.0.1:57781",
  apiKey: "sk-dedicated",
};

function makeRow(overrides: Partial<VisualSignatureModelConfigRow> = {}): VisualSignatureModelConfigRow {
  return {
    scope: "visual_signature",
    environment_scope: "local_validation",
    instance_identity: ENVIRONMENT.instanceIdentity,
    orchestrator_model: "gpt-6-luna",
    image_preset: "sunburst_medium",
    image_model: "gpt-image-2.5-sunburst",
    image_quality: "medium",
    reasoning_effort: "low",
    config_version_id: "11111111-1111-1111-1111-111111111111",
    ...overrides,
  };
}

function load(reader: VisualSignatureModelConfigReader, isOptedIn = true) {
  return loadVisualSignatureModelConfigSnapshot({
    reader,
    isOptedIn: () => isOptedIn,
    assertEnvironment: () => ENVIRONMENT,
  });
}

describe("F47.1 — snapshot congelado por operação", () => {
  it("opt-in desligado retorna legacy sem consultar a tabela", async () => {
    const reader = { read: vi.fn() };
    const snapshot = await load(reader as never, false);
    expect(snapshot).toEqual({ mode: "legacy" });
    expect(reader.read).not.toHaveBeenCalled();
  });

  it("ausência confirmada (sem linha) retorna legacy", async () => {
    const snapshot = await load({ read: async () => null });
    expect(snapshot).toEqual({ mode: "legacy" });
  });

  it("linha válida produz snapshot dedicado congelado", async () => {
    const snapshot = await load({ read: async () => makeRow() });
    expect(snapshot).toMatchObject({
      mode: "dedicated",
      orchestratorModel: "gpt-6-luna",
      imagePreset: "sunburst_medium",
      imageModel: "gpt-image-2.5-sunburst",
      imageQuality: "medium",
      reasoningEffort: "low",
      configVersionId: "11111111-1111-1111-1111-111111111111",
      instanceIdentity: "127.0.0.1:57781",
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("falha de leitura NÃO é tratada como ausência", async () => {
    const promise = load({
      read: async () => {
        throw new Error("db down");
      },
    });
    await expect(promise).rejects.toBeInstanceOf(VisualSignatureConfigReadError);
    await expect(promise).rejects.toMatchObject({
      code: "visual_signature_model_config_read_failed",
    });
  });

  it("linha divergente falha com erro tipado distinto", async () => {
    const promise = load({
      read: async () => makeRow({ image_preset: "image-2-low", image_model: "gpt-image-2-low" }),
    });
    await expect(promise).rejects.toBeInstanceOf(VisualSignatureConfigDivergentError);
    await expect(promise).rejects.toMatchObject({
      code: "visual_signature_model_config_divergent",
    });
  });

  it("reasoning diferente de low também é divergência", async () => {
    await expect(load({ read: async () => makeRow({ reasoning_effort: "medium" }) })).rejects.toMatchObject(
      { code: "visual_signature_model_config_divergent", detail: "invalid_reasoning" },
    );
  });

  it("linha de outro ambiente/identidade falha com erro próprio", async () => {
    await expect(
      load({ read: async () => makeRow({ instance_identity: "127.0.0.1:99999" }) }),
    ).rejects.toBeInstanceOf(VisualSignatureConfigOutsideEnvironmentError);
    await expect(
      load({ read: async () => makeRow({ environment_scope: "production" }) }),
    ).rejects.toMatchObject({ code: "visual_signature_config_outside_approved_environment" });
  });

  it("cada operação lê a configuração uma única vez (nova geração relê)", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(makeRow({ config_version_id: "v1" }))
      .mockResolvedValueOnce(makeRow({ config_version_id: "v2" }));
    const reader = { read };

    const first = await load(reader);
    const second = await load(reader);

    expect(read).toHaveBeenCalledTimes(2);
    expect(first.mode === "dedicated" && first.configVersionId).toBe("v1");
    expect(second.mode === "dedicated" && second.configVersionId).toBe("v2");
  });
});

describe("F47.1 — resolver congelado", () => {
  it("serve visual_signature_image do snapshot e delega as demais capacidades", async () => {
    const snapshot = await load({ read: async () => makeRow() });
    const fallbackResolver: AiModelResolver = {
      resolve: vi.fn(async (capability): Promise<AiModelConfig> => ({
        capability,
        segment: capability === "campaign_image" ? "image" : "text",
        primary: { provider: "openai", model: "fallback-model", protocol: "chat-completions" },
      })),
      listCapabilities: () => ["visual_signature_validation", "campaign_image"],
    };

    const resolver = createFrozenVisualSignatureResolver({ snapshot, fallbackResolver });

    const image = await resolver.resolve("visual_signature_image");
    expect(image.primary).toEqual({
      provider: "openai",
      model: "gpt-6-luna",
      protocol: "responses",
    });
    expect(Object.isFrozen(image)).toBe(true);
    expect(Object.isFrozen(image.primary)).toBe(true);

    const campaign = await resolver.resolve("campaign_image");
    expect(campaign.primary.model).toBe("fallback-model");
    const validation = await resolver.resolve("visual_signature_validation");
    expect(validation.primary.model).toBe("fallback-model");
    expect(fallbackResolver.resolve).toHaveBeenCalledWith("campaign_image");
    expect(fallbackResolver.resolve).toHaveBeenCalledWith("visual_signature_validation");
  });

  it("mutação administrativa entre tentativas não muda o alvo congelado", async () => {
    // Linha mutável simulando uma alteração administrativa depois da leitura.
    const row = makeRow();
    const snapshot = await load({ read: async () => ({ ...row }) });

    row.orchestrator_model = "gpt-5.5";
    row.image_preset = "flare_low";
    row.image_model = "gpt-image-2.5-flare";
    row.image_quality = "low";

    const resolver = createFrozenVisualSignatureResolver({
      snapshot,
      fallbackResolver: {
        resolve: async (capability) => ({
          capability,
          segment: "text",
          primary: { provider: "openai", model: "x", protocol: "chat-completions" },
        }),
        listCapabilities: () => [],
      },
    });

    const attempt1 = await resolver.resolve("visual_signature_image");
    const retry = await resolver.resolve("visual_signature_image");
    expect(attempt1.primary.model).toBe("gpt-6-luna");
    expect(retry.primary.model).toBe("gpt-6-luna");
    expect(attempt1.primary).toBe(retry.primary);
  });

  it("gateway com adapter fake prova alvo congelado sem chamada paga", async () => {
    const snapshot = await load({ read: async () => makeRow() });
    const resolve = vi.fn(async (capability) => ({
      capability,
      segment: "image" as const,
      primary: { provider: "openai" as const, model: "gpt-6-luna", protocol: "responses" as const },
    }));
    const resolver = createFrozenVisualSignatureResolver({
      snapshot,
      fallbackResolver: { resolve, listCapabilities: () => [] },
    });

    const invoke = vi.fn(async (): Promise<AiInvocationResult> => ({ model: "gpt-6-luna", imageBase64: "x" }));
    const adapter: AiAdapter = { protocol: "responses", invoke };
    const gateway = new AiGateway(resolver, { get: () => adapter });
    const sink = { emit: vi.fn() };
    const telemetry = {
      operationRunId: "run-1",
      operationRunType: "visual_signature" as const,
      traceId: "trace-1",
      storeId: "store-1",
      sink,
    };

    await gateway.invoke("visual_signature_image", { prompt: "arte" }, telemetry);
    await gateway.invoke("visual_signature_image", { prompt: "arte" }, telemetry);

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(sink.emit).toHaveBeenCalledTimes(2);
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("F47.1 — diagnóstico usa as mesmas regras do runtime", () => {
  function diagnose(options: {
    reader?: VisualSignatureModelConfigReader;
    isOptedIn?: boolean;
    assertEnvironment?: () => typeof ENVIRONMENT;
  }) {
    return resolveVisualSignatureModelConfigDiagnostic({
      reader: options.reader,
      isOptedIn: () => options.isOptedIn ?? true,
      assertEnvironment: options.assertEnvironment ?? (() => ENVIRONMENT),
    });
  }

  it("opt-in desligado → inherited/opt_in_disabled sem ler a tabela", async () => {
    const reader = { read: vi.fn() };
    const diagnostic = await diagnose({ reader: reader as never, isOptedIn: false });

    expect(diagnostic).toEqual({ status: "inherited", reason: "opt_in_disabled" });
    expect(reader.read).not.toHaveBeenCalled();
  });

  it("guard inválido → blocked/guard com e sem linha, sem ler a tabela", async () => {
    const reader = { read: vi.fn() };
    const diagnostic = await diagnose({
      reader: reader as never,
      assertEnvironment: () => {
        throw new Error("guard failed");
      },
    });

    expect(diagnostic.status).toBe("blocked");
    if (diagnostic.status === "blocked") {
      expect(diagnostic.reason).toBe("guard");
    }
    expect(reader.read).not.toHaveBeenCalled();
  });

  it("guard válido + ausência confirmada → inherited/absent", async () => {
    const diagnostic = await diagnose({ reader: { read: async () => null } });
    expect(diagnostic).toEqual({ status: "inherited", reason: "absent" });
  });

  it("guard válido + tuple válida → dedicated", async () => {
    const diagnostic = await diagnose({ reader: { read: async () => makeRow() } });
    expect(diagnostic.status).toBe("dedicated");
  });

  it("identidade divergente → blocked/identity", async () => {
    const diagnostic = await diagnose({
      reader: { read: async () => makeRow({ instance_identity: "127.0.0.1:9999" }) },
    });
    expect(diagnostic.status).toBe("blocked");
    if (diagnostic.status === "blocked") {
      expect(diagnostic.reason).toBe("identity");
      expect(diagnostic.code).toBe("visual_signature_config_outside_approved_environment");
    }
  });

  it("tuple inválida → blocked/tuple com código seguro", async () => {
    const diagnostic = await diagnose({
      reader: { read: async () => makeRow({ image_preset: "image-2-low" }) },
    });
    expect(diagnostic.status).toBe("blocked");
    if (diagnostic.status === "blocked") {
      expect(diagnostic.reason).toBe("tuple");
      expect(diagnostic.code).toBe("invalid_preset");
    }
  });

  it("falha de leitura → blocked/read_failure, nunca inherited/absent", async () => {
    const diagnostic = await diagnose({
      reader: {
        read: async () => {
          throw new Error("db down");
        },
      },
    });
    expect(diagnostic.status).toBe("blocked");
    if (diagnostic.status === "blocked") {
      expect(diagnostic.reason).toBe("read_failure");
      expect(diagnostic.code).toBe("visual_signature_model_config_read_failed");
    }
  });
});
