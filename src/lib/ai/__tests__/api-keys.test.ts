import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OperationalApiKeyMissingError,
  ValidationApiKeyMissingError,
  readOperationalApiKey,
  readValidationApiKey,
  readVisualSignatureApiKey,
} from "../api-keys";

describe("F47.2 — credenciais compartilhada de produção e dedicada de validação", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("local usa a credencial de validação", () => {
    vi.stubEnv("VENDEO_VS_VALIDATION_OPENAI_API_KEY", "sk-local");
    vi.stubEnv("OPENAI_API_KEY", "sk-prod");
    expect(readVisualSignatureApiKey("openai", "local_validation")).toBe("sk-local");
    expect(readValidationApiKey("openai")).toBe("sk-local");
  });

  it("produção usa a chave compartilhada", () => {
    vi.stubEnv("VENDEO_VS_VALIDATION_OPENAI_API_KEY", "sk-local");
    vi.stubEnv("OPENAI_API_KEY", "sk-prod");
    expect(readVisualSignatureApiKey("openai", "production")).toBe("sk-prod");
    expect(readOperationalApiKey("openai")).toBe("sk-prod");
  });

  it("validação não cai para OPENAI_API_KEY", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-normal");
    vi.stubEnv("VENDEO_VS_VALIDATION_OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => readVisualSignatureApiKey("openai", "local_validation")).toThrow(
      ValidationApiKeyMissingError,
    );
    expect(() => readVisualSignatureApiKey("openai", "production")).toThrow(
      OperationalApiKeyMissingError,
    );
  });

  it("produção sem chave compartilhada falha fechado mesmo fora NODE_ENV production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => readVisualSignatureApiKey("openai", "production")).toThrow(OperationalApiKeyMissingError);
  });
});
