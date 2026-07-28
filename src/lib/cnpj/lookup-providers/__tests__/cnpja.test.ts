import { describe, it, expect, vi, beforeEach } from "vitest";
import { CnpjaProvider } from "../cnpja";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CnpjaProvider", () => {
  const provider = new CnpjaProvider();

  it("returns resolved with data for valid CNPJ", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        name: "EMPRESA EXEMPLO LTDA",
        alias: "Empresa Exemplo",
        status: { text: "ATIVA", since: "2020-01-01" },
        company: { name: "EMPRESA EXEMPLO LTDA" },
        address: {
          zip: "01234567",
          street: "Rua Exemplo",
          number: "123",
          district: "Centro",
          city: "São Paulo",
          state: "SP",
        },
        mainActivity: { id: "4781400", text: "Comércio varejista de artigos do vestuário e acessórios" },
        registration: { date: "2010-05-10", status: "ATIVA" },
        size: "ME",
      }),
    });

    const result = await provider.lookup("12345678000190");

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.data.razao_social).toBe("EMPRESA EXEMPLO LTDA");
      expect(result.data.nome_fantasia).toBe("Empresa Exemplo");
      expect(result.data.situacao_cadastral).toBe("ATIVA");
      expect(result.data.data_abertura).toBe("2010-05-10");
      expect(result.data.cnae_principal).toBe("4781400");
    }
  });

  it("returns not_found for 404", async () => {
    mockFetch.mockResolvedValueOnce({ status: 404 });

    const result = await provider.lookup("00000000000000");
    expect(result.status).toBe("not_found");
  });

  it("returns unavailable on timeout", async () => {
    mockFetch.mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"));

    const result = await provider.lookup("12345678000190");
    expect(result.status).toBe("unavailable");
  });

  it("returns unavailable on error", async () => {
    mockFetch.mockResolvedValueOnce({ status: 500 });

    const result = await provider.lookup("12345678000190");
    expect(result.status).toBe("unavailable");
  });

  it("returns unavailable on malformed response", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => null,
    });

    const result = await provider.lookup("12345678000190");
    expect(result.status).toBe("unavailable");
  });
});
