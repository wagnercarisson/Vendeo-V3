import type {
  CurrentStageAuthorization,
  ProductFlowEnvironment,
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

/**
 * Matriz estágio × escopo. Combinações fora da lista são inválidas e negam
 * acesso. O piloto isolado só vale para lojas de teste — nunca para o escopo
 * geral (`all_stores`).
 */
export const STAGE_SCOPE_COMPATIBILITY: Readonly<
  Record<ProductFlowStage, readonly ProductFlowScope[]>
> = Object.freeze({
  off: [],
  isolated_pilot: ["test_stores"],
  test_stores: ["test_stores"],
  all_stores: ["all_stores"],
});

/**
 * Matriz estágio × ambiente. O piloto isolado nunca autoriza o ambiente
 * operacional; os demais estágios podem ser exercitados em ambos os ambientes.
 */
export const STAGE_ENVIRONMENT_COMPATIBILITY: Readonly<
  Record<ProductFlowStage, readonly ProductFlowEnvironment[]>
> = Object.freeze({
  off: [],
  isolated_pilot: ["isolated"],
  test_stores: ["isolated", "operational"],
  all_stores: ["isolated", "operational"],
});

/** Estágio habilitador é compatível com o escopo E o ambiente informados. */
export function isStageCompatible(
  stage: ProductFlowStage,
  scope: ProductFlowScope,
  environment: ProductFlowEnvironment,
): boolean {
  return (
    STAGE_SCOPE_COMPATIBILITY[stage].includes(scope) &&
    STAGE_ENVIRONMENT_COMPATIBILITY[stage].includes(environment)
  );
}

export type AuthorizationDenialCode =
  | "read_failure"
  | "flags_unavailable"
  | "missing_authorization"
  | "stage_not_enabling"
  | "instance_mismatch"
  | "scope_mismatch"
  | "stage_scope_mismatch"
  | "stage_environment_mismatch"
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
  readonly expectedEnvironment: ProductFlowEnvironment;
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

  if (!STAGE_SCOPE_COMPATIBILITY[authorization.stage].includes(authorization.scope)) {
    return { allowed: false, code: "stage_scope_mismatch" };
  }

  if (
    !STAGE_ENVIRONMENT_COMPATIBILITY[authorization.stage].includes(
      input.expectedEnvironment,
    )
  ) {
    return { allowed: false, code: "stage_environment_mismatch" };
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
