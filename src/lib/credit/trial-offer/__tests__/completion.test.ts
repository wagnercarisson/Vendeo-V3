// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: mockRpc },
}));

import {
  maybeCompleteOnboardingAndStartTrial,
  retryTrialOfferEnrollment,
} from "../completion";

const storeId = "00000000-0000-0000-0000-000000000001";

function startPayload(overrides: Record<string, unknown> = {}) {
  return {
    status: "started",
    enrollment_id: "enr-1",
    started_at: "2026-10-01T00:00:00.000Z",
    expires_at: "2026-10-29T00:00:00.000Z",
    granted_total: 5,
    last_granted_seq: 0,
    // Campos internos que NUNCA podem chegar ao chamador.
    beneficiary_cnpj_normalized: "12345678000190",
    root_hash: "abc123",
    ...overrides,
  };
}

function completedPayload() {
  return { completed: true };
}

beforeEach(() => {
  mockRpc.mockReset();
});

describe("maybeCompleteOnboardingAndStartTrial", () => {
  it("mapeia `started` com o enrollment da própria loja", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: completedPayload(), error: null })
      .mockResolvedValueOnce({ data: startPayload(), error: null });

    const result = await maybeCompleteOnboardingAndStartTrial(storeId);

    expect(result.status).toBe("started");
    expect(result.enrollment).toEqual({
      id: "enr-1",
      startedAt: "2026-10-01T00:00:00.000Z",
      expiresAt: "2026-10-29T00:00:00.000Z",
      grantedTotal: 5,
      lastGrantedSeq: 0,
    });
  });

  it("mapeia `existing` sem adicionar campos sensíveis ao resultado", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: completedPayload(), error: null })
      .mockResolvedValueOnce({
        data: startPayload({ status: "existing", enrollment_id: "enr-own" }),
        error: null,
      });

    const result = await maybeCompleteOnboardingAndStartTrial(storeId);

    expect(result.status).toBe("existing");
    expect(result.enrollment?.id).toBe("enr-own");
    // O payload cru (CNPJ beneficiário, hash de raiz) é descartado.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("12345678000190");
    expect(serialized).not.toContain("abc123");
    expect(Object.keys(result)).not.toContain("beneficiary_cnpj_normalized");
    expect(Object.keys(result)).not.toContain("root_hash");
    expect(Object.keys(result.enrollment ?? {})).not.toContain("root_hash");
  });

  it.each([
    "beneficiary_already_enrolled",
    "root_used_other_beneficiary",
    "beneficiary_already_used",
    "prior_benefit_ambiguous",
  ])("preserva o motivo seguro `%s` como not_eligible", async (reason) => {
    mockRpc
      .mockResolvedValueOnce({ data: completedPayload(), error: null })
      .mockResolvedValueOnce({ data: { status: "not_eligible", reason }, error: null });

    const result = await maybeCompleteOnboardingAndStartTrial(storeId);

    expect(result.status).toBe("not_eligible");
    expect(result.reason).toBe(reason);
    expect(result.enrollment).toBeUndefined();
  });

  it("mapeia not_eligible + reason expired_window/offer_disabled para o status da UI", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: completedPayload(), error: null })
      .mockResolvedValueOnce({
        data: { status: "not_eligible", reason: "expired_window" },
        error: null,
      });

    const expired = await maybeCompleteOnboardingAndStartTrial(storeId);
    expect(expired.status).toBe("expired_window");
    expect(expired.reason).toBe("expired_window");

    mockRpc.mockReset();
    mockRpc
      .mockResolvedValueOnce({ data: completedPayload(), error: null })
      .mockResolvedValueOnce({
        data: { status: "not_eligible", reason: "offer_disabled" },
        error: null,
      });

    const disabled = await maybeCompleteOnboardingAndStartTrial(storeId);
    expect(disabled.status).toBe("offer_disabled");
    expect(disabled.reason).toBe("offer_disabled");
  });

  it("onboarding incompleto (not_ready) não tenta a inscrição", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { completed: false, status: "not_ready", reason: "not_ready" },
      error: null,
    });

    const result = await maybeCompleteOnboardingAndStartTrial(storeId);

    expect(result).toEqual({ status: "not_ready", reason: "not_ready" });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("record_onboarding_completion", {
      p_store_id: storeId,
    });
  });

  it("erro de RPC na conclusão → retryable_failure/record_failed (sem lançar)", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const result = await maybeCompleteOnboardingAndStartTrial(storeId);

    expect(result).toEqual({ status: "retryable_failure", reason: "record_failed" });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("erro de RPC na inscrição → retryable_failure/start_failed", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: completedPayload(), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const result = await maybeCompleteOnboardingAndStartTrial(storeId);

    expect(result).toEqual({ status: "retryable_failure", reason: "start_failed" });
  });

  it("exceção inesperada → retryable_failure/unexpected_error (nunca propaga)", async () => {
    mockRpc.mockRejectedValueOnce(new Error("network down"));

    await expect(maybeCompleteOnboardingAndStartTrial(storeId)).resolves.toEqual({
      status: "retryable_failure",
      reason: "unexpected_error",
    });
  });

  it("payload desconhecido é sanitizado (motivo fora da allowlist)", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: completedPayload(), error: null })
      .mockResolvedValueOnce({
        data: {
          status: "root_secret_state",
          reason: "leaked_internal_reason",
          beneficiary_cnpj_normalized: "12345678000190",
        },
        error: null,
      });

    const result = await maybeCompleteOnboardingAndStartTrial(storeId);

    expect(result.status).toBe("not_eligible");
    expect(result.reason).toBe("not_eligible");
    expect(JSON.stringify(result)).not.toContain("12345678000190");
    expect(JSON.stringify(result)).not.toContain("leaked_internal_reason");
  });
});

describe("retryTrialOfferEnrollment", () => {
  it("é idempotente: repete os mesmos dois RPCs por store_id, sem provider/onboarding", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: completedPayload(), error: null })
      .mockResolvedValueOnce({ data: startPayload({ status: "existing" }), error: null })
      .mockResolvedValueOnce({ data: completedPayload(), error: null })
      .mockResolvedValueOnce({ data: startPayload({ status: "existing" }), error: null });

    const first = await retryTrialOfferEnrollment(storeId);
    const second = await retryTrialOfferEnrollment(storeId);

    expect(second).toEqual(first);
    expect(first.status).toBe("existing");
    expect(mockRpc).toHaveBeenCalledTimes(4);
    expect(mockRpc.mock.calls).toEqual([
      ["record_onboarding_completion", { p_store_id: storeId }],
      ["start_trial_offer_enrollment", { p_store_id: storeId }],
      ["record_onboarding_completion", { p_store_id: storeId }],
      ["start_trial_offer_enrollment", { p_store_id: storeId }],
    ]);
  });

  it("escopo é exclusivamente por store_id (nunca agrega enrollment por raiz)", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: completedPayload(), error: null })
      .mockResolvedValueOnce({ data: startPayload(), error: null });

    await retryTrialOfferEnrollment(storeId);

    for (const [fn, args] of mockRpc.mock.calls) {
      expect(typeof fn).toBe("string");
      expect(args).toEqual({ p_store_id: storeId });
      expect(Object.keys(args)).not.toContain("p_root_hash");
      expect(Object.keys(args)).not.toContain("p_beneficiary_cnpj_normalized");
    }
  });
});
