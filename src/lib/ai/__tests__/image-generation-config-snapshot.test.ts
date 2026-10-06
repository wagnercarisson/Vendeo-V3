import { describe, expect, it } from "vitest";

import {
  IMAGE_GENERATION_CONFIG_ORIGINS,
  ImageGenerationConfigMissingError,
  ImageGenerationConfigOriginInvalidError,
  buildImageGenerationConfigSnapshot,
  correlateSnapshotWithTelemetry,
  isLegacyOperationWithoutSnapshot,
  resolveConfigForCorrection,
  resolveConfigForNewCampaign,
  resolveSnapshotPairForTarget,
  type CurrentImageGenerationConfig,
} from "../image-generation-config-snapshot";
import type { ImageModelPairConfig } from "../image-model-pair";

const PAIR_CONFIG: ImageModelPairConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
};

const FIXED_NOW = () => "2026-10-06T00:00:00.000Z";

describe("image-generation-config-snapshot — builder tipado (F56.1 D-12)", () => {
  it("monta o snapshot com os dois pares, versão da configuração e origem", () => {
    const snapshot = buildImageGenerationConfigSnapshot(PAIR_CONFIG, {
      campaignId: "camp-1",
      origin: "human_decision",
      configVersionId: "cfg-v1",
      now: FIXED_NOW,
    });

    expect(snapshot).toEqual({
      campaignId: "camp-1",
      primaryModel: "gpt-image-2.5-sunburst",
      primaryQuality: "medium",
      fallbackModel: "gpt-image-2",
      fallbackQuality: "medium",
      configVersionId: "cfg-v1",
      origin: "human_decision",
      createdAt: "2026-10-06T00:00:00.000Z",
    });
  });

  it("usa o gerador de versão injetável quando a configuração não traz a versão", () => {
    const snapshot = buildImageGenerationConfigSnapshot(PAIR_CONFIG, {
      campaignId: "camp-1",
      origin: "selection",
      generateVersionId: () => "gerado",
      now: FIXED_NOW,
    });

    expect(snapshot.configVersionId).toBe("gerado");
  });

  it("aceita apenas as origens human_decision e selection — sem default", () => {
    expect([...IMAGE_GENERATION_CONFIG_ORIGINS]).toEqual(["human_decision", "selection"]);
  });

  it("rejeita a origem 'default' em runtime (fail-closed, D-12)", () => {
    expect(() =>
      buildImageGenerationConfigSnapshot(PAIR_CONFIG, {
        campaignId: "camp-1",
        origin: "default" as never,
        now: FIXED_NOW,
      }),
    ).toThrow(ImageGenerationConfigOriginInvalidError);
  });

  it("trata a ausência de configuração como erro, não como origem (D-12)", () => {
    expect(() =>
      buildImageGenerationConfigSnapshot(null as never, {
        campaignId: "camp-1",
        origin: "selection",
        now: FIXED_NOW,
      }),
    ).toThrow(ImageGenerationConfigMissingError);
  });
});

describe("image-generation-config-snapshot — resolução por tipo de operação (F56.1 D-13)", () => {
  const currentConfig: CurrentImageGenerationConfig = {
    ...PAIR_CONFIG,
    origin: "selection",
    configVersionId: "cfg-v1",
  };

  it("nova campanha congela a configuração vigente com a sua origem e versão", () => {
    const snapshot = resolveConfigForNewCampaign(currentConfig, "camp-novo", {
      now: FIXED_NOW,
    });

    expect(snapshot.campaignId).toBe("camp-novo");
    expect(snapshot.primaryModel).toBe("gpt-image-2.5-sunburst");
    expect(snapshot.primaryQuality).toBe("medium");
    expect(snapshot.fallbackModel).toBe("gpt-image-2");
    expect(snapshot.fallbackQuality).toBe("medium");
    expect(snapshot.origin).toBe("selection");
    expect(snapshot.configVersionId).toBe("cfg-v1");
  });

  it("correção reutiliza exatamente o snapshot original, sem configuração vigente", () => {
    const original = resolveConfigForNewCampaign(currentConfig, "camp-novo", {
      now: FIXED_NOW,
    });

    const corrected = resolveConfigForCorrection(original);

    expect(corrected).toBe(original);
    expect(corrected?.configVersionId).toBe("cfg-v1");
  });
});

