import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  releaseReads: 0,
  pilotReads: 0,
  releaseSelect: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => {
  const configRow = {
    scope: "visual_signature",
    environment_scope: "local_validation",
    instance_identity: "127.0.0.1:57781",
    orchestrator_model: "gpt-6-luna",
    image_preset: "sunburst_medium",
    image_model: "gpt-image-2.5-sunburst",
    image_quality: "medium",
    reasoning_effort: "low",
    config_version_id: "11111111-1111-1111-1111-111111111111",
  };
  const releaseRow = {
    published_config_version_id: configRow.config_version_id,
    activated_config_version_id: configRow.config_version_id,
    activation_mode: "pilot",
    environment_scope: "local_validation",
    instance_identity: "127.0.0.1:57781",
    updated_at: "2026-10-24T12:00:00.000Z",
    last_operation_id: "22222222-2222-2222-2222-222222222222",
  };
  return {
    supabaseAdmin: {
      from(table: string) {
        if (table === "visual_signature_model_config") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: configRow, error: null }) }),
            }),
          };
        }
        if (table === "visual_signature_model_config_release") {
          return {
            select: (columns: string) => {
              state.releaseSelect.push(columns);
              return {
                eq: () => ({
                  maybeSingle: async () => {
                    state.releaseReads += 1;
                    return { data: releaseRow, error: null };
                  },
                }),
              };
            },
          };
        }
        if (table === "visual_signature_model_config_pilot_stores") {
          return {
            select: async () => {
              state.pilotReads += 1;
              const data =
                state.pilotReads === 1
                  ? [{ store_id: "store-a" }]
                  : [{ store_id: "store-a" }, { store_id: "store-b" }];
              return { data, error: null };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    },
  };
});

import { loadVisualSignatureModelConfigSnapshot } from "../visual-signature-model-config-service";

const ENVIRONMENT = {
  environment: "local_validation" as const,
  instanceIdentity: "127.0.0.1:57781",
  supabaseOrigin: "http://127.0.0.1:57781",
  apiKey: "sk-local",
};

describe("F47.2 — leitura real de release/allowlist", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    state.releaseReads = 0;
    state.pilotReads = 0;
    state.releaseSelect = [];
  });

  it("seleciona updated_at/last_operation_id e detecta mudança apenas na allowlist", async () => {
    vi.stubEnv("VENDEO_VS_VALIDATION_ENABLED", "1");
    await expect(
      loadVisualSignatureModelConfigSnapshot({
        storeId: "store-a",
        assertEnvironment: () => ENVIRONMENT,
        assertCredential: () => {},
      }),
    ).rejects.toMatchObject({ code: "visual_signature_release_changed_during_read" });

    expect(state.releaseSelect[0]).toContain("updated_at");
    expect(state.releaseSelect[0]).toContain("last_operation_id");
    expect(state.releaseReads).toBe(2);
    expect(state.pilotReads).toBe(2);
  });
});
