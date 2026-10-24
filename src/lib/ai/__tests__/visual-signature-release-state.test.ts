import { describe, expect, it } from "vitest";
import {
  loadVisualSignatureModelConfigSnapshot,
  VisualSignatureConfigOutsideEnvironmentError,
  type VisualSignatureReleaseRow,
  type VisualSignatureModelConfigRow,
} from "../visual-signature-model-config-service";

const ENVIRONMENT = {
  environment: "local_validation" as const,
  instanceIdentity: "127.0.0.1:57781",
  supabaseOrigin: "http://127.0.0.1:57781",
  apiKey: "sk-local",
};

const VERSION = "11111111-1111-1111-1111-111111111111";

function row(): VisualSignatureModelConfigRow {
  return {
    scope: "visual_signature",
    environment_scope: "local_validation",
    instance_identity: ENVIRONMENT.instanceIdentity,
    orchestrator_model: "gpt-6-luna",
    image_preset: "sunburst_medium",
    image_model: "gpt-image-2.5-sunburst",
    image_quality: "medium",
    reasoning_effort: "low",
    config_version_id: VERSION,
  };
}

function release(overrides: Partial<VisualSignatureReleaseRow> = {}): VisualSignatureReleaseRow {
  return {
    published_config_version_id: VERSION,
    activated_config_version_id: VERSION,
    activation_mode: "pilot",
    environment_scope: "local_validation",
    instance_identity: ENVIRONMENT.instanceIdentity,
    ...overrides,
  };
}

function load(overrides: {
  release?: VisualSignatureReleaseRow | null;
  stores?: string[];
  storeId?: string;
}) {
  return loadVisualSignatureModelConfigSnapshot({
    reader: { read: async () => row() },
    releaseReader: { read: async () => overrides.release ?? release() },
    pilotStoreReader: { read: async () => overrides.stores ?? ["store-in"] },
    storeId: overrides.storeId ?? "store-in",
    isOptedIn: () => true,
    assertEnvironment: () => ENVIRONMENT,
  });
}

describe("F47.2 — estados de liberação no snapshot", () => {
  it("sem publicação usa legado", async () => {
    expect(await load({ release: release({ published_config_version_id: null }) })).toEqual({
      mode: "legacy",
    });
  });

  it("publicada mas não ativada usa legado", async () => {
    expect(
      await load({
        release: release({
          activated_config_version_id: null,
          activation_mode: "none",
        }),
      }),
    ).toEqual({ mode: "legacy" });
  });

  it("loja fora do piloto usa legado", async () => {
    expect(await load({ storeId: "store-out" })).toEqual({ mode: "legacy" });
  });

  it("loja no piloto congela a configuração com estados", async () => {
    const snapshot = await load({});
    expect(snapshot).toMatchObject({
      mode: "dedicated",
      configVersionId: VERSION,
      environment: "local_validation",
      publishedConfigVersionId: VERSION,
      activatedConfigVersionId: VERSION,
      activationMode: "pilot",
      pilotEligible: true,
    });
  });

  it("modo geral não depende de allowlist", async () => {
    const snapshot = await load({
      release: release({ activation_mode: "general" }),
      storeId: "qualquer-loja",
    });
    expect(snapshot).toMatchObject({ mode: "dedicated", activationMode: "general" });
  });

  it("identidade divergente bloqueia", async () => {
    await expect(
      load({
        release: release({
          instance_identity: "127.0.0.1:99999",
        }),
      }),
    ).rejects.toBeInstanceOf(VisualSignatureConfigOutsideEnvironmentError);
  });
});
