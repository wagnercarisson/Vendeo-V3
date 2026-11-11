// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { AiInvocationError } from "@/lib/ai/types";
import { MalformedResponseError } from "@/lib/copy/errors";

import {
  EXPANSION_DEFINITIVE_REASONS,
  classifyExpansionFailure,
} from "../failure";

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

function invocationError(
  kind: ConstructorParameters<typeof AiInvocationError>[0]["kind"],
  httpStatus?: number,
): AiInvocationError {
  return new AiInvocationError({
    kind,
    retryable: kind === "rate_limit" || kind === "provider_error",
    message: `erro ${kind}`,
    ...(httpStatus === undefined ? {} : { httpStatus }),
  });
}

const ALLOWED_KINDS = ["provider_failure", "definitive_failure", "unknown_result"] as const;

/**
 * F60.3 — classificação pura. Toda asserção verifica também que a união
 * devolvida nunca carrega um `kind` de repetição: o módulo apenas classifica.
 */
describe("F60.3 failure — transitória", () => {
  it("rate_limit é transitória com motivo rate_limit", () => {
    const result = classifyExpansionFailure(invocationError("rate_limit"), "possibly_sent");

    expect(ALLOWED_KINDS).toContain(result.kind);
    expect(result).toEqual({
      kind: "provider_failure",
      failure: { class: "transient", reason: "rate_limit", sendEvidence: "possibly_sent" },
    });
  });

  it("provider_error 503 é transitória por capacidade indisponível", () => {
    const result = classifyExpansionFailure(
      invocationError("provider_error", 503),
      "confirmed_sent",
    );

    expect(result).toEqual({
      kind: "provider_failure",
      failure: {
        class: "transient",
        reason: "capacity_unavailable",
        sendEvidence: "confirmed_sent",
      },
    });
  });

  it("provider_error sem status e envio comprovadamente não feito é transitória", () => {
    const result = classifyExpansionFailure(invocationError("provider_error"), "not_sent");

    expect(result).toEqual({
      kind: "provider_failure",
      failure: { class: "transient", reason: "pre_send_failure", sendEvidence: "not_sent" },
    });
  });
});

describe("F60.3 failure — definitiva", () => {
  it("provider_error 400 é definitiva com invalid_request (nunca ProviderFailure)", () => {
    const result = classifyExpansionFailure(
      invocationError("provider_error", 400),
      "possibly_sent",
    );

    expect(result).toEqual({ kind: "definitive_failure", reason: "invalid_request" });
    expect(result.kind).not.toBe("provider_failure");
  });

  it("auth/quota/billing/capability/content_filter são definitivas com motivo fechado", () => {
    const matrix = [
      ["auth", "auth"],
      ["quota", "quota"],
      ["billing", "billing"],
      ["capability", "capability"],
      ["content_filter", "content_filter"],
    ] as const;

    for (const [kind, reason] of matrix) {
      const result = classifyExpansionFailure(invocationError(kind), "possibly_sent");

      expect(result).toEqual({ kind: "definitive_failure", reason });
      expect(result.kind).not.toBe("provider_failure");
      expect(result.kind).not.toBe("unknown_result");
    }
  });

  it("resposta sem imagem é definitiva com motivo invalid_output", () => {
    const result = classifyExpansionFailure(
      new MalformedResponseError("Image API returned no image data"),
      "confirmed_sent",
    );

    expect(result).toEqual({
      kind: "provider_failure",
      failure: {
        class: "definitive",
        reason: "invalid_output",
        sendEvidence: "confirmed_sent",
      },
    });
  });
});

