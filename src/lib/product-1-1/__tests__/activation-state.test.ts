// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/product-1-1/authorization/instance-identity", () => ({
  resolveCanonicalInstanceIdentity: () => "127.0.0.1:56321",
}));

import { readProductActivationState } from "../activation/activation-state";

const expiredGrant = {
  eventType: "granted",
  stage: "test_stores",
  scope: "test_stores",
  instanceIdentity: "127.0.0.1:56321",
  grantedBy: "admin",
  reason: "expired",
  operationId: "op",
  expiresAtMs: 1000,
  createdAtMs: 1,
  seq: 1,
} as const;

function deps(events: unknown[]) {
  return {
    flags: {
      readProductOneToOneFlags: vi.fn(async () => ({
        testStoresEnabled: true,
        allStoresEnabled: false,
        testStoresStatus: "valid" as const,
        allStoresStatus: "valid" as const,
      })),
    },
    repository: {
      listEvents: vi.fn(async ({ scope }: { scope: string }) =>
        (scope === "test_stores" ? events : []) as never,
      ),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F56.2e - estado de ativacao respeita expiracao", () => {
  it("autorizacao expirada nao aparece como modo ativo", async () => {
    const d = deps([expiredGrant]);
    const state = await readProductActivationState(
      d.flags as never,
      d.repository as never,
      2000,
    );
    expect(state.authorizations.testStores).toBe("off");
    // Flag ligada sem autorizacao vigente NAO e modo ativo; e inconsistente.
    expect(state.mode).toBe("inconsistent");
  });

  it("autorizacao vigente aparece como modo ativo", async () => {
    const d = deps([{ ...expiredGrant, expiresAtMs: 5000 }]);
    const state = await readProductActivationState(
      d.flags as never,
      d.repository as never,
      2000,
    );
    expect(state.authorizations.testStores).toBe("test_stores");
    expect(state.mode).toBe("test_stores");
  });
});
