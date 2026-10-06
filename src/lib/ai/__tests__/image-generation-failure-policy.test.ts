import { describe, expect, it } from "vitest";

import {
  ELIGIBLE_IMAGE_GENERATION_FAILURE_CLASSES,
  classifyImageGenerationFailure,
} from "../image-generation-failure-policy";
import { AiInvocationError } from "../types";

/**
 * Testes **simulados** (sem provider, sem I/O) da taxonomia de falhas e da
 * política de execução do novo fluxo de imagem (F56.1, D-15/D-16/D-17).
 *
 * A aplicação desta política sobre uma geração real é integração da **F56.2**;
 * aqui o componente é exercitado apenas com erros simulados (tasks 6.7/6.9).
 */

describe("classificação de falhas — taxonomia (F56.1 D-15)", () => {
  it("congela exatamente as classes elegíveis ao fallback", () => {
    expect([...ELIGIBLE_IMAGE_GENERATION_FAILURE_CLASSES]).toEqual([
      "rate_limit",
      "timeout",
      "network",
      "provider_error",
      "availability",
    ]);
  });

  it("classifica rate_limit como elegível", () => {
    const result = classifyImageGenerationFailure(
      new AiInvocationError({ kind: "rate_limit", retryable: true, message: "429 too many requests" }),
    );
    expect(result).toEqual({ category: "rate_limit", eligibleForFallback: true });
  });

  it("classifica timeout como elegível", () => {
    const result = classifyImageGenerationFailure(
      new AiInvocationError({ kind: "timeout", retryable: true, message: "tempo esgotado" }),
    );
    expect(result).toEqual({ category: "timeout", eligibleForFallback: true });
  });

  it("classifica network como elegível", () => {
    const result = classifyImageGenerationFailure(
      new AiInvocationError({ kind: "network", retryable: true, message: "fetch failed" }),
    );
    expect(result).toEqual({ category: "network", eligibleForFallback: true });
  });

  it("classifica provider_error 5xx como elegível", () => {
    const result = classifyImageGenerationFailure(
      new AiInvocationError({
        kind: "provider_error",
        retryable: true,
        httpStatus: 500,
        message: "erro interno do provider",
      }),
    );
    expect(result).toEqual({ category: "provider_error", eligibleForFallback: true });
  });

  it("classifica 503 (httpStatus) como provider_error elegível", () => {
    const result = classifyImageGenerationFailure({ httpStatus: 503 });
    expect(result.eligibleForFallback).toBe(true);
    expect(result.category).toBe("provider_error");
  });

  it("classifica disponibilidade/capacidade explícita como availability elegível", () => {
    for (const message of [
      "The model is overloaded, please try again later",
      "Service temporarily unavailable",
      "The engine is at capacity right now",
    ]) {
      const result = classifyImageGenerationFailure({ message });
      expect(result).toEqual({ category: "availability", eligibleForFallback: true });
    }
  });
});

describe("classificação de falhas — não elegíveis (F56.1 D-15)", () => {
  it("classifica quota esgotada como não elegível", () => {
    const result = classifyImageGenerationFailure(
      new AiInvocationError({ kind: "quota", retryable: false, message: "quota esgotada" }),
    );
    expect(result).toEqual({ category: "quota", eligibleForFallback: false });
  });

  it("classifica erro de faturamento como não elegível", () => {
    const result = classifyImageGenerationFailure(
      new AiInvocationError({ kind: "billing", retryable: false, message: "billing hard limit" }),
    );
    expect(result).toEqual({ category: "billing", eligibleForFallback: false });
  });

  it("classifica autenticação/autorização como não elegível", () => {
    const result = classifyImageGenerationFailure(
      new AiInvocationError({ kind: "auth", retryable: false, httpStatus: 401, message: "unauthorized" }),
    );
    expect(result).toEqual({ category: "auth", eligibleForFallback: false });
  });

  it("classifica bloqueio de conteúdo/segurança como não elegível", () => {
    const result = classifyImageGenerationFailure(
      new AiInvocationError({ kind: "content_filter", retryable: false, message: "safety blocked" }),
    );
    expect(result).toEqual({ category: "content", eligibleForFallback: false });
  });

  it("classifica entrada/validação como não elegível", () => {
    const result = classifyImageGenerationFailure({
      code: "invalid_request_error",
      message: "Invalid input for the requested operation",
    });
    expect(result).toEqual({ category: "input", eligibleForFallback: false });
  });

  it("classifica capacidade não suportada como não elegível (input)", () => {
    const result = classifyImageGenerationFailure(
      new AiInvocationError({ kind: "capability", retryable: false, message: "unsupported" }),
    );
    expect(result).toEqual({ category: "input", eligibleForFallback: false });
  });
});

describe("classificação de falhas — sinais explícitos antes do 429 genérico (T-56.1-18)", () => {
  it("insufficient_quota é não elegível mesmo com httpStatus 429", () => {
    const result = classifyImageGenerationFailure({
      code: "insufficient_quota",
      httpStatus: 429,
      message: "You exceeded your current quota",
    });
    expect(result).toEqual({ category: "quota", eligibleForFallback: false });
  });

  it("quota_exceeded na mensagem vence o 429 genérico", () => {
    const result = classifyImageGenerationFailure({ httpStatus: 429, message: "quota_exceeded" });
    expect(result).toEqual({ category: "quota", eligibleForFallback: false });
  });

  it("sinal de faturamento vence o 429 genérico", () => {
    const result = classifyImageGenerationFailure({
      httpStatus: 429,
      message: "billing_hard_limit_reached",
    });
    expect(result).toEqual({ category: "billing", eligibleForFallback: false });
  });

  it("429 genérico sem sinal de quota/faturamento permanece rate_limit elegível", () => {
    const result = classifyImageGenerationFailure({ httpStatus: 429, message: "Too many requests" });
    expect(result).toEqual({ category: "rate_limit", eligibleForFallback: true });
  });

  it("entrada, autorização e segurança nunca retornam categoria elegível ao fallback", () => {
    const cases = [
      { code: "invalid_request_error", message: "validation failed" },
      { httpStatus: 403, message: "forbidden" },
      { code: "content_policy_violation", message: "blocked by policy" },
    ];
    for (const error of cases) {
      const result = classifyImageGenerationFailure(error);
      expect(result.eligibleForFallback).toBe(false);
      expect(ELIGIBLE_IMAGE_GENERATION_FAILURE_CLASSES).not.toContain(result.category);
    }
  });
});
