// @vitest-environment node
import { describe, it, expect } from "vitest";

import { LAB_ARTIFACT_RETENTION_DAYS } from "@/lib/lab/limits";

import {
  DEFAULT_RETENTION_DAYS,
  isRunInProgress,
  main,
  parseArtifactStoragePath,
  partitionArtifacts,
  resolveRetentionDays,
  selectEligibleArtifacts,
} from "../48-cleanup-artifacts.mjs";

/**
 * Regra de elegibilidade do cleanup manual do laboratório (F48.1, D10).
 *
 * Testa apenas as funções puras — nenhuma chamada de rede e nenhum `process.exit`.
 * A proteção de run em andamento e a preservação de metadados/histórico são
 * invariantes críticos (T-48-1-45/T-48-1-46).
 */

const NOW = new Date("2026-09-16T12:00:00.000Z");
const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const STORAGE_PATH = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;

function artifact(overrides = {}) {
  return {
    id: "artifact-1",
    run_id: RUN_ID,
    storage_path: STORAGE_PATH,
    removed_at: null,
    ...overrides,
  };
}

function run(overrides = {}) {
  return {
    status: "succeeded",
    created_at: "2026-01-01T00:00:00.000Z",
    finished_at: "2026-01-01T00:00:00.000Z",
    experiment_id: EXPERIMENT_ID,
    experiment_status: "evaluated",
    ...overrides,
  };
}

function runsMap(entries) {
  return new Map(entries);
}

function select(artifacts, entries, retentionDays = DEFAULT_RETENTION_DAYS) {
  return selectEligibleArtifacts({
    artifacts,
    runsById: runsMap(entries),
    now: NOW,
    retentionDays,
  });
}

// ─── isRunInProgress ─────────────────────────────────────────────────────────

describe("isRunInProgress", () => {
  it("protege os dois estados ativos", () => {
    expect(isRunInProgress("pending")).toBe(true);
    expect(isRunInProgress("running")).toBe(true);
  });

  it("libera os quatro estados terminais", () => {
    expect(isRunInProgress("succeeded")).toBe(false);
    expect(isRunInProgress("failed")).toBe(false);
    expect(isRunInProgress("cancelled")).toBe(false);
    expect(isRunInProgress("timeout")).toBe(false);
  });
});

// ─── selectEligibleArtifacts ─────────────────────────────────────────────────

describe("selectEligibleArtifacts", () => {
  it("nunca é elegível para run pending, mesmo antigo", () => {
    const result = select([artifact()], [[RUN_ID, run({ status: "pending" })]]);
    expect(result).toEqual([]);
  });

  it("nunca é elegível para run running, mesmo antigo", () => {
    const result = select([artifact()], [[RUN_ID, run({ status: "running" })]]);
    expect(result).toEqual([]);
  });

  it("é elegível para run succeeded mais antigo que a retenção", () => {
    const result = select([artifact()], [[RUN_ID, run({ status: "succeeded" })]]);
    expect(result).toEqual([{ artifactId: "artifact-1", storagePath: STORAGE_PATH }]);
  });

  it("não é elegível para run succeeded recente", () => {
    const recent = run({ status: "succeeded", finished_at: "2026-09-15T00:00:00.000Z" });
    const result = select([artifact()], [[RUN_ID, recent]]);
    expect(result).toEqual([]);
  });

  it("é elegível para run terminal de experimento arquivado mesmo recente", () => {
    const archived = run({
      status: "failed",
      finished_at: "2026-09-15T00:00:00.000Z",
      experiment_status: "archived",
    });
    const result = select([artifact()], [[RUN_ID, archived]]);
    expect(result).toEqual([{ artifactId: "artifact-1", storagePath: STORAGE_PATH }]);
  });

  it("ignora artefato já removido", () => {
    const removed = artifact({ removed_at: "2026-09-10T00:00:00.000Z" });
    const result = select([removed], [[RUN_ID, run()]]);
    expect(result).toEqual([]);
  });

  it("ignora artefato cujo run não existe no conjunto lido", () => {
    const result = select([artifact()], []);
    expect(result).toEqual([]);
  });

  it("usa created_at quando finished_at é nulo", () => {
    const noFinishedAt = run({ status: "succeeded", finished_at: null });
    const result = select([artifact()], [[RUN_ID, noFinishedAt]]);
    expect(result).toEqual([{ artifactId: "artifact-1", storagePath: STORAGE_PATH }]);
  });

  it("respeita a retenção configurada (run de 2 dias com retenção 1)", () => {
    const twoDaysAgo = run({ status: "succeeded", finished_at: "2026-09-14T00:00:00.000Z" });
    const result = select([artifact()], [[RUN_ID, twoDaysAgo]], 1);
    expect(result).toEqual([{ artifactId: "artifact-1", storagePath: STORAGE_PATH }]);
  });
});

// ─── Validação do storage_path (T-48-1-48) ───────────────────────────────────

