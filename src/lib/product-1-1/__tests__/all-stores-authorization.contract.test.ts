// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decideProductFlowAuthorization,
  STAGE_ENVIRONMENT_COMPATIBILITY,
  STAGE_SCOPE_COMPATIBILITY,
} from "../authorization/authorization-decision";
import type { AuthorizationFlagsRead } from "../authorization/authorization-decision";

const flags: AuthorizationFlagsRead = {
  testStoresEnabled: false,
  allStoresEnabled: true,
  testStoresStatus: "valid",
  allStoresStatus: "valid",
};

function input(overrides: Record<string, unknown> = {}) {
  return {
    nowMs: 1000,
    requestedScope: "all_stores",
    expectedInstanceIdentity: "127.0.0.1:56321",
    expectedEnvironment: "operational",
    flags,
    authorization: {
      stage: "all_stores",
      scope: "all_stores",
      instanceIdentity: "127.0.0.1:56321",
      expiresAtMs: null,
      revokedAtMs: null,
    },
    ...overrides,
  } as Parameters<typeof decideProductFlowAuthorization>[0];
}

describe("F56.2e - decisao pura all_stores", () => {
  it("permite all_stores + all_stores + operational com a chave geral", () => {
    expect(decideProductFlowAuthorization(input())).toEqual({
      allowed: true,
      stage: "all_stores",
      usedGeneralPrecedence: false,
    });
    expect(STAGE_SCOPE_COMPATIBILITY.all_stores).toEqual(["all_stores"]);
    expect(STAGE_ENVIRONMENT_COMPATIBILITY.all_stores).toEqual(["isolated", "operational"]);
  });

  it("nega escopo/instancia/ambiente/flag divergentes", () => {
    expect(decideProductFlowAuthorization(input({ requestedScope: "test_stores" })).allowed).toBe(false);
    expect(
      decideProductFlowAuthorization(
        input({ expectedInstanceIdentity: "outra" }),
      ).allowed,
    ).toBe(false);
    expect(
      decideProductFlowAuthorization(
        input({ expectedEnvironment: "isolated" }),
      ).allowed,
    ).toBe(true); // all_stores e compativel com isolated (teste controlado)
    expect(
      decideProductFlowAuthorization(
        input({ flags: { ...flags, allStoresEnabled: false } }),
      ).allowed,
    ).toBe(false);
  });

  it("a autorizacao all_stores nao cobre implicitamente test_stores", () => {
    expect(
      decideProductFlowAuthorization(
        input({ requestedScope: "test_stores" }),
      ).allowed,
    ).toBe(false);
  });
});
