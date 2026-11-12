// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { AiInvocationError } from "@/lib/ai/types";
import { MalformedResponseError } from "@/lib/copy/errors";

import {
  SQUARE_BASE_DEFINITIVE_REASONS,
  classifySquareBaseFailure,
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

const ALLOWED_KINDS = [
  "provider_failure",
  "definitive_failure",
  "unknown_result",
] as const;

describe("F60.4 failure — transitória (provider_failure)", () => {
  it("rate_limit é transitória com motivo rate_limit", () => {
    const result = classifySquareBaseFailure(invocationError("rate_limit"), {
      sendEvidence: "possibly_sent",
    });

    expect(ALLOWED_KINDS).toContain(result.kind);
    expect(result).toEqual({
      kind: "provider_failure",
      failure: {
        class: "transient",
        reason: "rate_limit",
        sendEvidence: "possibly_sent",
      },
    });
  });

  it("provider_error 503 é transitória por capacidade indisponível", () => {
    expect(
      classifySquareBaseFailure(invocationError("provider_error", 503), {
        sendEvidence: "confirmed_sent",
      }),
    ).toEqual({
      kind: "provider_failure",
      failure: {
        class: "transient",
        reason: "capacity_unavailable",
        sendEvidence: "confirmed_sent",
      },
    });
  });

  it("provider_error sem status e envio comprovadamente não feito é transitória", () => {
    expect(
      classifySquareBaseFailure(invocationError("provider_error"), {
        sendEvidence: "not_sent",
      }),
    ).toEqual({
      kind: "provider_failure",
      failure: {
        class: "transient",
        reason: "pre_send_failure",
        sendEvidence: "not_sent",
      },
    });
  });
});

describe("F60.4 failure — definitiva", () => {
  it("provider_error 400 é definitiva com invalid_request", () => {
    const result = classifySquareBaseFailure(
      invocationError("provider_error", 400),
      { sendEvidence: "possibly_sent" },
    );
    expect(result).toEqual({
      kind: "definitive_failure",
      reason: "invalid_request",
    });
    expect(result.kind).not.toBe("provider_failure");
  });

  it("auth/quota/billing/capability/content_filter são definitivas", () => {
    const matrix = [
      ["auth", "auth"],
      ["quota", "quota"],
      ["billing", "billing"],
      ["capability", "capability"],
      ["content_filter", "content_filter"],
    ] as const;

    for (const [kind, reason] of matrix) {
      const result = classifySquareBaseFailure(invocationError(kind), {
        sendEvidence: "possibly_sent",
      });
      expect(result).toEqual({ kind: "definitive_failure", reason });
      expect(result.kind).not.toBe("unknown_result");
    }
  });

  it("resposta sem imagem (MalformedResponseError) é definitiva invalid_output", () => {
    expect(
      classifySquareBaseFailure(
        new MalformedResponseError("Image API returned no image data"),
        { sendEvidence: "confirmed_sent" },
      ),
    ).toEqual({
      kind: "provider_failure",
      failure: {
        class: "definitive",
        reason: "invalid_output",
        sendEvidence: "confirmed_sent",
      },
    });
  });
});

describe("F60.4 failure — desconhecida (nunca definitiva)", () => {
  it("timeout é desconhecida", () => {
    const result = classifySquareBaseFailure(invocationError("timeout"), {
      sendEvidence: "possibly_sent",
    });
    expect(result).toEqual({
      kind: "unknown_result",
      reason: "timeout",
      failure: {
        class: "unknown",
        reason: "timeout",
        sendEvidence: "possibly_sent",
      },
    });
    expect(result.kind).not.toBe("definitive_failure");
  });

  it("abort (DOMException) é desconhecida", () => {
    const result = classifySquareBaseFailure(
      new DOMException("aborted", "AbortError"),
      { sendEvidence: "possibly_sent" },
    );
    expect(result).toEqual({
      kind: "unknown_result",
      reason: "abort",
      failure: {
        class: "unknown",
        reason: "abort",
        sendEvidence: "possibly_sent",
      },
    });
    expect(result.kind).not.toBe("definitive_failure");
  });

  it("network é desconhecida (comm_lost)", () => {
    expect(
      classifySquareBaseFailure(invocationError("network"), {
        sendEvidence: "possibly_sent",
      }),
    ).toEqual({
      kind: "unknown_result",
      reason: "comm_lost",
      failure: {
        class: "unknown",
        reason: "comm_lost",
        sendEvidence: "possibly_sent",
      },
    });
  });

  it("provider_error sem status após possível envio é desconhecida", () => {
    expect(
      classifySquareBaseFailure(invocationError("provider_error"), {
        sendEvidence: "confirmed_sent",
      }),
    ).toEqual({
      kind: "unknown_result",
      reason: "comm_lost",
      failure: {
        class: "unknown",
        reason: "comm_lost",
        sendEvidence: "confirmed_sent",
      },
    });
  });
});

describe("F60.4 failure — entrada hostil nunca lança e nunca vira definitiva", () => {
  it("erro desconhecido não lança e não é definitivo", () => {
    for (const error of [new Error("x"), undefined, null, "boom", 42, { message: "x" }]) {
      const result = classifySquareBaseFailure(error, {
        sendEvidence: "possibly_sent",
      });
      expect(ALLOWED_KINDS).toContain(result.kind);
      expect(result.kind).not.toBe("definitive_failure");
    }
  });

  it("erro desconhecido antes do envio é transitório", () => {
    expect(
      classifySquareBaseFailure(undefined, { sendEvidence: "not_sent" }),
    ).toEqual({
      kind: "provider_failure",
      failure: {
        class: "transient",
        reason: "pre_send_failure",
        sendEvidence: "not_sent",
      },
    });
  });

  it("a união não contém variante de repetição e os definitivos são 6", () => {
    expect(ALLOWED_KINDS).toEqual([
      "provider_failure",
      "definitive_failure",
      "unknown_result",
    ]);
    expect(ALLOWED_KINDS).not.toContain("retry");
    expect(SQUARE_BASE_DEFINITIVE_REASONS).toHaveLength(6);
    expect(Object.isFrozen(SQUARE_BASE_DEFINITIVE_REASONS)).toBe(true);
    expect([...SQUARE_BASE_DEFINITIVE_REASONS]).toEqual([
      "auth",
      "quota",
      "billing",
      "capability",
      "content_filter",
      "invalid_request",
    ]);
  });
});

describe("F60.4 failure — fronteira de módulo", () => {
  it("reusa classifyProviderFailure e é puro", () => {
    const source = readFileSync(sourcePath("../failure.ts"), "utf8");

    expect(source).toContain("classifyProviderFailure(");
    expect(source).not.toMatch(/import\s+"server-only"/);
    expect(source).not.toMatch(/\bsharp\b/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toContain("AiGateway");
    expect(source).not.toContain("UpstreamImagesAdapter");
    expect(source).not.toContain("vertical-expansion");
  });
});
