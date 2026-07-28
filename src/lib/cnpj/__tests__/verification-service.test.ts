import { describe, it, expect, vi, beforeEach } from "vitest";
import { CnpjVerificationService, type CnpjLookupCache } from "../verification-service";
import type { CnpjLookupProvider, CnpjLookupData } from "../lookup-providers/types";

function createMockProvider(): CnpjLookupProvider {
  return { lookup: vi.fn() };
}

function createMockCache(): CnpjLookupCache {
  return {
    get: vi.fn(),
    set: vi.fn(),
  };
}

const sampleData: CnpjLookupData = {
  cnpj_normalized: "12345678000190",
  razao_social: "EMPRESA EXEMPLO LTDA",
  nome_fantasia: "Empresa Exemplo",
  situacao_cadastral: "ATIVA",
  cep: "01234567",
  logradouro: "Rua Exemplo",
  numero: "123",
  complemento: null,
  bairro: "Centro",
  cidade: "São Paulo",
  uf: "SP",
  cnae_principal: "4781-4/00",
  cnae_descricao: null,
  data_situacao: "2020-01-01",
  data_abertura: "2010-05-10",
  porte: "ME",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CnpjVerificationService", () => {
  it("returns cached data when cache hit with resolved", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue({
      outcome: "resolved",
      data: sampleData,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve("12345678000190");

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.data.razao_social).toBe("EMPRESA EXEMPLO LTDA");
    }
    expect(primary.lookup).not.toHaveBeenCalled();
  });

  it("calls primary provider on cache miss", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "resolved", data: sampleData });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve("12345678000190");

    expect(result.status).toBe("resolved");
    expect(primary.lookup).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith("12345678000190", "resolved", sampleData, 24);
  });

  it("falls back when primary unavailable", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "unavailable" });
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "resolved", data: sampleData });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve("12345678000190");

    expect(result.status).toBe("resolved");
    expect(fallback.lookup).toHaveBeenCalledTimes(1);
  });

  it("returns unavailable when both providers fail", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "unavailable" });
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "unavailable" });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve("12345678000190");

    expect(result.status).toBe("unavailable");
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("caches not_found and returns it from cache on re-query", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "not_found" });

    const service = new CnpjVerificationService(primary, fallback, cache);
    await service.resolve("00000000000000");

    expect(cache.set).toHaveBeenCalledWith("00000000000000", "not_found", null, 24);

    vi.mocked(cache.get!).mockResolvedValue({
      outcome: "not_found",
      data: null,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const result2 = await service.resolve("00000000000000");
    expect(result2.status).toBe("not_found");
    expect(primary.lookup).toHaveBeenCalledTimes(1);
  });

  it("re-consults providers when cache is expired", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue({
      outcome: "resolved",
      data: sampleData,
      expiresAt: new Date(Date.now() - 3600000),
    });

    vi.mocked(primary.lookup).mockResolvedValue({ status: "resolved", data: sampleData });

    const service = new CnpjVerificationService(primary, fallback, cache);
    await service.resolve("12345678000190");

    expect(primary.lookup).toHaveBeenCalledTimes(1);
  });

  it("falls back to secondary provider on primary error", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockRejectedValueOnce(new Error("network error"));
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "resolved", data: sampleData });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve("12345678000190");

    expect(result.status).toBe("resolved");
    expect(fallback.lookup).toHaveBeenCalledTimes(1);
  });

  it("returns not_found when primary returns not_found (no fallback needed)", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "not_found" });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve("00000000000000");

    expect(result.status).toBe("not_found");
    expect(fallback.lookup).not.toHaveBeenCalled();
  });
});
