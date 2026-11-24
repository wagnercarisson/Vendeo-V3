import { describe, expect, it } from "vitest";

import {
  canonicalSquareReleaseIdentity,
  isValidSquareReleaseDeduction,
  squareReleaseKey,
  squareReleaseMetadata,
} from "../identity";
import {
  SQUARE_RELEASE_COST_CREDITS,
  type SquareReleaseIdentity,
} from "../types";

const IDENTITY: SquareReleaseIdentity = {
  storeId: "11111111-1111-4111-8111-111111111111",
  campaignId: "22222222-2222-4222-8222-222222222222",
  verticalOperationId: "33333333-3333-4333-8333-333333333333",
  artifactId: "44444444-4444-4444-8444-444444444444",
  checksumSha256: "a".repeat(64),
};

function deduction(overrides: Record<string, unknown> = {}) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    type: "deduction",
    amount: -1,
    campaign_id: IDENTITY.campaignId,
    idempotency_key: squareReleaseKey(IDENTITY),
    metadata: squareReleaseMetadata(IDENTITY),
    ...overrides,
  };
}

describe("liberação do quadrado — identidade e comprovante", () => {
  it("custo fixo de 1 crédito", () => {
    expect(SQUARE_RELEASE_COST_CREDITS).toBe(1);
  });

  it("chave é estável para a mesma identidade e muda com qualquer elo", () => {
    const first = squareReleaseKey(IDENTITY);
    expect(squareReleaseKey({ ...IDENTITY })).toBe(first);
    expect(
      squareReleaseKey({
        ...IDENTITY,
        checksumSha256: "b".repeat(64),
      }),
    ).not.toBe(first);
    expect(
      squareReleaseKey({ ...IDENTITY, verticalOperationId: "66666666-6666-4666-8666-666666666666" }),
    ).not.toBe(first);
    expect(canonicalSquareReleaseIdentity(IDENTITY)).toContain(
      "square_release:v1",
    );
  });

  it("aceita somente dedução -1 com metadados completos", () => {
    expect(isValidSquareReleaseDeduction(deduction(), IDENTITY)).toBe(true);
    expect(isValidSquareReleaseDeduction(deduction({ amount: -2 }), IDENTITY)).toBe(
      false,
    );
    expect(isValidSquareReleaseDeduction(deduction({ type: "refund" }), IDENTITY)).toBe(
      false,
    );
    expect(
      isValidSquareReleaseDeduction(
        deduction({ campaign_id: "77777777-7777-4777-8777-777777777777" }),
        IDENTITY,
      ),
    ).toBe(false);
    expect(
      isValidSquareReleaseDeduction(
        deduction({ idempotency_key: "other-key" }),
        IDENTITY,
      ),
    ).toBe(false);
  });

  it("rejeita metadados ausentes ou divergentes, mesmo com a chave certa", () => {
    expect(isValidSquareReleaseDeduction(deduction({ metadata: null }), IDENTITY)).toBe(
      false,
    );
    const metadata = squareReleaseMetadata(IDENTITY);
    expect(
      isValidSquareReleaseDeduction(
        deduction({ metadata: { ...metadata, artifact_id: "another" } }),
        IDENTITY,
      ),
    ).toBe(false);
    expect(
      isValidSquareReleaseDeduction(
        deduction({ metadata: { ...metadata, cost_credits: 2 } }),
        IDENTITY,
      ),
    ).toBe(false);
    expect(
      isValidSquareReleaseDeduction(
        deduction({ metadata: { ...metadata, feature: "campaign_pipeline" } }),
        IDENTITY,
      ),
    ).toBe(false);
  });
});
