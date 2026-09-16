// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";

import {
  MISSING_SNAPSHOT,
  assertSnapshotComplete,
  buildLabRunSnapshot,
  readCodeVersion,
} from "../run-snapshot";
import type { LabRunSnapshot } from "../run-snapshot";
import type { LabPromptSnapshot } from "../domain/prompt-snapshot";

/**
 * Snapshot imutável do run (F48.1, D8). Módulo puro — nenhuma rede.
 */

const BASELINE: LabPromptSnapshot = {
  name: "campaign-image-director-offer",
  content: "conteudo oficial do diretor",
  contentHash: "a".repeat(64),
  source: "official",
};

const CANDIDATE: LabPromptSnapshot = {
  name: "campaign-image-director-offer",
  content: "conteudo candidato alterado",
  contentHash: "b".repeat(64),
  source: "override",
};

function validSnapshot(overrides: Partial<LabRunSnapshot> = {}): LabRunSnapshot {
  return {
    ...buildLabRunSnapshot({
      scenarioVersionId: "11111111-1111-4111-8111-111111111111",
      scenarioVersion: 1,
      scenarioContentHash: "c".repeat(64),
      prompt: CANDIDATE,
      modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
      params: { size: "1024x1024", quality: "auto", skipInputValidation: true },
      variantRole: "candidate",
      variants: { baseline: BASELINE, candidate: CANDIDATE },
      codeVersion: null,
    }),
    ...overrides,
  };
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      keys.push(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildLabRunSnapshot — configuração congelada", () => {
  it("fixa runType, capability, changedDimension e o papel da variante", () => {
    const snapshot = validSnapshot();

    expect(snapshot.runType).toBe("lab");
    expect(snapshot.capability).toBe("campaign_image");
    expect(snapshot.changedDimension).toBe("prompt");
    expect(snapshot.variantRole).toBe("candidate");
    expect(snapshot.params.skipInputValidation).toBe(true);
  });

  it("congela prompt, cenário e alvo de modelo recebidos", () => {
    const snapshot = validSnapshot();

    expect(snapshot.prompt).toEqual(CANDIDATE);
    expect(snapshot.scenarioVersionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(snapshot.scenarioVersion).toBe(1);
    expect(snapshot.modelTarget).toEqual({
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
    });
  });

  it("guarda apenas nome/hash/origem nas configs comparativas (sem duplicar conteúdo)", () => {
    const snapshot = validSnapshot();

    expect(snapshot.baselineConfig).toEqual({
      promptName: BASELINE.name,
      promptContentHash: BASELINE.contentHash,
      source: "official",
    });
    expect(snapshot.candidateConfig).toEqual({
      promptName: CANDIDATE.name,
      promptContentHash: CANDIDATE.contentHash,
      source: "override",
    });
  });

  it("não inclui nenhuma chave de imagem/base64 no objeto congelado", () => {
    const keys = collectKeys(validSnapshot());

    expect(keys.filter((key) => /base64|dataurl/i.test(key))).toEqual([]);
  });

  it("codeVersion é null quando não há versão de build", () => {
    expect(validSnapshot().codeVersion).toBeNull();
  });
});

describe("assertSnapshotComplete — barreira antes da reserva", () => {
  it("aceita o snapshot completo", () => {
    expect(() => assertSnapshotComplete(validSnapshot())).not.toThrow();
  });

  it("recusa snapshot ausente", () => {
    expect(() => assertSnapshotComplete(null)).toThrow(MISSING_SNAPSHOT);
  });

  it("recusa objeto vazio", () => {
    expect(() => assertSnapshotComplete({} as LabRunSnapshot)).toThrow(MISSING_SNAPSHOT);
  });

  it("recusa prompt.content vazio", () => {
    const snapshot = validSnapshot();
    snapshot.prompt = { ...snapshot.prompt, content: "" };

    expect(() => assertSnapshotComplete(snapshot)).toThrow(MISSING_SNAPSHOT);
  });

  it("recusa prompt.contentHash vazio", () => {
    const snapshot = validSnapshot();
    snapshot.prompt = { ...snapshot.prompt, contentHash: "" };

    expect(() => assertSnapshotComplete(snapshot)).toThrow(MISSING_SNAPSHOT);
  });

  it("recusa modelTarget.protocol vazio", () => {
    const snapshot = validSnapshot();
    snapshot.modelTarget = { ...snapshot.modelTarget, protocol: "" };

    expect(() => assertSnapshotComplete(snapshot)).toThrow(MISSING_SNAPSHOT);
  });

  it("recusa variantRole inválido", () => {
    const snapshot = validSnapshot();
    snapshot.variantRole = "invalid" as unknown as LabRunSnapshot["variantRole"];

    expect(() => assertSnapshotComplete(snapshot)).toThrow(MISSING_SNAPSHOT);
  });

  it("recusa scenarioVersionId vazio", () => {
    const snapshot = validSnapshot();
    snapshot.scenarioVersionId = "";

    expect(() => assertSnapshotComplete(snapshot)).toThrow(MISSING_SNAPSHOT);
  });
});

describe("readCodeVersion — versão de build", () => {
  it("devolve null quando nenhuma variável de build existe", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("GIT_SHA", "");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");

    expect(readCodeVersion()).toBeNull();
  });

  it("devolve gitSha quando VERCEL_GIT_COMMIT_SHA está setado", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123");

    expect(readCodeVersion()).toEqual({ gitSha: "abc123" });
  });

  it("devolve buildId quando VERCEL_DEPLOYMENT_ID está setado", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("GIT_SHA", "");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_42");

    expect(readCodeVersion()).toEqual({ buildId: "dpl_42" });
  });
});
