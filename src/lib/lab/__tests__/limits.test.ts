// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  DEFAULT_MAX_RUNS_PER_EXPERIMENT,
  LAB_ARTIFACT_RETENTION_DAYS,
  LAB_RUN_STALE_MS,
  MAX_CONCURRENT_LAB_RUNS,
  MAX_REPETITIONS,
  MAX_RUNS_PER_EXPERIMENT,
  MAX_SCENARIOS_PER_EXPERIMENT,
} from "../limits";

/**
 * Constantes de limite do laboratório (F48.1, D14) — valores travados pela fase.
 * A suíte falha se qualquer valor mudar, garantindo que domínio/API/UI/banco
 * permaneçam alinhados com o design.
 */

describe("limits — valores travados da fase (D14)", () => {
  it("MAX_SCENARIOS_PER_EXPERIMENT === 3", () => {
    expect(MAX_SCENARIOS_PER_EXPERIMENT).toBe(3);
  });

  it("MAX_REPETITIONS === 3", () => {
    expect(MAX_REPETITIONS).toBe(3);
  });

  it("MAX_RUNS_PER_EXPERIMENT === 12", () => {
    expect(MAX_RUNS_PER_EXPERIMENT).toBe(12);
  });

  it("DEFAULT_MAX_RUNS_PER_EXPERIMENT === 6", () => {
    expect(DEFAULT_MAX_RUNS_PER_EXPERIMENT).toBe(6);
  });

  it("MAX_CONCURRENT_LAB_RUNS === 1 (exclusão mútua global)", () => {
    expect(MAX_CONCURRENT_LAB_RUNS).toBe(1);
  });

  it("LAB_RUN_STALE_MS === 15 * 60 * 1000", () => {
    expect(LAB_RUN_STALE_MS).toBe(900000);
    expect(LAB_RUN_STALE_MS).toBe(15 * 60 * 1000);
  });

  it("LAB_ARTIFACT_RETENTION_DAYS === 30", () => {
    expect(LAB_ARTIFACT_RETENTION_DAYS).toBe(30);
  });
});

describe("limits — invariantes entre constantes", () => {
  it("o default de max_runs nunca excede o teto absoluto", () => {
    expect(DEFAULT_MAX_RUNS_PER_EXPERIMENT).toBeLessThanOrEqual(MAX_RUNS_PER_EXPERIMENT);
  });

  it("o teto é divisível pelo número de repetições (12 = 3 × 4 combinações)", () => {
    expect(MAX_RUNS_PER_EXPERIMENT % MAX_REPETITIONS).toBe(0);
    expect(MAX_RUNS_PER_EXPERIMENT / MAX_REPETITIONS).toBe(4);
  });

  it("o default de max_runs é divisível pelo número de repetições", () => {
    expect(DEFAULT_MAX_RUNS_PER_EXPERIMENT % MAX_REPETITIONS).toBe(0);
  });

  it("os limites de cenários e repetições são positivos", () => {
    expect(MAX_SCENARIOS_PER_EXPERIMENT).toBeGreaterThan(0);
    expect(MAX_REPETITIONS).toBeGreaterThan(0);
    expect(MAX_CONCURRENT_LAB_RUNS).toBeGreaterThan(0);
    expect(LAB_RUN_STALE_MS).toBeGreaterThan(0);
    expect(LAB_ARTIFACT_RETENTION_DAYS).toBeGreaterThan(0);
  });
});
