import { describe, expect, it, vi } from "vitest";
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

  it("ausência da linha de configuração usa legado sem ler release", async () => {
    const releaseRead = vi.fn();
    const snapshot = await loadVisualSignatureModelConfigSnapshot({
      reader: { read: async () => null },
      releaseReader: { read: releaseRead },
      isOptedIn: () => true,
      assertEnvironment: () => ENVIRONMENT,
    });
    expect(snapshot).toEqual({ mode: "legacy" });
    expect(releaseRead).not.toHaveBeenCalled();
  });

  it("configuração divergente desativada segue legado sem comparar identidade", async () => {
    const snapshot = await loadVisualSignatureModelConfigSnapshot({
      reader: { read: async () => ({ ...row(), instance_identity: "old-identity" }) },
      releaseReader: { read: async () => release({ activated_config_version_id: null, activation_mode: "none" }) },
      isOptedIn: () => true,
      assertEnvironment: () => ENVIRONMENT,
    });
    expect(snapshot).toEqual({ mode: "legacy" });
  });

  it("falhas ao ler configuração ou release nunca viram legado", async () => {
    await expect(loadVisualSignatureModelConfigSnapshot({
      reader: { read: async () => { throw new Error("config db unavailable"); } },
      isOptedIn: () => true,
      assertEnvironment: () => ENVIRONMENT,
    })).rejects.toMatchObject({ code: "visual_signature_model_config_read_failed" });
    await expect(loadVisualSignatureModelConfigSnapshot({
      reader: { read: async () => row() },
      releaseReader: { read: async () => { throw new Error("release db unavailable"); } },
      isOptedIn: () => true,
      assertEnvironment: () => ENVIRONMENT,
    })).rejects.toThrow("release db unavailable");
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

  it("VERCEL_ENV production permite configuração elegível sem opt-in dedicado", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VENDEO_VS_VALIDATION_ENABLED", "");
    try {
      const snapshot = await loadVisualSignatureModelConfigSnapshot({
        reader: {
          read: async () => ({
            ...row(),
            environment_scope: "production",
            instance_identity: "abc123",
          }),
        },
        releaseReader: {
          read: async () => ({
            ...release(),
            environment_scope: "production",
            instance_identity: "abc123",
          }),
        },
        pilotStoreReader: { read: async () => ["store-in"] },
        storeId: "store-in",
        assertEnvironment: () => ({
          environment: "production",
          instanceIdentity: "abc123",
          supabaseOrigin: "https://abc123.supabase.co",
          apiKey: "sk-prod",
        }),
        assertCredential: () => {},
      });
      expect(snapshot.mode).toBe("dedicated");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("configuração inativa divergente não bloqueia o legado", async () => {
    const snapshot = await loadVisualSignatureModelConfigSnapshot({
      reader: {
        read: async () => ({
          ...row(),
          environment_scope: "production",
          instance_identity: "outra-identidade",
        }),
      },
      releaseReader: {
        read: async () => release({ published_config_version_id: null }),
      },
      pilotStoreReader: { read: async () => [] },
      storeId: "store-in",
      isOptedIn: () => true,
      assertEnvironment: () => ENVIRONMENT,
      assertCredential: () => {},
    });
    expect(snapshot).toEqual({ mode: "legacy" });
  });

  it("piloto sem storeId não retorna dedicado", async () => {
    const snapshot = await loadVisualSignatureModelConfigSnapshot({
      reader: { read: async () => row() },
      releaseReader: { read: async () => release() },
      pilotStoreReader: { read: async () => ["store-in"] },
      isOptedIn: () => true,
      assertEnvironment: () => ENVIRONMENT,
      assertCredential: () => {},
    });
    expect(snapshot).toEqual({ mode: "legacy" });
  });

  it("detecta mudança de release entre as leituras", async () => {
    let calls = 0;
    await expect(
      loadVisualSignatureModelConfigSnapshot({
        reader: { read: async () => row() },
        releaseReader: {
          read: async () => {
            calls += 1;
            return calls === 1
              ? release()
              : release({ activated_config_version_id: null, activation_mode: "none" });
          },
        },
        pilotStoreReader: { read: async () => ["store-in"] },
        storeId: "store-in",
        isOptedIn: () => true,
        assertEnvironment: () => ENVIRONMENT,
        assertCredential: () => {},
      }),
    ).rejects.toMatchObject({ code: "visual_signature_release_changed_during_read" });
  });
});
