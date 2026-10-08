import type {
  CurrentStageAuthorization,
  ProductFlowScope,
  StageAuthorizationEvent,
} from "./types";

/**
 * Deriva o estado corrente a partir do histórico append-only.
 *
 * Regras:
 * - eventos `refused` não alteram o estado (foram recusados);
 * - `granted` define o estágio vigente;
 * - `revoked` retorna o escopo para `off` (registrando o instante da revogação).
 *
 * O histórico assume ordenação ascendente por `createdAtMs`; a função também
 * ordena defensivamente. Não realiza I/O.
 */
export function deriveCurrentAuthorization(
  events: readonly StageAuthorizationEvent[],
  scope: ProductFlowScope,
  instanceIdentity: string,
): CurrentStageAuthorization | null {
  const relevant = events
    .filter((event) => event.scope === scope && event.instanceIdentity === instanceIdentity)
    .slice()
    .sort((a, b) => a.createdAtMs - b.createdAtMs);

  let current: CurrentStageAuthorization | null = null;

  for (const event of relevant) {
    if (event.eventType === "refused") {
      continue;
    }

    if (event.eventType === "granted") {
      current = {
        stage: event.stage,
        scope: event.scope,
        instanceIdentity: event.instanceIdentity,
        expiresAtMs: event.expiresAtMs,
        revokedAtMs: null,
      };
      continue;
    }

    current = {
      stage: "off",
      scope: event.scope,
      instanceIdentity: event.instanceIdentity,
      expiresAtMs: null,
      revokedAtMs: event.createdAtMs,
    };
  }

  return current;
}
