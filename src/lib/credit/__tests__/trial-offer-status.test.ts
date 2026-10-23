import { describe, expect, it } from "vitest";
import {
  getNextTrialInstallment,
  getTrialOfferStatus,
  isTrialOfferRefundGrace,
  type TrialOfferEnrollmentView,
} from "@/lib/credit/trial-offer/status";

const now = new Date("2026-10-20T12:00:00.000Z");

function enrollment(overrides: Partial<TrialOfferEnrollmentView> = {}): TrialOfferEnrollmentView {
  return {
    id: "enr-1",
    startedAt: "2026-10-20T00:00:00.000Z",
    expiresAt: "2026-11-17T00:00:00.000Z",
    grantedTotal: 5,
    lastGrantedSeq: 0,
    ...overrides,
  };
}

describe("F50.2 trial offer status", () => {
  it("returns unknown without enrollment and without authoritative eligibility", () => {
    expect(
      getTrialOfferStatus({ enrollment: null, demoBalance: 0, demoExpiresAt: null }, now),
    ).toBe("unknown");
    // Ausência de inscrição não é prova de elegibilidade: nenhum sinal de saldo,
    // histórico manual ou demo deve ser interpretado como direito ao teste.
    expect(
      getTrialOfferStatus(
        { enrollment: null, demoBalance: 0, demoExpiresAt: null, eligibility: "unknown" },
        now,
      ),
    ).toBe("unknown");
  });

  it("returns not_started only with explicit eligibility", () => {
    expect(
      getTrialOfferStatus(
        { enrollment: null, demoBalance: 0, demoExpiresAt: null, eligibility: "eligible" },
        now,
      ),
    ).toBe("not_started");
  });

  it("preserves legacy_demo without enrollment", () => {
    expect(
      getTrialOfferStatus(
        { enrollment: null, demoBalance: 5, demoExpiresAt: null, hasLegacyDemo: true },
        now,
      ),
    ).toBe("legacy_demo");
  });

  it("preserves active when demo credit evidence exists without enrollment", () => {
    expect(
      getTrialOfferStatus({ enrollment: null, demoBalance: 5, demoExpiresAt: null }, now),
    ).toBe("active");
    expect(
      getTrialOfferStatus(
        { enrollment: null, demoBalance: 0, demoExpiresAt: "2026-10-25T00:00:00.000Z" },
        now,
      ),
    ).toBe("active");
  });

  it("derives active, expiring_soon, exhausted and expired", () => {
    expect(
      getTrialOfferStatus(
        { enrollment: enrollment(), demoBalance: 5, demoExpiresAt: "2026-11-17T00:00:00.000Z" },
        now,
      ),
    ).toBe("active");

    expect(
      getTrialOfferStatus(
        {
          enrollment: enrollment({ expiresAt: "2026-10-21T00:00:00.000Z" }),
          demoBalance: 5,
          demoExpiresAt: "2026-10-21T00:00:00.000Z",
        },
        now,
      ),
    ).toBe("expiring_soon");

    expect(
      getTrialOfferStatus(
        { enrollment: enrollment(), demoBalance: 0, demoExpiresAt: "2026-11-17T00:00:00.000Z" },
        now,
      ),
    ).toBe("exhausted");

    expect(
      getTrialOfferStatus(
        {
          enrollment: enrollment({ expiresAt: "2026-10-19T00:00:00.000Z" }),
          demoBalance: 5,
          demoExpiresAt: "2026-10-19T00:00:00.000Z",
        },
        now,
      ),
    ).toBe("expired");
  });

  it("returns the next installment and stops after seq 3", () => {
    expect(getNextTrialInstallment(enrollment(), now)).toEqual({
      seq: 1,
      dueAt: "2026-10-27T00:00:00.000Z",
    });

    expect(
      getNextTrialInstallment(enrollment({ lastGrantedSeq: 3, grantedTotal: 20 }), now),
    ).toBeNull();
  });

  it("keeps the test active after the fourth installment when balance remains", () => {
    expect(
      getTrialOfferStatus(
        {
          enrollment: enrollment({ lastGrantedSeq: 3, grantedTotal: 20 }),
          demoBalance: 5,
          demoExpiresAt: "2026-11-17T00:00:00.000Z",
        },
        now,
      ),
    ).toBe("active");
  });

  it("does not announce an installment after the test window", () => {
    expect(
      getNextTrialInstallment(
        enrollment({ lastGrantedSeq: 2, expiresAt: "2026-10-19T00:00:00.000Z" }),
        now,
      ),
    ).toBeNull();
  });

  it("detects a 24h refund grace after the test window", () => {
    expect(
      isTrialOfferRefundGrace(
        {
          enrollment: enrollment({ expiresAt: "2026-10-19T00:00:00.000Z" }),
          demoBalance: 5,
          demoExpiresAt: "2026-10-21T00:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);

    expect(
      isTrialOfferRefundGrace(
        {
          enrollment: enrollment({ expiresAt: "2026-10-19T00:00:00.000Z" }),
          demoBalance: 0,
          demoExpiresAt: "2026-10-21T00:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });
});
