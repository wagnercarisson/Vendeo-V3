import type {
  CurrentStageAuthorization,
  ProductFlowScope,
  ProductFlowStage,
} from "./types";

/** Estágios que habilitariam operação real; qualquer um deles é recusado em b1a. */
export const ENABLING_STAGES = Object.freeze([
  "isolated_pilot",
  "test_stores",
  "all_stores",
] as const satisfies readonly ProductFlowStage[]);

export function isEnablingStage(stage: ProductFlowStage): boolean {
  return stage !== "off";
}

export type AuthorizationDenialCode =
  | "read_failure"
  | "flags_unavailable"
  | "missing_authorization"
  | "stage_not_enabling"
  | "instance_mismatch"
  | "scope_mismatch"
  | "revoked"
  | "expired"
  | "flag_not_applicable_off";

export type ProductFlowAuthorizationDecision =
  | {
      readonly allowed: true;
      readonly stage: ProductFlowStage;
      readonly usedGeneralPrecedence: boolean;
    }
  | { readonly allowed: false; readonly code: AuthorizationDenialCode };

export interface AuthorizationFlagsRead {
  readonly testStoresEnabled: boolean;
  readonly allStoresEnabled: boolean;
  readonly testStoresStatus: "valid" | "error" | "missing" | "invalid";
  readonly allStoresStatus: "valid" | "error" | "missing" | "invalid";
}

export interface DecideProductFlowAuthorizationInput {
  readonly nowMs: number;
  readonly requestedScope: ProductFlowScope;
  readonly expectedInstanceIdentity: string;
  readonly authorization: CurrentStageAuthorization | null;
  readonly flags: AuthorizationFlagsRead;
}

/**
 * Decisão pura e determinística de elegibilidade. Fail-closed: qualquer leitura
 * inválida, ausência de autorização, mismatch de instância/escopo, revogação,
 * expiração ou flag aplicável desligada resulta em `allowed: false`.
 *
 * Precedência (D-03): com a flag geral ligada, o escopo geral prevalece sem
 * eliminar a autorização; para o escopo de lojas de teste, a flag de teste
 * aplicável OU a flag geral satisfazem a exigência.
 */
export function decideProductFlowAuthorization(
  input: DecideProductFlowAuthorizationInput,
): ProductFlowAuthorizationDecision {
  const { flags, authorization } = input;

  if (flags.testStoresStatus !== "valid" || flags.allStoresStatus !== "valid") {
    return { allowed: false, code: "flags_unavailable" };
  }

  if (authorization === null) {
    return { allowed: false, code: "missing_authorization" };
  }

  if (!isEnablingStage(authorization.stage)) {
    return { allowed: false, code: "stage_not_enabling" };
  }

  if (authorization.instanceIdentity !== input.expectedInstanceIdentity) {
    return { allowed: false, code: "instance_mismatch" };
  }

  if (authorization.scope !== input.requestedScope) {
    return { allowed: false, code: "scope_mismatch" };
  }

  if (authorization.revokedAtMs !== null) {
    return { allowed: false, code: "revoked" };
  }

  if (
    authorization.expiresAtMs !== null &&
    input.nowMs >= authorization.expiresAtMs
  ) {
    return { allowed: false, code: "expired" };
  }

  const applicableFlagEnabled =
    input.requestedScope === "test_stores"
      ? flags.testStoresEnabled
      : flags.allStoresEnabled;
  const generalPrecedence =
    input.requestedScope === "test_stores" && flags.allStoresEnabled;

  if (!applicableFlagEnabled && !generalPrecedence) {
    return { allowed: false, code: "flag_not_applicable_off" };
  }

  return {
    allowed: true,
    stage: authorization.stage,
    usedGeneralPrecedence: generalPrecedence,
  };
}
