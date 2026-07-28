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
        alias: "EMPRESA EXEMPLO LTDA",
        name: "Empresa Exemplo",
        status: { text: "ATIVA", date: "2020-01-01" },
        address: {
          zip: "01234567",
          street: "Rua Exemplo",
          number: "123",
          district: "Centro",
          city: "São Paulo",
          state: "SP",
        },
        main_activity: { code: "4781-4/00", text: "Comércio varejista" },
        founded: "2010-05-10",
        size: "ME",
      }),
    });

    const result = await provider.lookup("12345678000190");

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.data.razao_social).toBe("EMPRESA EXEMPLO LTDA");
      expect(result.data.situacao_cadastral).toBe("ATIVA");
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