describe("parseArtifactStoragePath", () => {
  it("aceita os formatos canônicos (output e inputs)", () => {
    expect(parseArtifactStoragePath(STORAGE_PATH)).toEqual({
      experimentId: EXPERIMENT_ID,
      runId: RUN_ID,
    });
    expect(
      parseArtifactStoragePath(`experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.jpg`),
    ).not.toBeNull();
    expect(
      parseArtifactStoragePath(`experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.webp`),
    ).not.toBeNull();
    expect(
      parseArtifactStoragePath(`experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/inputs/0.jpg`),
    ).not.toBeNull();
  });

  it("rejeita paths malformados, fora do prefixo ou de outro bucket", () => {
    expect(parseArtifactStoragePath("")).toBeNull();
    expect(parseArtifactStoragePath("experiments/../etc/passwd")).toBeNull();
    expect(parseArtifactStoragePath("campaign-images/store/campaign.jpg")).toBeNull();
    expect(parseArtifactStoragePath("runs/abc/output.png")).toBeNull();
    expect(parseArtifactStoragePath(`experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.gif`)).toBeNull();
    expect(parseArtifactStoragePath(`experiments/not-a-uuid/runs/${RUN_ID}/output.png`)).toBeNull();
    expect(parseArtifactStoragePath(null)).toBeNull();
  });
});

describe("partitionArtifacts — path incompatível nunca é elegível", () => {
  const OTHER_RUN = "33333333-3333-4333-8333-333333333333";
  const OTHER_EXPERIMENT = "44444444-4444-4444-8444-444444444444";

  function partition(artifacts, entries, retentionDays = DEFAULT_RETENTION_DAYS) {
    return partitionArtifacts({
      artifacts,
      runsById: runsMap(entries),
      now: NOW,
      retentionDays,
    });
  }

  it("path apontando para OUTRO run é ignorado e reportado como invalid", () => {
    // Registro do run terminal RUN_ID, mas o path aponta para o arquivo de outro run.
    const mismatched = artifact({
      storage_path: `experiments/${EXPERIMENT_ID}/runs/${OTHER_RUN}/output.png`,
    });

    const { eligible, invalid } = partition([mismatched], [[RUN_ID, run()]]);

    expect(eligible).toEqual([]);
    expect(invalid).toEqual([
      {
        artifactId: "artifact-1",
        storagePath: `experiments/${EXPERIMENT_ID}/runs/${OTHER_RUN}/output.png`,
      },
    ]);
  });

  it("path apontando para OUTRO experimento é ignorado e reportado como invalid", () => {
    const mismatched = artifact({
      storage_path: `experiments/${OTHER_EXPERIMENT}/runs/${RUN_ID}/output.png`,
    });

    const { eligible, invalid } = partition([mismatched], [[RUN_ID, run()]]);

    expect(eligible).toEqual([]);
    expect(invalid).toHaveLength(1);
  });

  it("path malformado é ignorado e reportado como invalid", () => {
    const malformed = artifact({ storage_path: "campaign-images/loja/campanha.jpg" });

    const { eligible, invalid } = partition([malformed], [[RUN_ID, run()]]);

    expect(eligible).toEqual([]);
    expect(invalid).toHaveLength(1);
  });

  it("path canônico e coerente com run terminal antigo é elegível", () => {
    const { eligible, invalid } = partition([artifact()], [[RUN_ID, run()]]);

    expect(eligible).toEqual([{ artifactId: "artifact-1", storagePath: STORAGE_PATH }]);
    expect(invalid).toEqual([]);
  });

  it("selectEligibleArtifacts continua devolvendo apenas os elegíveis", () => {
    const mismatched = artifact({
      id: "artifact-bad",
      storage_path: `experiments/${EXPERIMENT_ID}/runs/${OTHER_RUN}/output.png`,
    });
    const good = artifact({ id: "artifact-good" });

    const result = select([good, mismatched], [[RUN_ID, run()]]);

    expect(result).toEqual([{ artifactId: "artifact-good", storagePath: STORAGE_PATH }]);
  });
});

// ─── Paridade de retenção ────────────────────────────────────────────────────

describe("retenção", () => {
  it("o default do script é igual a LAB_ARTIFACT_RETENTION_DAYS", () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(LAB_ARTIFACT_RETENTION_DAYS);
    expect(DEFAULT_RETENTION_DAYS).toBe(30);
  });

  it("resolveRetentionDays usa o ambiente e cai no default", () => {
    expect(resolveRetentionDays(undefined)).toBe(DEFAULT_RETENTION_DAYS);
    expect(resolveRetentionDays("7")).toBe(7);
    expect(resolveRetentionDays("invalido")).toBe(DEFAULT_RETENTION_DAYS);
  });
});

// ─── Ausência de efeito colateral no import ──────────────────────────────────

describe("módulo de cleanup", () => {
  it("importar não executa a CLI nem mexe em process.exitCode", async () => {
    const exitCodeBefore = process.exitCode;
    const mod = await import("../48-cleanup-artifacts.mjs");

    expect(typeof mod.main).toBe("function");
    expect(typeof mod.selectEligibleArtifacts).toBe("function");
    expect(typeof mod.isRunInProgress).toBe("function");
    expect(process.exitCode).toBe(exitCodeBefore);
  });

  it("main recusa host não local antes de qualquer leitura", async () => {
    await expect(
      main([], {
        NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      }),
    ).rejects.toThrow(/producao|nao local/);
  });

  it("main recusa URL ausente e service role ausente", async () => {
    await expect(main([], {})).rejects.toThrow("NEXT_PUBLIC_SUPABASE_URL");
    await expect(
      main([], { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }),
    ).rejects.toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });
});
