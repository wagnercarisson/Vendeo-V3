import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LabModelTarget } from "./schemas";

/**
 * Validação do alvo de modelo contra o catálogo persistido da F47
 * (F48.1, D5/D6/D18).
 *
 * O catálogo é usado como **allowlist** em modo **somente leitura**: o laboratório
 * nunca cria, altera, deprecia ou promove linhas (T-48-1-25). A seleção produtiva
 * de modelos não participa desta validação.
 *
 * A linha precisa existir para a capacidade principal do laboratório e estar com
 * `status = 'active'`; qualquer outro caso é recusado antes de a criação ou a
 * execução começar.
 */

/** Capacidade principal do laboratório nesta fase. */
export const LAB_PRIMARY_CAPABILITY = "campaign_image" as const;

/**
 * Lançado quando o alvo não corresponde a uma linha ativa do catálogo. Carrega o
 * alvo recusado para diagnóstico sem ambiguidade.
 */
export class ModelTargetNotInCatalogError extends Error {
  readonly code = "model_target_not_in_catalog" as const;
  readonly target: LabModelTarget;

  constructor(target: LabModelTarget) {
    super(
      `model_target_not_in_catalog:${target.provider}/${target.model}/${target.protocol}`,
    );
    this.name = "ModelTargetNotInCatalogError";
    this.target = target;
  }
}

/**
 * Confirma que o alvo existe como linha **ativa** do catálogo para
 * `campaign_image`. Falha de leitura é fail-closed (a criação/execução não
 * prossegue sem confirmação).
 */
export async function validateModelTargetAgainstCatalog(
  target: LabModelTarget,
  client: SupabaseClient,
): Promise<{ ok: true }> {
  const { data, error } = await client
    .from("ai_model_catalog")
    .select("id")
    .eq("capability", LAB_PRIMARY_CAPABILITY)
    .eq("provider", target.provider)
    .eq("model", target.model)
    .eq("protocol", target.protocol)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`model_target_catalog_read_failed:${error.message}`);
  }

  if (!data) {
    throw new ModelTargetNotInCatalogError(target);
  }

  return { ok: true };
}
