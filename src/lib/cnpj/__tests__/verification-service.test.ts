import { describe, it, expect, vi, beforeEach } from "vitest";
import { CnpjVerificationService, type CnpjLookupCache } from "../verification-service";
import type { CnpjLookupProvider, CnpjLookupData } from "../lookup-providers/types";

function createMockProvider(supportsAlphanumeric = false): CnpjLookupProvider {
  return { supportsAlphanumeric, lookup: vi.fn() };
}

function createMockCache(): CnpjLookupCache {
  return {
    get: vi.fn(),
    set: vi.fn(),
  };
}

const ALPHANUMERIC_CNPJ = "12ABC34501DE35";
const NUMERIC_CNPJ = "12345678000190";

const sampleData: CnpjLookupData = {
  cnpj_normalized: NUMERIC_CNPJ,
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

const alphanumericData: CnpjLookupData = {
  ...sampleData,
  cnpj_normalized: ALPHANUMERIC_CNPJ,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CnpjVerificationService", () => {
  it("uses the canonical key on cache lookup for a dotted/lowercase alphanumeric CNPJ", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue({
      outcome: "resolved",
      data: alphanumericData,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve("12.abc.345/01de-35");

    expect(cache.get).toHaveBeenCalledWith(ALPHANUMERIC_CNPJ);
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.data.razao_social).toBe("EMPRESA EXEMPLO LTDA");
    }
    expect(primary.lookup).not.toHaveBeenCalled();
    expect(fallback.lookup).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("returns cached not_found without querying providers", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue({
      outcome: "not_found",
      data: null,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(NUMERIC_CNPJ);

    expect(result.status).toBe("not_found");
    expect(primary.lookup).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("caches a primary resolved result with the canonical key", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "resolved", data: alphanumericData });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve("12.abc.345/01de-35");

    expect(result.status).toBe("resolved");
    expect(primary.lookup).toHaveBeenCalledWith(ALPHANUMERIC_CNPJ);
    expect(cache.set).toHaveBeenCalledWith(ALPHANUMERIC_CNPJ, "resolved", alphanumericData, 24);
    expect(fallback.lookup).not.toHaveBeenCalled();
  });

  it("falls back when primary is unavailable", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "unavailable" });
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "resolved", data: alphanumericData });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(ALPHANUMERIC_CNPJ);

    expect(result.status).toBe("resolved");
    expect(fallback.lookup).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(ALPHANUMERIC_CNPJ, "resolved", alphanumericData, 24);
  });

  it("falls back when primary reports unsupported_format", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "unsupported_format" });
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "resolved", data: alphanumericData });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(ALPHANUMERIC_CNPJ);

    expect(result.status).toBe("resolved");
    expect(fallback.lookup).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(ALPHANUMERIC_CNPJ, "resolved", alphanumericData, 24);
  });

  it("returns unsupported_format when both providers explicitly reject the format, without caching", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "unsupported_format" });
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "unsupported_format" });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(ALPHANUMERIC_CNPJ);

    expect(result.status).toBe("unsupported_format");
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("returns unavailable when one provider rejects the format and the other is unavailable", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "unsupported_format" });
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "unavailable" });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(ALPHANUMERIC_CNPJ);

    expect(result.status).toBe("unavailable");
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("returns unavailable when the primary is unavailable and the fallback rejects the format", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "unavailable" });
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "unsupported_format" });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(ALPHANUMERIC_CNPJ);

    expect(result.status).toBe("unavailable");
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("treats an ambiguous alphanumeric 404 from the primary as unavailable and does not cache it", async () => {
    const primary = createMockProvider(false);
    const fallback = createMockProvider(false);
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "not_found" });
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "unavailable" });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(ALPHANUMERIC_CNPJ);

    expect(result.status).toBe("unavailable");
    expect(fallback.lookup).toHaveBeenCalledTimes(1);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("accepts a conclusive alphanumeric 404 from a capable fallback and caches it", async () => {
    const primary = createMockProvider(false);
    const fallback = createMockProvider(true);
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "unsupported_format" });
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "not_found" });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(ALPHANUMERIC_CNPJ);

    expect(result.status).toBe("not_found");
    expect(cache.set).toHaveBeenCalledWith(ALPHANUMERIC_CNPJ, "not_found", null, 24);
  });

  it("returns unavailable when both providers are unavailable, without caching", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "unavailable" });
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "unavailable" });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(NUMERIC_CNPJ);

    expect(result.status).toBe("unavailable");
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("caches a conclusive numeric not_found from the primary", async () => {
    const primary = createMockProvider(false);
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockResolvedValue({ status: "not_found" });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve("00.000.000/0000-00");

    expect(result.status).toBe("not_found");
    expect(fallback.lookup).not.toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith("00000000000000", "not_found", null, 24);
  });

  it("re-consults providers when the cache entry is expired and stores the fresh result", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue({
      outcome: "resolved",
      data: sampleData,
      expiresAt: new Date(Date.now() - 3600000),
    });
    vi.mocked(primary.lookup).mockResolvedValue({ status: "resolved", data: alphanumericData });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(ALPHANUMERIC_CNPJ);

    expect(result.status).toBe("resolved");
    expect(primary.lookup).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(ALPHANUMERIC_CNPJ, "resolved", alphanumericData, 24);
  });

  it("falls back to the secondary provider when the primary throws", async () => {
    const primary = createMockProvider();
    const fallback = createMockProvider();
    const cache = createMockCache();

    vi.mocked(cache.get!).mockResolvedValue(null);
    vi.mocked(primary.lookup).mockRejectedValueOnce(new Error("network error"));
    vi.mocked(fallback.lookup).mockResolvedValue({ status: "resolved", data: sampleData });

    const service = new CnpjVerificationService(primary, fallback, cache);
    const result = await service.resolve(NUMERIC_CNPJ);

    expect(result.status).toBe("resolved");
    expect(fallback.lookup).toHaveBeenCalledTimes(1);
  });
});
