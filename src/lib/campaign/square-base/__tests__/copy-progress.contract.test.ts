// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { copyProgressFor } from "../run-square-base";
import type { CopyOutcome } from "../types";

describe("progresso real da copy — mapeamento de desfecho", () => {
  it("copy gerada conclui com origem generated", () => {
    const outcome: CopyOutcome = {
      kind: "completed",
      attemptSeq: 1,
      text: "Texto",
      payload: { caption: "Texto" },
      origin: "generated",
    };
    expect(copyProgressFor(outcome)).toMatchObject({
      status: "complete",
      origin: "generated",
    });
  });

  it("copy reutilizada conclui com origem reused (nunca gerada)", () => {
    const outcome: CopyOutcome = {
      kind: "completed",
      attemptSeq: 1,
      text: "Texto persistido",
      payload: null,
      origin: "reused",
    };
    expect(copyProgressFor(outcome)).toEqual({
      status: "complete",
      origin: "reused",
    });
  });

  it("falha confirmada vira failed (nunca sucesso)", () => {
    const outcome: CopyOutcome = {
      kind: "failed",
      attemptSeq: 1,
      failureClass: "definitive",
      unconfirmed: false,
    };
    expect(copyProgressFor(outcome)).toMatchObject({
      status: "failed",
      reason: "copy_failed",
      failureClass: "definitive",
    });
  });

  it("indisponibilidade vira failed com motivo fechado", () => {
    const outcome: CopyOutcome = {
      kind: "unavailable",
      reason: "budget_exhausted",
    };
    expect(copyProgressFor(outcome)).toEqual({
      status: "failed",
      reason: "copy_unavailable:budget_exhausted",
    });
  });

  it("copy em andamento/espera vira skipped (sem spinner indefinido)", () => {
    expect(copyProgressFor({ kind: "in_progress" })).toEqual({
      status: "skipped",
      reason: "in_progress",
    });
    expect(copyProgressFor({ kind: "waiting", waitRemainingMs: 10 })).toEqual({
      status: "skipped",
      reason: "waiting",
    });
  });

  it("copy não solicitada vira skipped not_requested", () => {
    expect(copyProgressFor({ kind: "not_requested" })).toEqual({
      status: "skipped",
      reason: "not_requested",
    });
  });
});
