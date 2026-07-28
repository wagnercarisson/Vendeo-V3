import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrasilApiProvider } from "../brasil-api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BrasilApiProvider", () => {
  const provider = new BrasilApiProvider();

  it("returns resolved with data for valid CNPJ", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        razao_social: "EMPRESA EXEMPLO LTDA",
        nome_fantasia: "Empresa Exemplo",
        situacao_cadastral: "ATIVA",
        cep: "01234567",
        logradouro: "Rua Exemplo",
        numero: "123",
        bairro: "Centro",
        municipio: "São Paulo",
        uf: "SP",
        cnae_principal: "4781-4/00",
        cnae_descricao: "Comércio varejista de artigos do vestuário",
        data_situacao: "2020-01-01",
        data_abertura: "2010-05-10",
        porte: "ME",
      }),
    });

    const result = await provider.lookup("12345678000190");

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.data.razao_social).toBe("EMPRESA EXEMPLO LTDA");
      expect(result.data.situacao_cadastral).toBe("ATIVA");
      expect(result.data.cidade).toBe("São Paulo");
    }
  });

  it("returns not_found for 404", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 404,
      json: async () => ({}),
    });

    const result = await provider.lookup("00000000000000");
    expect(result.status).toBe("not_found");
  });

  it("returns unavailable on timeout", async () => {
    mockFetch.mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"));

    const result = await provider.lookup("12345678000190");
    expect(result.status).toBe("unavailable");
  });

  it("returns unavailable on 429 rate limit", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 429,
    });

    const result = await provider.lookup("12345678000190");
    expect(result.status).toBe("unavailable");
  });

  it("returns unavailable on 5xx", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
    });

    const result = await provider.lookup("12345678000190");
    expect(result.status).toBe("unavailable");
  });

  it("returns unavailable on malformed response", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ invalid: true }),
    });

    const result = await provider.lookup("12345678000190");
    expect(result.status).toBe("unavailable");
  });

  it("retries on 5xx once before returning unavailable", async () => {
    mockFetch
      .mockResolvedValueOnce({ status: 500 })
      .mockResolvedValueOnce({ status: 500 });

    const result = await provider.lookup("12345678000190");
    expect(result.status).toBe("unavailable");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
