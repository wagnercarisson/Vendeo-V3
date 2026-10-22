// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockResponsesCreate, mockOpenAIConstructor } = vi.hoisted(() => ({
  mockResponsesCreate: vi.fn(),
  mockOpenAIConstructor: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function (options: unknown) {
    mockOpenAIConstructor(options);
    return { responses: { create: mockResponsesCreate } };
  }),
}));

import {
  ValidationApiKeyMissingError,
  readValidationApiKey,
} from "@/lib/ai/api-keys";
import { ResponsesAdapter } from "@/lib/ai/adapters/responses";
import { createVisualSignatureValidationGateway } from "@/lib/ai/visual-signature-validation-gateway";
import type { AiModelTarget } from "@/lib/ai/model-resolver";
import type { AiCallEnvelope, AiTelemetryContext } from "@/lib/ai/types";
import {
  VisualSignatureValidationGuardError,
  assertVisualSignatureValidationEnvironment,
  isVisualSignatureValidationOptedIn,
} from "../local-validation/guard";

const ENV_KEYS = [
  "VENDEO_VS_VALIDATION_ENABLED",
  "VENDEO_VS_VALIDATION_OPENAI_API_KEY",
  "VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "OPENAI_API_KEY",
  "VERCEL",
] as const;

function resetEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.NODE_ENV = "test";
}

function setLocalEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}): void {
  resetEnv();
  process.env.VENDEO_VS_VALIDATION_ENABLED = "1";
  process.env.VENDEO_VS_VALIDATION_OPENAI_API_KEY = "sk-dedicated-validation";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:57781";
  process.env.SUPABASE_URL = "http://127.0.0.1:57781";
  process.env.VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE = "127.0.0.1:57781";
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function guardCode(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof VisualSignatureValidationGuardError) return error.code;
    throw error;
  }
  throw new Error("esperado VisualSignatureValidationGuardError");
}

const responsesTarget: AiModelTarget = {
  provider: "openai",
  model: "gpt-5.5",
  protocol: "responses",
};

const telemetry: AiTelemetryContext = {
  operationRunId: "run-1",
  operationRunType: "visual_signature",
  traceId: "trace-1",
  storeId: "store-1",
  sink: { emit: (_envelope: AiCallEnvelope) => {} },
};

beforeEach(() => {
  resetEnv();
  vi.clearAllMocks();
  mockResponsesCreate.mockResolvedValue({
    output: [{ type: "image_generation_call", result: "BASE64IMG" }],
    output_text: "",
  });
});

afterEach(() => {
  resetEnv();
  vi.clearAllMocks();
});

describe("F47.1 — opt-in explícito", () => {
  it("só aceita exatamente '1'", () => {
    delete process.env.VENDEO_VS_VALIDATION_ENABLED;
    expect(isVisualSignatureValidationOptedIn()).toBe(false);
    process.env.VENDEO_VS_VALIDATION_ENABLED = "0";
    expect(isVisualSignatureValidationOptedIn()).toBe(false);
    process.env.VENDEO_VS_VALIDATION_ENABLED = "true";
    expect(isVisualSignatureValidationOptedIn()).toBe(false);
    process.env.VENDEO_VS_VALIDATION_ENABLED = "1";
    expect(isVisualSignatureValidationOptedIn()).toBe(true);
  });
});

