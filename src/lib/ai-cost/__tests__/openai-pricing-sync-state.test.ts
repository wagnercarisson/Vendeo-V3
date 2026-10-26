import { describe, expect, it } from "vitest";
import {
  derivePricingSyncState,
  PRICING_SYNC_STALE_MS,
  type PricingSyncAttemptSummary,
} from "../openai-pricing-sync-state";

const NOW = new Date("2026-10-26T20:00:00.000Z");

function attempt(
  overrides: Partial<PricingSyncAttemptSummary> = {},
): PricingSyncAttemptSummary {
  return {
    id: "attempt-1",
    status: "success",
    startedAt: "2026-10-26T19:00:00.000Z",
    finishedAt: "2026-10-26T19:01:00.000Z",
    failureStage: null,
    failureCode: null,
    ...overrides,
  };
}

describe("derivePricingSyncState — sucesso, falha e atraso", () => {
  it("sucesso fresco sem falha posterior → fresh (sem aviso)", () => {
    expect(
      derivePricingSyncState({ attempts: [attempt()], now: NOW }),
    ).toMatchObject({
      kind: "fresh",
      lastSuccessAt: "2026-10-26T19:01:00.000Z",
      lastAttemptStatus: "success",
    });
  });

  it("falha depois do último sucesso → failed até novo sucesso", () => {
    const state = derivePricingSyncState({
      attempts: [
        attempt({
          id: "attempt-fail",
          status: "failed",
          startedAt: "2026-10-26T19:20:00.000Z",
          finishedAt: "2026-10-26T19:21:00.000Z",
          failureStage: "fetch",
          failureCode: "fetch_timeout",
        }),
        attempt(),
      ],
      now: NOW,
    });

    expect(state).toMatchObject({
      kind: "failed",
      lastSuccessAt: "2026-10-26T19:01:00.000Z",
      lastAttemptStatus: "failed",
    });
  });

  it("última confirmação > 36h → stale", () => {
    const old = new Date(NOW.getTime() - PRICING_SYNC_STALE_MS - 60_000).toISOString();
    expect(
      derivePricingSyncState({
        attempts: [attempt({ startedAt: old, finishedAt: old })],
        now: NOW,
      }),
    ).toMatchObject({ kind: "stale" });
  });

  it("sem tentativas → never", () => {
    expect(
      derivePricingSyncState({ attempts: [], now: NOW }),
    ).toMatchObject({ kind: "never", lastSuccessAt: null, lastAttemptAt: null });
  });

  it("falha sem nenhum sucesso → never com última tentativa", () => {
    const state = derivePricingSyncState({
      attempts: [
        attempt({
          status: "failed",
          startedAt: "2026-10-26T19:30:00.000Z",
          finishedAt: "2026-10-26T19:31:00.000Z",
          failureStage: "parse",
          failureCode: "parse_missing_model",
        }),
      ],
      now: NOW,
    });

    expect(state).toMatchObject({
      kind: "never",
      lastSuccessAt: null,
      lastAttemptStatus: "failed",
    });
  });

  it("running recente → running; running > 15min → interrupted", () => {
    expect(
      derivePricingSyncState({
        attempts: [
          attempt({
            status: "running",
            startedAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
            finishedAt: null,
          }),
        ],
        now: NOW,
      }),
    ).toMatchObject({ kind: "running" });

    expect(
      derivePricingSyncState({
        attempts: [
          attempt({
            status: "running",
            startedAt: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
            finishedAt: null,
          }),
        ],
        now: NOW,
      }),
    ).toMatchObject({ kind: "interrupted" });
  });

  it("falha de consulta ao estado → unavailable (nunca atualizado)", () => {
    expect(
      derivePricingSyncState({ attempts: [attempt()], now: NOW, queryFailed: true }),
    ).toMatchObject({ kind: "unavailable" });
  });

  it("sucesso posterior remove o aviso de falha", () => {
    const state = derivePricingSyncState({
      attempts: [
        attempt({
          id: "attempt-success-2",
          startedAt: "2026-10-26T19:40:00.000Z",
          finishedAt: "2026-10-26T19:41:00.000Z",
        }),
        attempt({
          id: "attempt-fail",
          status: "failed",
          startedAt: "2026-10-26T19:20:00.000Z",
          finishedAt: "2026-10-26T19:21:00.000Z",
        }),
      ],
      now: NOW,
    });

    expect(state.kind).toBe("fresh");
    expect(state.lastSuccessAt).toBe("2026-10-26T19:41:00.000Z");
  });
});
