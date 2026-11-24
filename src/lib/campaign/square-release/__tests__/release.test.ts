// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { releaseSquare, type SquareReleaseDeps } from "../release";
import type { SquareReleaseIdentity } from "../types";

const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const ARTIFACT = "44444444-4444-4444-8444-444444444444";

const artifact = {
  kind: "found" as const,
  artifact: {
    artifactId: ARTIFACT,
    checksumSha256: "a".repeat(64),
  },
};

const identity: SquareReleaseIdentity = {
  storeId: "11111111-1111-4111-8111-111111111111",
  campaignId: CAMPAIGN,
  verticalOperationId: OPERATION,
  artifactId: ARTIFACT,
  checksumSha256: "a".repeat(64),
};

function deps(
  overrides: Partial<SquareReleaseDeps> & {
    readonly ledger?: ReturnType<typeof vi.fn>;
  } = {},
): SquareReleaseDeps {
  const reserveCredit = vi.fn(async () => "tx-release");
  const ledger = overrides.ledger ?? vi.fn();
  return {
    readArtifact: vi.fn(async () => artifact),
    readLedger: ledger as never,
    probeArtifact: vi.fn(async () => ({ kind: "integral" as const })),
    credit: { reserveCredit },
    ...overrides,
  };
}

function release(injected: SquareReleaseDeps) {
  return releaseSquare(
    {
      storeId: identity.storeId,
      campaignId: CAMPAIGN,
      verticalOperationId: OPERATION,
    },
    injected,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("releaseSquare — uma única dedução e recuperação", () => {
  it("sem dedução, arte integral e crédito OK ⇒ delivered, com exatamente 1 crédito", async () => {
    const ledger = vi
      .fn()
      .mockResolvedValueOnce({ kind: "none" })
      .mockResolvedValueOnce({ kind: "delivered", deductionId: "tx-release" });
    const injected = deps({ ledger });

    await expect(release(injected)).resolves.toEqual({
      state: "delivered",
      reason: null,
      refunded: false,
    });
    expect(injected.credit?.reserveCredit).toHaveBeenCalledTimes(1);
    expect(injected.credit?.reserveCredit).toHaveBeenCalledWith(
      identity.storeId,
      1,
      expect.objectContaining({
        campaignId: CAMPAIGN,
        idempotencyKey: expect.stringContaining("square_release:v1:"),
        metadata: expect.objectContaining({
          kind: "square_release",
          feature: "square_release",
          vertical_operation_id: OPERATION,
          artifact_id: ARTIFACT,
          cost_credits: 1,
        }),
      }),
    );
    expect(ledger).toHaveBeenCalledTimes(2);
  });

  it("dedução já entregue não chama reserveCredit", async () => {
    const injected = deps({
      ledger: vi.fn(async () => ({
        kind: "delivered",
        deductionId: "tx-existing",
      })),
      probeArtifact: vi.fn(),
    });
    await expect(release(injected)).resolves.toEqual({
      state: "delivered",
      reason: null,
      refunded: false,
    });
    expect(injected.credit?.reserveCredit).not.toHaveBeenCalled();
    expect(injected.probeArtifact).not.toHaveBeenCalled();
  });

  it("dedução estornada bloqueia nova compra sem chamar reserveCredit", async () => {
    const injected = deps({
      ledger: vi.fn(async () => ({
        kind: "refunded",
        deductionId: "tx-old",
        refundId: "refund-old",
      })),
    });
    await expect(release(injected)).resolves.toEqual({
      state: "refunded",
      reason: "release_refunded",
      refunded: true,
    });
    expect(injected.credit?.reserveCredit).not.toHaveBeenCalled();
  });

  it("quadrado ausente não cobra", async () => {
    const injected = deps({
      readArtifact: vi.fn(async () => ({ kind: "absent" as const })),
    });
    await expect(release(injected)).resolves.toMatchObject({
      state: "incompatible",
      reason: "artifact_absent",
    });
    expect(injected.credit?.reserveCredit).not.toHaveBeenCalled();
  });

  it("quadrado inválido/indeterminado não cobra", async () => {
    for (const probe of ["invalid", "indeterminate"] as const) {
      const injected = deps({
        ledger: vi.fn(async () => ({ kind: "none" })),
        probeArtifact: vi.fn(async () => ({ kind: probe })),
      });
      const result = await release(injected);
      expect(result.state).toBe(probe === "invalid" ? "unavailable" : "unknown");
      expect(injected.credit?.reserveCredit).not.toHaveBeenCalled();
    }
  });

  it("NULL/insuficiente e releitura sem vencedora ⇒ saldo insuficiente, sem segunda reserva", async () => {
    const ledger = vi
      .fn()
      .mockResolvedValueOnce({ kind: "none" })
      .mockResolvedValueOnce({ kind: "none" });
    const injected = deps({ ledger });
    (
      injected.credit as { reserveCredit: ReturnType<typeof vi.fn> }
    ).reserveCredit.mockRejectedValueOnce(new Error("saldo_insuficiente"));

    await expect(release(injected)).resolves.toMatchObject({
      state: "unavailable",
      reason: "insufficient_credits",
    });
    expect(injected.credit?.reserveCredit).toHaveBeenCalledTimes(1);
    expect(ledger).toHaveBeenCalledTimes(2);
  });

  it("23505 e releitura com vencedora ⇒ delivered, sem segunda reserva", async () => {
    const ledger = vi
      .fn()
      .mockResolvedValueOnce({ kind: "none" })
      .mockResolvedValueOnce({ kind: "delivered", deductionId: "tx-winner" });
    const injected = deps({ ledger });
    (
      injected.credit as { reserveCredit: ReturnType<typeof vi.fn> }
    ).reserveCredit.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    );

    await expect(release(injected)).resolves.toMatchObject({
      state: "delivered",
    });
    expect(injected.credit?.reserveCredit).toHaveBeenCalledTimes(1);
    expect(ledger).toHaveBeenCalledTimes(2);
  });

  it("falha de transporte e releitura sem vencedora ⇒ unknown, sem segunda reserva", async () => {
    const ledger = vi
      .fn()
      .mockResolvedValueOnce({ kind: "none" })
      .mockResolvedValueOnce({ kind: "none" });
    const injected = deps({ ledger });
    (
      injected.credit as { reserveCredit: ReturnType<typeof vi.fn> }
    ).reserveCredit.mockRejectedValueOnce(new Error("socket hang up"));

    await expect(release(injected)).resolves.toMatchObject({
      state: "unknown",
      reason: "operation_unavailable",
    });
    expect(injected.credit?.reserveCredit).toHaveBeenCalledTimes(1);
  });

  it("leitura inicial falha ⇒ unknown e nenhuma cobrança", async () => {
    const injected = deps({
      ledger: vi.fn(async () => ({ kind: "read_failed" })),
    });
    await expect(release(injected)).resolves.toMatchObject({
      state: "unknown",
    });
    expect(injected.credit?.reserveCredit).not.toHaveBeenCalled();
  });

  it("comprovante inválido falha fechado sem nova cobrança", async () => {
    const injected = deps({
      ledger: vi.fn(async () => ({ kind: "invalid" })),
    });
    await expect(release(injected)).resolves.toMatchObject({
      state: "unavailable",
    });
    expect(injected.credit?.reserveCredit).not.toHaveBeenCalled();
  });
});
