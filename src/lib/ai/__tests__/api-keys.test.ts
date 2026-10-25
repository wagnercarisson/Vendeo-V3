import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getApiKey } from "../api-keys";
import type { AiProvider } from "../model-resolver";

describe("getApiKey — resolução de chave por provider (F46 / D5)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("openai → OPENAI_API_KEY", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-test");
    expect(getApiKey("openai")).toBe("sk-openai-test");
  });

  it("gemini → GEMINI_API_KEY", () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    expect(getApiKey("gemini")).toBe("gemini-test-key");
  });

  it("não lê a chave do outro provider", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-openai-only");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getApiKey("gemini")).toBe("");
    expect(getApiKey("openai")).toBe("sk-openai-only");
  });

  it("provider desconhecido lança erro explícito", () => {
    expect(() => getApiKey("anthropic" as AiProvider)).toThrow(/provider desconhecido/);
  });

  it("produção sem chave lança erro de configuração (fail-fast, sem fallback silencioso)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => getApiKey("openai")).toThrow(/OPENAI_API_KEY não configurada/);
  });

  it("produção sem chave do gemini lança erro de configuração", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(() => getApiKey("gemini")).toThrow(/GEMINI_API_KEY não configurada/);
  });

  it("produção COM chave retorna a chave (não lança)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "sk-prod");
    expect(getApiKey("openai")).toBe("sk-prod");
  });

  it("dev/teste sem chave retorna \"\" (tipo string; nunca undefined)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPENAI_API_KEY", "");
    const key = getApiKey("openai");
    expect(key).toBe("");
    expect(typeof key).toBe("string");
  });
});
