/**
 * F56.2b1b (Plano 06 — correção) — CLASSIFICAÇÃO PERSISTIDA do fluxo da campanha.
 *
 * A presença do marcador `frozenContentReferences` no `input_snapshot` PERSISTIDO
 * da campanha é a ÚNICA fonte de verdade para decidir se a campanha pertence ao
 * NOVO fluxo Produto 1:1. O ramo do novo fluxo em `generate-image` grava a chave
 * SEMPRE na criação da campanha (inclusive com lista VAZIA), enquanto uma
 * campanha LEGADA nunca a carrega.
 *
 * NUNCA inferir o fluxo pela leitura (ou falha de leitura) da operação de crédito:
 * uma RPC ausente e uma operação inexistente NÃO são equivalentes. Um erro de
 * leitura da operação NÃO transforma uma campanha do novo fluxo em legado — quem
 * decide é a informação PERSISTIDA na própria campanha.
 */

/** Chave do marcador persistido no `campaigns.input_snapshot` (novo fluxo). */
export const FROZEN_CONTENT_REFERENCES_KEY = "frozenContentReferences" as const;

/**
 * `new_flow`      ⇒ o marcador PERSISTIDO está presente (campanha do novo fluxo).
 * `legacy`        ⇒ snapshot ausente OU objeto sem o marcador (legado PROVADO).
 * `indeterminate` ⇒ snapshot presente mas MALFORMADO (não-objeto) — o chamador
 *                   DEVE falhar fechado (nem legado, nem novo fluxo).
 */
export type CampaignFlowClassification = "new_flow" | "legacy" | "indeterminate";

export function classifyCampaignFlow(
  inputSnapshot: Record<string, unknown> | null | undefined,
): CampaignFlowClassification {
  // Ausência de snapshot: campanhas legadas podem não ter o snapshot persistido
  // (ou tê-lo sem o marcador). Sem marcador ⇒ LEGADO PROVADO.
  if (inputSnapshot === null || inputSnapshot === undefined) return "legacy";

  // Snapshot presente mas NÃO é um objeto JSON: classificação INDETERMINADA.
  if (typeof inputSnapshot !== "object" || Array.isArray(inputSnapshot)) {
    return "indeterminate";
  }

  return Object.prototype.hasOwnProperty.call(inputSnapshot, FROZEN_CONTENT_REFERENCES_KEY)
    ? "new_flow"
    : "legacy";
}

/** Atalho booleano — `true` SOMENTE para campanha do novo fluxo (marcador presente). */
export function isNewFlowCampaign(
  inputSnapshot: Record<string, unknown> | null | undefined,
): boolean {
  return classifyCampaignFlow(inputSnapshot) === "new_flow";
}
