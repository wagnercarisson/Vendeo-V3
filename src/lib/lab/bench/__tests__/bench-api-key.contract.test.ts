// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BENCH_API_KEY_ENV,
  BenchApiKeyError,
  getBenchApiKey,
} from "@/lib/lab/bench/gateway/bench-api-key";

/**
 * Resolvedor de chave **exclusivo da bancada** (F48.2.4, D21; spec `lab-isolation`).
 *
 * Lê somente `OPENAI_BENCH_API_KEY`; nunca faz fallback para `OPENAI_API_KEY`;
 * ausente/vazia ⇒ falha antes de criar o cliente/chamar o provider. Nenhuma
 * chamada real de IA ocorre aqui.
 */

const ORIGINAL = {
  bench: process.env.OPENAI_BENCH_API_KEY,
  prod: process.env.OPENAI_API_KEY,
};

function setEnv(bench?: string, prod?: string): void {
  if (bench === undefined) delete process.env.OPENAI_BENCH_API_KEY;
  else process.env.OPENAI_BENCH_API_KEY = bench;
  if (prod === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = prod;
}

beforeEach(() => setEnv(undefined, undefined));
afterEach(() => setEnv(ORIGINAL.bench, ORIGINAL.prod));

describe("getBenchApiKey — chave exclusiva da bancada", () => {
  it("ambas as chaves presentes ⇒ usa exclusivamente OPENAI_BENCH_API_KEY", () => {
    setEnv("sk-bench", "sk-prod");
    expect(getBenchApiKey("openai")).toBe("sk-bench");
    expect(getBenchApiKey("openai")).not.toBe("sk-prod");
  });

  it("apenas OPENAI_API_KEY presente ⇒ bancada recusa (sem fallback)", () => {
    setEnv(undefined, "sk-prod");
    expect(() => getBenchApiKey("openai")).toThrow(BenchApiKeyError);
    try {
      getBenchApiKey("openai");
    } catch (error) {
      expect((error as BenchApiKeyError).code).toBe("bench_api_key_missing");
    }
  });

  it("apenas OPENAI_BENCH_API_KEY presente ⇒ bancada funciona", () => {
    setEnv("sk-bench-only", undefined);
    expect(getBenchApiKey("openai")).toBe("sk-bench-only");
  });

  it("chave vazia ⇒ falha antes de qualquer chamada ao provider", () => {
    setEnv("", "sk-prod");
    expect(() => getBenchApiKey("openai")).toThrow(/bench_api_key_missing/);
  });

  it("chave só com espaços ⇒ tratada como vazia (falha)", () => {
    setEnv("   ", undefined);
    expect(() => getBenchApiKey("openai")).toThrow(/bench_api_key_missing/);
  });

  it("a mensagem de erro não expõe o valor da chave", () => {
    setEnv(undefined, "sk-prod-secret");
    try {
      getBenchApiKey("openai");
      throw new Error("deveria ter lançado");
    } catch (error) {
      expect(String(error)).not.toContain("sk-prod-secret");
      expect(String(error)).toContain(BENCH_API_KEY_ENV);
    }
  });

  it("provider fora do caminho isolado ⇒ recusa", () => {
    setEnv("sk-bench", undefined);
    expect(() => getBenchApiKey("gemini")).toThrow(BenchApiKeyError);
  });
});