describe("F47.1 — guard fail-closed", () => {
  it("opt-in desligado → disabled, sem ler provider", () => {
    setLocalEnv();
    delete process.env.VENDEO_VS_VALIDATION_ENABLED;
    expect(guardCode(() => assertVisualSignatureValidationEnvironment())).toBe(
      "visual_signature_validation_disabled",
    );
  });

  it("NODE_ENV=production → not_local", () => {
    setLocalEnv();
    process.env.NODE_ENV = "production";
    expect(guardCode(() => assertVisualSignatureValidationEnvironment())).toBe(
      "visual_signature_validation_not_local",
    );
  });

  it("VERCEL presente → not_local", () => {
    setLocalEnv({ VERCEL: "1" });
    expect(guardCode(() => assertVisualSignatureValidationEnvironment())).toBe(
      "visual_signature_validation_not_local",
    );
  });

  it("URL Supabase de produção é recusada mesmo com identidade coincidente na allowlist", () => {
    setLocalEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijkl.supabase.co",
      SUPABASE_URL: "https://abcdefghijkl.supabase.co",
      VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE: "abcdefghijkl.supabase.co",
    });
    expect(guardCode(() => assertVisualSignatureValidationEnvironment())).toBe(
      "visual_signature_validation_endpoint_not_loopback",
    );
  });

  it("host não-loopback (inclusive com porta) → endpoint_not_loopback", () => {
    setLocalEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://10.0.0.5:57781",
      SUPABASE_URL: "http://10.0.0.5:57781",
      VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE: "10.0.0.5:57781",
    });
    expect(guardCode(() => assertVisualSignatureValidationEnvironment())).toBe(
      "visual_signature_validation_endpoint_not_loopback",
    );
  });

  it("NEXT_PUBLIC e SUPABASE com origins divergentes → endpoint_not_loopback", () => {
    setLocalEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:57781",
      SUPABASE_URL: "http://localhost:57781",
    });
    expect(guardCode(() => assertVisualSignatureValidationEnvironment())).toBe(
      "visual_signature_validation_endpoint_not_loopback",
    );
  });

  it("identidade canônica divergente da allowlist → instance_mismatch", () => {
    setLocalEnv({ VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE: "127.0.0.1:99999" });
    expect(guardCode(() => assertVisualSignatureValidationEnvironment())).toBe(
      "visual_signature_validation_instance_mismatch",
    );
  });

  it("credencial dedicada ausente NÃO cai para OPENAI_API_KEY", () => {
    setLocalEnv({ OPENAI_API_KEY: "sk-production-must-not-be-used" });
    delete process.env.VENDEO_VS_VALIDATION_OPENAI_API_KEY;
    expect(guardCode(() => assertVisualSignatureValidationEnvironment())).toBe(
      "visual_signature_validation_provider_key_missing",
    );
  });

  it("ambiente local válido retorna objeto congelado com identidade/origin/chave", () => {
    setLocalEnv();
    const env = assertVisualSignatureValidationEnvironment();
    expect(env).toEqual({
      instanceIdentity: "127.0.0.1:57781",
      supabaseOrigin: "http://127.0.0.1:57781",
      apiKey: "sk-dedicated-validation",
    });
    expect(Object.isFrozen(env)).toBe(true);
  });
});

describe("F47.1 — credencial dedicada", () => {
  it("readValidationApiKey lê somente a env dedicada", () => {
    setLocalEnv();
    expect(readValidationApiKey("openai")).toBe("sk-dedicated-validation");
  });

  it("readValidationApiKey sem dedicada lança erro tipado, mesmo com OPENAI_API_KEY", () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-production-must-not-be-used";
    expect(() => readValidationApiKey("openai")).toThrow(ValidationApiKeyMissingError);
    try {
      readValidationApiKey("openai");
    } catch (error) {
      expect((error as ValidationApiKeyMissingError).code).toBe(
        "visual_signature_validation_provider_key_missing",
      );
    }
  });
});

describe("F47.1 — adapter Responses com resolvedor/retry injetáveis", () => {
  it("default continua usando getApiKey e sem maxRetries explícito", async () => {
    resetEnv();
    process.env.OPENAI_API_KEY = "sk-production-default";
    await new ResponsesAdapter().invoke({ prompt: "oi" }, responsesTarget);

    expect(mockOpenAIConstructor).toHaveBeenCalledTimes(1);
    const options = mockOpenAIConstructor.mock.calls[0][0] as Record<string, unknown>;
    expect(options.apiKey).toBe("sk-production-default");
    expect(options.maxRetries).toBeUndefined();
  });

  it("adapter de validação usa credencial dedicada e maxRetries=0 observável", async () => {
    setLocalEnv();
    await new ResponsesAdapter(readValidationApiKey, { maxRetries: 0 }).invoke(
      { prompt: "oi" },
      responsesTarget,
    );

    const options = mockOpenAIConstructor.mock.calls[0][0] as Record<string, unknown>;
    expect(options.apiKey).toBe("sk-dedicated-validation");
    expect(options.maxRetries).toBe(0);
  });
});

describe("F47.1 — gateway de validação restrito a responses", () => {
  it("protocolo não-responses é recusado antes do provider", async () => {
    setLocalEnv();
    const gateway = createVisualSignatureValidationGateway({
      resolve: async () => ({
        capability: "campaign_copy",
        segment: "text",
        primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
      }),
      listCapabilities: () => ["campaign_copy"],
    });

    await expect(
      gateway.invoke("campaign_copy", { prompt: "oi" }, telemetry),
    ).rejects.toMatchObject({ kind: "capability" });
    expect(mockResponsesCreate).not.toHaveBeenCalled();
  });

  it("responses usa a credencial dedicada", async () => {
    setLocalEnv();
    const gateway = createVisualSignatureValidationGateway({
      resolve: async () => ({
        capability: "visual_signature_image",
        segment: "image",
        primary: responsesTarget,
      }),
      listCapabilities: () => ["visual_signature_image"],
    });

    await gateway.invoke(
      "visual_signature_image",
      { prompt: "oi", tools: "image_generation", size: "1024x1024", quality: "auto" },
      telemetry,
    );

    const options = mockOpenAIConstructor.mock.calls[0][0] as Record<string, unknown>;
    expect(options.apiKey).toBe("sk-dedicated-validation");
    expect(options.maxRetries).toBe(0);
  });
});
