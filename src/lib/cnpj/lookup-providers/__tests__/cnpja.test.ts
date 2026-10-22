import { describe, it, expect, vi, beforeEach } from "vitest";
import { CnpjaProvider } from "../cnpja";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const BASE_URL = "https://open.cnpja.com/office";
const NUMERIC_CNPJ = "12345678000195";
const ALPHANUMERIC_CNPJ = "12ABC34501DE35";

const resolvedPayload = {
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
};

function mockResponse(status: number, json: () => Promise<unknown> = async () => ({})) {
  mockFetch.mockResolvedValueOnce({ status, json });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CnpjaProvider", () => {
  const provider = new CnpjaProvider();

  describe("capacidade declarada", () => {
    it("declares supportsAlphanumeric = false by default", () => {
      expect(provider.supportsAlphanumeric).toBe(false);
      expect(new CnpjaProvider(true).supportsAlphanumeric).toBe(true);
    });
  });

  describe("HTTP 200", () => {
    it("returns resolved for numeric CNPJ with canonical cnpj_normalized", async () => {
      mockResponse(200, async () => resolvedPayload);

      const result = await provider.lookup(NUMERIC_CNPJ);

      expect(result.status).toBe("resolved");
      if (result.status === "resolved") {
        expect(result.data.razao_social).toBe("EMPRESA EXEMPLO LTDA");
        expect(result.data.nome_fantasia).toBe("Empresa Exemplo");
        expect(result.data.situacao_cadastral).toBe("ATIVA");
        expect(result.data.data_abertura).toBe("2010-05-10");
        expect(result.data.cnae_principal).toBe("4781400");
        expect(result.data.cnpj_normalized).toBe(NUMERIC_CNPJ);
      }
    });

    it("returns resolved for alphanumeric CNPJ with canonical cnpj_normalized", async () => {
      mockResponse(200, async () => resolvedPayload);

      const result = await provider.lookup(ALPHANUMERIC_CNPJ);

      expect(result.status).toBe("resolved");
      if (result.status === "resolved") {
        expect(result.data.cnpj_normalized).toBe(ALPHANUMERIC_CNPJ);
      }
    });

    it("returns unavailable on malformed response", async () => {
      mockResponse(200, async () => null);

      const result = await provider.lookup(NUMERIC_CNPJ);
      expect(result.status).toBe("unavailable");
    });
  });

  describe("HTTP 404", () => {
    it("returns not_found for numeric CNPJ", async () => {
      mockResponse(404);

      const result = await provider.lookup(NUMERIC_CNPJ);
      expect(result.status).toBe("not_found");
    });

    it("returns unavailable for alphanumeric CNPJ without declared capability", async () => {
      mockResponse(404);

      const result = await provider.lookup(ALPHANUMERIC_CNPJ);
      expect(result.status).toBe("unavailable");
    });

    it("returns not_found for alphanumeric CNPJ when capability is declared", async () => {
      mockResponse(404);

      const result = await new CnpjaProvider(true).lookup(ALPHANUMERIC_CNPJ);
      expect(result.status).toBe("not_found");
    });
  });

  describe("HTTP 400/422", () => {
    it("returns unsupported_format on 400 for alphanumeric CNPJ", async () => {
      mockResponse(400);

      const result = await provider.lookup(ALPHANUMERIC_CNPJ);
      expect(result.status).toBe("unsupported_format");
    });

    it("returns unsupported_format on 422 for alphanumeric CNPJ", async () => {
      mockResponse(422);

      const result = await provider.lookup(ALPHANUMERIC_CNPJ);
      expect(result.status).toBe("unsupported_format");
    });

    it("returns unavailable on 400 for numeric CNPJ", async () => {
      mockResponse(400);

      const result = await provider.lookup(NUMERIC_CNPJ);
      expect(result.status).toBe("unavailable");
    });

    it("returns unavailable on 422 for numeric CNPJ", async () => {
      mockResponse(422);

      const result = await provider.lookup(NUMERIC_CNPJ);
      expect(result.status).toBe("unavailable");
    });
  });

  describe("transient failures", () => {
    it("returns unavailable on 429 rate limit", async () => {
      mockResponse(429);

      const result = await provider.lookup(NUMERIC_CNPJ);
      expect(result.status).toBe("unavailable");
    });

    it("retries on 5xx once before returning unavailable", async () => {
      mockResponse(500);
      mockResponse(500);

      const result = await provider.lookup(NUMERIC_CNPJ);
      expect(result.status).toBe("unavailable");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("returns unavailable on timeout", async () => {
      mockFetch.mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"));

      const result = await provider.lookup(NUMERIC_CNPJ);
      expect(result.status).toBe("unavailable");
    });
  });

  describe("request URL", () => {
    it("queries the canonical value without punctuation", async () => {
      mockResponse(200, async () => resolvedPayload);

      await provider.lookup(ALPHANUMERIC_CNPJ);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toBe(`${BASE_URL}/${ALPHANUMERIC_CNPJ}`);
    });
  });
});
