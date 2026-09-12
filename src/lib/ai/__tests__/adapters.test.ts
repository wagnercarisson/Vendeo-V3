import { describe, it, expect } from "vitest";
import {
  AiInvocationError,
  normalizeAiError,
  sanitizeAiErrorMessage,
} from "../types";
import {
  AuthConfigError,
  MalformedResponseError,
  NetworkError,
  Provider5xxError,
  ProviderRateLimitError,
  SafetyBlockError,
} from "@/lib/copy/errors";

describe("AiInvocationError — contrato de erro preserva gates de fallback (D4.1)", () => {
  it("rate limit (429) → kind rate_limit e retryable", () => {
    const err = normalizeAiError(Object.assign(new Error("Too many requests"), { status: 429 }));
    expect(err).toBeInstanceOf(AiInvocationError);
    const inv = err as AiInvocationError;
    expect(inv.kind).toBe("rate_limit");
    expect(inv.httpStatus).toBe(429);
    expect(inv.retryable).toBe(true);
  });

  it("ProviderRateLimitError → rate_limit retryable", () => {
    const inv = normalizeAiError(new ProviderRateLimitError()) as AiInvocationError;
    expect(inv.kind).toBe("rate_limit");
    expect(inv.retryable).toBe(true);
  });

  it("timeout (AbortError) → kind timeout e retryable", () => {
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    const inv = normalizeAiError(abort) as AiInvocationError;
    expect(inv.kind).toBe("timeout");
    expect(inv.retryable).toBe(true);
  });

  it("DOMException AbortError → timeout retryable", () => {
    const inv = normalizeAiError(new DOMException("aborted", "AbortError")) as AiInvocationError;
    expect(inv.kind).toBe("timeout");
    expect(inv.retryable).toBe(true);
  });

  it("network (fetch failed / ENOTFOUND) → network retryable", () => {
    const inv = normalizeAiError(
      Object.assign(new Error("fetch failed"), { code: "ENOTFOUND" }),
    ) as AiInvocationError;
    expect(inv.kind).toBe("network");
    expect(inv.retryable).toBe(true);
  });

  it("NetworkError → network retryable", () => {
    const inv = normalizeAiError(new NetworkError()) as AiInvocationError;
    expect(inv.kind).toBe("network");
    expect(inv.retryable).toBe(true);
  });

  it("5xx → provider_error retryable", () => {
    const inv = normalizeAiError(Object.assign(new Error("Bad gateway"), { status: 502 })) as AiInvocationError;
    expect(inv.kind).toBe("provider_error");
    expect(inv.httpStatus).toBe(502);
    expect(inv.retryable).toBe(true);
  });

  it("Provider5xxError → provider_error retryable", () => {
    const inv = normalizeAiError(new Provider5xxError()) as AiInvocationError;
    expect(inv.kind).toBe("provider_error");
    expect(inv.retryable).toBe(true);
  });

  it("auth (401/403) → auth NÃO retryable", () => {
    const unauthorized = normalizeAiError(
      Object.assign(new Error("Unauthorized"), { status: 401 }),
    ) as AiInvocationError;
    expect(unauthorized.kind).toBe("auth");
    expect(unauthorized.retryable).toBe(false);

    const forbidden = normalizeAiError(
      Object.assign(new Error("Forbidden"), { status: 403 }),
    ) as AiInvocationError;
    expect(forbidden.kind).toBe("auth");
    expect(forbidden.retryable).toBe(false);
  });

  it("AuthConfigError → auth NÃO retryable", () => {
    const inv = normalizeAiError(new AuthConfigError()) as AiInvocationError;
    expect(inv.kind).toBe("auth");
    expect(inv.retryable).toBe(false);
  });

  it("safety/content_filter → content_filter NÃO retryable", () => {
    const safety = normalizeAiError(new SafetyBlockError()) as AiInvocationError;
    expect(safety.kind).toBe("content_filter");
    expect(safety.retryable).toBe(false);

    const contentFilter = normalizeAiError(
      Object.assign(new Error("content_policy_violation"), { code: "content_filter" }),
    ) as AiInvocationError;
    expect(contentFilter.kind).toBe("content_filter");
    expect(contentFilter.retryable).toBe(false);
  });

  it("capability de tool (model_not_found) → kind capability (habilita images.edit)", () => {
    const inv = normalizeAiError(
      Object.assign(new Error("model_not_found: image_generation is not supported"), { status: 400 }),
    ) as AiInvocationError;
    expect(inv.kind).toBe("capability");
    expect(inv.retryable).toBe(false);
  });

  it("capability de response_format/json_schema → kind capability (habilita json_object)", () => {
    const inv = normalizeAiError(
      new Error("response_format json_schema is not supported by this model"),
    ) as AiInvocationError;
    expect(inv.kind).toBe("capability");
    expect(inv.retryable).toBe(false);
  });

  it("MalformedResponseError NÃO é normalizado (propaga o original)", () => {
    const original = new MalformedResponseError();
    const result = normalizeAiError(original);
    expect(result).toBe(original);
    expect(result).not.toBeInstanceOf(AiInvocationError);
  });

  it("erro desconhecido → provider_error NÃO retryable (não habilita fallback)", () => {
    const inv = normalizeAiError(new Error("algo inesperado")) as AiInvocationError;
    expect(inv.kind).toBe("provider_error");
    expect(inv.retryable).toBe(false);
  });

  it("preserva httpStatus/code e sanitiza message (sem chave/URL)", () => {
    const raw = new Error(
      "request to https://api.openai.com/v1 failed with key sk-abcdefghijklmnop (rate_limit)",
    );
    const inv = normalizeAiError(Object.assign(raw, { status: 429, code: "rate_limit" })) as AiInvocationError;
    expect(inv.kind).toBe("rate_limit");
    expect(inv.httpStatus).toBe(429);
    expect(inv.code).toBe("rate_limit");
    expect(inv.message).not.toContain("https://api.openai.com");
    expect(inv.message).not.toContain("sk-abcdefghijklmnop");
    expect(inv.message).toContain("[redacted-url]");
    expect(inv.message).toContain("[redacted-key]");
  });

  it("sanitizeAiErrorMessage remove bearer token", () => {
    const sanitized = sanitizeAiErrorMessage("Authorization: Bearer abc123def456ghi789");
    expect(sanitized).toBe("Authorization: Bearer [redacted]");
  });
});