describe("image-generation-config-snapshot — imutabilidade lógica (F56.1 D-13)", () => {
  it("alterar a configuração vigente depois não modifica um snapshot já montado", () => {
    const current: CurrentImageGenerationConfig = {
      primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
      fallback: { model: "gpt-image-2", quality: "medium" },
      origin: "selection",
      configVersionId: "cfg-v1",
    };

    const snapshot = resolveConfigForNewCampaign(current, "camp-1", { now: FIXED_NOW });

    // A fonte muda depois de o snapshot ter sido montado.
    current.primary.model = "gpt-image-2";
    current.configVersionId = "cfg-v2";

    expect(snapshot.primaryModel).toBe("gpt-image-2.5-sunburst");
    expect(snapshot.configVersionId).toBe("cfg-v1");
  });

  it("o snapshot retornado é congelado (imutável)", () => {
    const snapshot = resolveConfigForNewCampaign(
      { ...PAIR_CONFIG, origin: "human_decision", configVersionId: "cfg-v1" },
      "camp-1",
      { now: FIXED_NOW },
    );

    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("nova campanha após mudança do admin usa a vigente e não altera snapshots anteriores", () => {
    const before: CurrentImageGenerationConfig = {
      primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
      fallback: { model: "gpt-image-2", quality: "medium" },
      origin: "selection",
      configVersionId: "cfg-v1",
    };
    const snapshotBefore = resolveConfigForNewCampaign(before, "camp-A", { now: FIXED_NOW });

    const after: CurrentImageGenerationConfig = {
      primary: { model: "gpt-image-2", quality: "low" },
      fallback: { model: "gpt-image-2", quality: "medium" },
      origin: "selection",
      configVersionId: "cfg-v2",
    };
    const snapshotAfter = resolveConfigForNewCampaign(after, "camp-B", { now: FIXED_NOW });

    expect(snapshotAfter.primaryModel).toBe("gpt-image-2");
    expect(snapshotAfter.primaryQuality).toBe("low");
    expect(snapshotAfter.configVersionId).toBe("cfg-v2");
    expect(snapshotBefore.primaryModel).toBe("gpt-image-2.5-sunburst");
    expect(snapshotBefore.configVersionId).toBe("cfg-v1");
  });

  it("correção da mesma campanha reutiliza o snapshot original e NÃO adota a vigente", () => {
    const original = resolveConfigForNewCampaign(
      { ...PAIR_CONFIG, origin: "human_decision", configVersionId: "cfg-v1" },
      "camp-A",
      { now: FIXED_NOW },
    );

    const changedVigente: CurrentImageGenerationConfig = {
      primary: { model: "gpt-image-2", quality: "low" },
      fallback: { model: "gpt-image-2", quality: "low" },
      origin: "selection",
      configVersionId: "cfg-v2",
    };

    const corrected = resolveConfigForCorrection(original);

    expect(corrected).toBe(original);
    expect(corrected?.primaryModel).toBe("gpt-image-2.5-sunburst");
    expect(corrected?.primaryModel).not.toBe(changedVigente.primary.model);
    expect(corrected?.configVersionId).toBe("cfg-v1");
    // A configuração vigente permanece intacta para novas campanhas.
    expect(changedVigente.primary.model).toBe("gpt-image-2");
  });
});

describe("image-generation-config-snapshot — correlação run/trace com a telemetria (F56.1 D-14)", () => {
  const snapshot = buildImageGenerationConfigSnapshot(PAIR_CONFIG, {
    campaignId: "camp-1",
    origin: "human_decision",
    configVersionId: "cfg-v1",
    runId: "run-1",
    traceId: "trace-1",
    now: FIXED_NOW,
  });

  it("reconstrói o par modelo–qualidade por tentativa a partir do snapshot", () => {
    const attempts = [
      { runId: "run-1", traceId: "trace-1", attemptNumber: 1, target: "primary" as const },
      { runId: "run-1", traceId: "trace-1", attemptNumber: 2, target: "primary" as const },
      { runId: "run-1", traceId: "trace-1", attemptNumber: 3, target: "fallback" as const },
    ];

    const correlated = correlateSnapshotWithTelemetry(snapshot, attempts);

    expect(correlated).toEqual([
      { attemptNumber: 1, target: "primary", model: "gpt-image-2.5-sunburst", quality: "medium" },
      { attemptNumber: 2, target: "primary", model: "gpt-image-2.5-sunburst", quality: "medium" },
      { attemptNumber: 3, target: "fallback", model: "gpt-image-2", quality: "medium" },
    ]);
  });

  it("resolve o par congelado do alvo a partir do snapshot", () => {
    expect(resolveSnapshotPairForTarget(snapshot, "primary")).toEqual({
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });
    expect(resolveSnapshotPairForTarget(snapshot, "fallback")).toEqual({
      model: "gpt-image-2",
      quality: "medium",
    });
  });

  it("descarta tentativas de outro run/trace (correlação pelo par de operação)", () => {
    const attempts = [
      { runId: "run-1", traceId: "trace-1", attemptNumber: 1, target: "primary" as const },
      { runId: "run-outro", traceId: "trace-1", attemptNumber: 1, target: "primary" as const },
    ];

    const correlated = correlateSnapshotWithTelemetry(snapshot, attempts);

    expect(correlated).toHaveLength(1);
    expect(correlated[0]?.attemptNumber).toBe(1);
  });

  it("NÃO correlaciona tentativa sem runId quando o snapshot exige runId (fail-closed)", () => {
    const attempts = [{ traceId: "trace-1", attemptNumber: 1, target: "primary" as const }];

    expect(correlateSnapshotWithTelemetry(snapshot, attempts)).toEqual([]);
  });

  it("NÃO correlaciona tentativa sem traceId quando o snapshot exige traceId (fail-closed)", () => {
    const attempts = [{ runId: "run-1", attemptNumber: 1, target: "primary" as const }];

    expect(correlateSnapshotWithTelemetry(snapshot, attempts)).toEqual([]);
  });

  it("correlaciona tentativa com run e trace presentes e iguais (regressão)", () => {
    const attempts = [
      { runId: "run-1", traceId: "trace-1", attemptNumber: 1, target: "primary" as const },
    ];

    expect(correlateSnapshotWithTelemetry(snapshot, attempts)).toHaveLength(1);
  });

  it("snapshot com apenas runId exige runId presente e igual na tentativa", () => {
    const runOnlySnapshot = buildImageGenerationConfigSnapshot(PAIR_CONFIG, {
      campaignId: "camp-1",
      origin: "human_decision",
      configVersionId: "cfg-v1",
      runId: "run-1",
      now: FIXED_NOW,
    });

    const semRunId = [{ traceId: "trace-1", attemptNumber: 1, target: "primary" as const }];
    expect(correlateSnapshotWithTelemetry(runOnlySnapshot, semRunId)).toEqual([]);

    const comRunId = [{ runId: "run-1", attemptNumber: 1, target: "primary" as const }];
    expect(correlateSnapshotWithTelemetry(runOnlySnapshot, comRunId)).toHaveLength(1);
  });

  it("snapshot sem runId e sem traceId NÃO correlaciona nenhuma tentativa (fail-closed)", () => {
    const bareSnapshot = buildImageGenerationConfigSnapshot(PAIR_CONFIG, {
      campaignId: "camp-1",
      origin: "human_decision",
      configVersionId: "cfg-v1",
      now: FIXED_NOW,
    });

    const attempts = [
      { runId: "run-1", traceId: "trace-1", attemptNumber: 1, target: "primary" as const },
      { attemptNumber: 2, target: "fallback" as const },
    ];

    expect(correlateSnapshotWithTelemetry(bareSnapshot, attempts)).toEqual([]);
  });
});

describe("image-generation-config-snapshot — tolerância a operações legadas (F56.1 D-14)", () => {
  it("operação legada sem snapshot não gera erro e é tratada como estado esperado", () => {
    expect(() => resolveConfigForCorrection(undefined)).not.toThrow();
    expect(resolveConfigForCorrection(undefined)).toBeNull();
    expect(resolveConfigForCorrection(null)).toBeNull();
  });

  it("reconhece a ausência de snapshot como operação legada", () => {
    expect(isLegacyOperationWithoutSnapshot(null)).toBe(true);
    expect(isLegacyOperationWithoutSnapshot(undefined)).toBe(true);
  });
});
