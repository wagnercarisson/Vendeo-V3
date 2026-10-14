/**
 * F56.2b2a (B2.1 / Plano 04, 3ª/4ª rodada — ligação iniciadora→resultado) —
 * HANDLE DE CONDUÇÃO da recuperação de copy.
 *
 * O fluxo de GERAÇÃO (aba que INICIA a geração elegível) registra este handle ao
 * receber o `result`; a página de resultado (`/campanhas/[id]`) o LÊ no mount para
 * derivar `isDriving` — `true` SOMENTE na aba INICIADORA, DENTRO do ciclo da
 * geração daquela aba. `reload`/outra aba NÃO têm o handle (memória do MÓDULO,
 * POR ABA, perdida no reload) ⇒ `isDriving === false` ⇒ apenas ACOMPANHAM o
 * estado do servidor (retomada MANUAL).
 *
 * O handle identifica a ABA/CICLO por `{ campaignId, operationId }` e NUNCA
 * carrega/imposa um `requestToken` único: cada NOVA tentativa (automáticas 2ª/3ª
 * e cada clique manual) gera o PRÓPRIO token no ponto de emissão (critério 27).
 *
 * G-NA: NÃO importa `@/lib/product-1-1` — módulo client-side puro (memória do
 * módulo), sem dependência da camada de produto.
 */

export interface CopyRecoveryDrivingHandle {
  readonly campaignId: string;
  readonly operationId: string;
}

/** Estado de MÓDULO (por aba). Perdido no `reload` — nunca persistido. */
let drivingHandle: CopyRecoveryDrivingHandle | null = null;

/**
 * Registra (substitui) o handle de condução desta aba para a identidade da
 * geração recém-iniciada. NÃO carrega `requestToken`.
 */
export function registerCopyRecoveryDrivingHandle(
  input: CopyRecoveryDrivingHandle,
): void {
  drivingHandle = Object.freeze({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
}

/** Lê o handle de condução atual da aba (`null` quando ausente/reload). */
export function readCopyRecoveryDrivingHandle(): CopyRecoveryDrivingHandle | null {
  return drivingHandle;
}

/**
 * `true` SOMENTE quando há handle NESTA aba E ele casa com a campanha/operação
 * consultadas (dentro do ciclo da geração da aba). `reload`/outra aba ⇒ `false`.
 */
export function isDrivingCopyRecovery(
  campaignId: string,
  operationId: string | null | undefined,
): boolean {
  if (!drivingHandle || !operationId) return false;
  return (
    drivingHandle.campaignId === campaignId &&
    drivingHandle.operationId === operationId
  );
}

/** Limpa o handle de condução (fim do ciclo / navegação explícita). */
export function clearCopyRecoveryDrivingHandle(): void {
  drivingHandle = null;
}
