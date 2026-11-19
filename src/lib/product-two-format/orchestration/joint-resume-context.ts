import { randomUUID } from "node:crypto";

/**
 * Identidade durável do caminho conjunto.
 *
 * `squareDeliveryId` é a identidade FINANCEIRA estável do quadrado.
 * `initialRequestIds.base` é a aquisição usada somente pela PRIMEIRA abertura
 * (ação inicial `run_base`). Não existe ID inicial de expansão; toda expansão
 * usa o `requestId` de uma continuação explícita.
 */
export interface JointResumeContext {
  readonly squareDeliveryId: string;
  readonly initialRequestIds: {
    readonly base: string;
  };
}

export type JointResumeContextRead =
  | { readonly kind: "found"; readonly context: JointResumeContext }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly reason: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export interface BuildJointResumeContextInput {
  readonly operationId: string;
  /** Injetável em testes; default `randomUUID`. */
  readonly uuid?: () => string;
}

/**
 * Constrói a identidade uma única vez. Deve ser chamada apenas no INSERT da
 * campanha; o chamador é o responsável por não sobrescrever uma campanha que
 * já existe.
 */
export function buildJointResumeContext(
  input: BuildJointResumeContextInput,
): JointResumeContext {
  const uuid = input.uuid ?? randomUUID;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const squareDeliveryId = uuid();
    const baseRequestId = uuid();
    if (
      !isUuid(squareDeliveryId) ||
      !isUuid(baseRequestId) ||
      squareDeliveryId === baseRequestId ||
      squareDeliveryId === input.operationId ||
      baseRequestId === input.operationId
    ) {
      continue;
    }
    return Object.freeze({
      squareDeliveryId,
      initialRequestIds: Object.freeze({ base: baseRequestId }),
    });
  }
  throw new Error("joint_identity_generation_failed");
}

/** Lê de forma estrita; campos extras ou ID de expansão são inválidos. */
export function readJointResumeContext(
  snapshot: unknown,
): JointResumeContextRead {
  if (!isRecord(snapshot)) return { kind: "absent" };
  const raw = snapshot.jointResumeContext;
  if (raw === undefined) return { kind: "absent" };
  if (!isRecord(raw)) return { kind: "invalid", reason: "joint_context_not_object" };

  const allowed = new Set(["squareDeliveryId", "initialRequestIds"]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) {
      return { kind: "invalid", reason: `joint_context_unexpected_field:${key}` };
    }
  }
  if (!isUuid(raw.squareDeliveryId)) {
    return { kind: "invalid", reason: "square_delivery_id_invalid" };
  }
  if (!isRecord(raw.initialRequestIds)) {
    return { kind: "invalid", reason: "initial_request_ids_invalid" };
  }
  const initialKeys = Object.keys(raw.initialRequestIds);
  if (initialKeys.length !== 1 || initialKeys[0] !== "base") {
    return { kind: "invalid", reason: "initial_request_ids_must_only_contain_base" };
  }
  if (!isUuid(raw.initialRequestIds.base)) {
    return { kind: "invalid", reason: "initial_base_request_id_invalid" };
  }

  const context: JointResumeContext = Object.freeze({
    squareDeliveryId: raw.squareDeliveryId,
    initialRequestIds: Object.freeze({ base: raw.initialRequestIds.base }),
  });
  if (context.squareDeliveryId === context.initialRequestIds.base) {
    return { kind: "invalid", reason: "joint_identity_collision" };
  }
  return { kind: "found", context };
}

/** Remove a chave volátil antes de comparar hash de conteúdo. */
export function omitJointResumeContext<T extends Record<string, unknown>>(
  snapshot: T,
): Omit<T, "jointResumeContext"> {
  const copy = { ...snapshot };
  delete copy.jointResumeContext;
  return copy;
}