describe("F60.3 failure — desconhecida (nunca definitiva)", () => {
  it("timeout é desconhecida", () => {
    const result = classifyExpansionFailure(invocationError("timeout"), "possibly_sent");

    expect(result).toEqual({
      kind: "unknown_result",
      reason: "timeout",
      failure: { class: "unknown", reason: "timeout", sendEvidence: "possibly_sent" },
    });
    expect(result.kind).not.toBe("definitive_failure");
  });

  it("abort é desconhecida", () => {
    const result = classifyExpansionFailure(
      new DOMException("aborted", "AbortError"),
      "possibly_sent",
    );

    expect(result).toEqual({
      kind: "unknown_result",
      reason: "abort",
      failure: { class: "unknown", reason: "abort", sendEvidence: "possibly_sent" },
    });
    expect(result.kind).not.toBe("definitive_failure");
  });

  it("perda de rede/comunicação é desconhecida", () => {
    const result = classifyExpansionFailure(invocationError("network"), "possibly_sent");

    expect(result).toEqual({
      kind: "unknown_result",
      reason: "comm_lost",
      failure: { class: "unknown", reason: "comm_lost", sendEvidence: "possibly_sent" },
    });
    expect(result.kind).not.toBe("definitive_failure");
  });

  it("provider_error sem status após possível envio é desconhecida", () => {
    const result = classifyExpansionFailure(
      invocationError("provider_error"),
      "confirmed_sent",
    );

    expect(result).toEqual({
      kind: "unknown_result",
      reason: "comm_lost",
      failure: { class: "unknown", reason: "comm_lost", sendEvidence: "confirmed_sent" },
    });
  });
});

describe("F60.3 failure — entrada hostil nunca lança e nunca vira definitiva", () => {
  it("erro desconhecido não lança e não é definitivo", () => {
    for (const error of [new Error("x"), undefined, null, "boom", 42, { message: "x" }]) {
      const result = classifyExpansionFailure(error, "possibly_sent");

      expect(ALLOWED_KINDS).toContain(result.kind);
      expect(result.kind).not.toBe("definitive_failure");
    }
  });

  it("erro desconhecido antes do envio é transitório", () => {
    expect(classifyExpansionFailure(undefined, "not_sent")).toEqual({
      kind: "provider_failure",
      failure: { class: "transient", reason: "pre_send_failure", sendEvidence: "not_sent" },
    });
  });

  it("classifyExpansionFailure('boom', 'possibly_sent') não lança", () => {
    expect(() => classifyExpansionFailure("boom", "possibly_sent")).not.toThrow();
    expect(classifyExpansionFailure("boom", "possibly_sent").kind).toBe("unknown_result");
  });

  it("não existe variante de repetição na união", () => {
    const kinds: ReadonlyArray<string> = [...ALLOWED_KINDS];
    expect(kinds).toEqual(["provider_failure", "definitive_failure", "unknown_result"]);
    expect(kinds).not.toContain("retry");
  });

  it("motivos definitivos são uma lista fechada de 6 itens", () => {
    expect(EXPANSION_DEFINITIVE_REASONS).toHaveLength(6);
    expect(Object.isFrozen(EXPANSION_DEFINITIVE_REASONS)).toBe(true);
    expect([...EXPANSION_DEFINITIVE_REASONS]).toEqual([
      "auth",
      "quota",
      "billing",
      "capability",
      "content_filter",
      "invalid_request",
    ]);
  });
});

describe("F60.3 failure — fronteira de módulo", () => {
  it("reusa classifyProviderFailure e não decide classe por literal", () => {
    const source = readFileSync(sourcePath("../failure.ts"), "utf8");

    expect(source).toContain("classifyProviderFailure(");
    expect(source).not.toMatch(/return\s+"(transient|definitive|unknown)"/);
    expect(source).not.toMatch(
      /reason\s*===\s*"(rate_limit|capacity_unavailable|invalid_output|pre_send_failure)"/,
    );
  });

  it("é puro: sem server-only, imagem, banco, gateway ou adapter de provider", () => {
    const source = readFileSync(sourcePath("../failure.ts"), "utf8");

    expect(source).not.toMatch(/import\s+"server-only"/);
    expect(source).not.toMatch(/\bsharp\b/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toContain("AiGateway");
    expect(source).not.toContain("UpstreamImagesAdapter");
    expect(source).not.toMatch(/retry/i);
  });
});
