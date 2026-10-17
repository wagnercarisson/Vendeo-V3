// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  classifyPreservation,
  type PreservationState,
} from "../pilot/spend-preservation";

function state(over: Partial<PreservationState> = {}): PreservationState {
  return {
    spent_usd: 1.75,
    cap_usd: 5,
    cap_set_by: "admin",
    cap_reason: "B",
    cap_operation_id: "op-b",
    cap_set_at: "2026-10-16T00:00:00.000Z",
    blocked_reason: null,
    blocked_at: null,
    ...over,
  };
}

describe("F56.2b2c — guarda de preservação (todos os campos restaurados)", () => {
  it("ok quando current = expected (incl. campos de teto)", () => {
    expect(classifyPreservation({ current: state(), expected: state() })).toEqual({ ok: true });
  });

  it("detecta concorrência externa de GASTO", () => {
    expect(
      classifyPreservation({ current: state({ spent_usd: 2.05 }), expected: state({ spent_usd: 1.75 }) }),
    ).toEqual({ ok: false, reason: "spent_divergence" });
  });

  it("valores não finitos de gasto", () => {
    expect(
      classifyPreservation({ current: state({ spent_usd: Number.NaN }), expected: state() }),
    ).toEqual({ ok: false, reason: "spent_not_finite" });
  });

  it("detecta divergência em campos de TETO (não só gasto/bloqueio)", () => {
    expect(
      classifyPreservation({ current: state({ cap_usd: 9 }), expected: state({ cap_usd: 5 }) }),
    ).toEqual({ ok: false, reason: "cap_usd_divergence" });
    expect(
      classifyPreservation({ current: state({ cap_reason: "externo" }), expected: state() }),
    ).toEqual({ ok: false, reason: "cap_reason_divergence" });
    expect(
      classifyPreservation({
        current: state({ cap_set_at: "2026-10-16T10:00:00.000Z" }),
        expected: state(),
      }),
    ).toEqual({ ok: false, reason: "cap_set_at_divergence" });
    expect(
      classifyPreservation({ current: state({ cap_set_by: "outro" }), expected: state() }),
    ).toEqual({ ok: false, reason: "cap_set_by_divergence" });
  });

  it("detecta bloqueio inesperado", () => {
    expect(
      classifyPreservation({
        current: state({ blocked_reason: "mark_unknown_failed:timeout" }),
        expected: state(),
      }),
    ).toEqual({ ok: false, reason: "blocked_reason_divergence" });
  });

  it("cap_usd null vs número ⇒ divergência", () => {
    expect(
      classifyPreservation({ current: state({ cap_usd: null }), expected: state({ cap_usd: 5 }) }),
    ).toEqual({ ok: false, reason: "cap_usd_divergence" });
  });
});
