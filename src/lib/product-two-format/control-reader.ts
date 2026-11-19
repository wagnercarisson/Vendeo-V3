import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

import type {
  TwoFormatDeliveryView,
  TwoFormatFormatView,
} from "./read-model";

/**
 * F60.7 C3 — autoridade de leitura da campanha conjunta.
 *
 * A identidade financeira individual (`getCampaignOperation`) escolhe a linha
 * de crédito mais recente; numa campanha conjunta há duas reservas (quadrado e
 * vertical), então essa RPC não é autoridade para escolher a operação de
 * controle. O vínculo `product_two_format_deliveries` é a autoridade conjunta:
 * suas linhas apontam para a operação de controle e para a identidade
 * financeira própria do quadrado.
 *
 * Somente leitura, somente servidor, com filtro explícito de campanha/loja.
 * Nenhuma assinatura, RPC, sonda de Storage ou escrita.
 */

export type TwoFormatControlReadResult =
  | { readonly kind: "found"; readonly operationId: string }
  | { readonly kind: "not_found" }
  | { readonly kind: "inconsistent"; readonly reason: string }
  | { readonly kind: "read_failed"; readonly reason: string };

export interface TwoFormatControlReadInput {
  readonly campaignId: string;
  readonly storeId?: string;
  /** Injetável em testes; o padrão é o cliente privilegiado de servidor. */
  readonly client?: SupabaseClient;
}

/**
 * Resolve a operação de controle pela autoridade conjunta. Zero vínculos ou
 * mais de uma operação distinta falham fechado (nunca escolha arbitrária).
 */
export async function resolveTwoFormatControlOperation(
  input: TwoFormatControlReadInput,
): Promise<TwoFormatControlReadResult> {
  const client = input.client ?? supabaseAdmin;
  let query = client
    .from("product_two_format_deliveries")
    .select("operation_id")
    .eq("campaign_id", input.campaignId);
  if (input.storeId) {
    query = query.eq("store_id", input.storeId);
  }

  const { data, error } = await query;
  if (error) {
    return { kind: "read_failed", reason: error.message };
  }

  const operationIds = new Set<string>();
  for (const row of (data ?? []) as Array<{ operation_id?: unknown }>) {
    if (typeof row.operation_id === "string" && row.operation_id.length > 0) {
      operationIds.add(row.operation_id);
    }
  }

  if (operationIds.size === 0) return { kind: "not_found" };
  if (operationIds.size > 1) {
    return { kind: "inconsistent", reason: "multiple_control_operations" };
  }
  return { kind: "found", operationId: [...operationIds][0] };
}

export type TwoFormatDurableOutcomeReadResult =
  | {
      readonly kind: "found";
      /** Operações com outcome durável `unknown` e crédito NÃO terminal. */
      readonly unknownOperationIds: ReadonlySet<string>;
      /** Referência de suporte do controle, quando houver outcome durável. */
      readonly controlSupportReference: string | null;
    }
  | { readonly kind: "read_failed"; readonly reason: string };

export interface TwoFormatDurableOutcomeReadInput {
  readonly campaignId: string;
  readonly controlOperationId: string;
  readonly operations: readonly (string | null)[];
  readonly client?: SupabaseClient;
}

/**
 * Lê o outcome durável das duas identidades (controle e quadrado) pela view
 * canônica. A view é acessível apenas a `service_role` (grants existentes).
 *
 * O critério de "unknown" é aplicado pelo chamador somente a formatos ainda
 * `processing`: crédito terminal (`delivered`/`refunded`) prevalece.
 */
export async function readTwoFormatDurableOutcomes(
  input: TwoFormatDurableOutcomeReadInput,
): Promise<TwoFormatDurableOutcomeReadResult> {
  const operationIds = [
    ...new Set(
      [input.controlOperationId, ...input.operations].filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
    ),
  ];
  if (operationIds.length === 0) {
    return {
      kind: "found",
      unknownOperationIds: new Set(),
      controlSupportReference: null,
    };
  }

  const client = input.client ?? supabaseAdmin;
  const { data, error } = await client
    .from("product_generation_operation_outcomes_v")
    .select("operation_id, outcome, support_reference")
    .eq("campaign_id", input.campaignId)
    .in("operation_id", operationIds);

  if (error) {
    return { kind: "read_failed", reason: error.message };
  }

  const unknownOperationIds = new Set<string>();
  let controlSupportReference: string | null = null;
  for (const row of (data ?? []) as Array<{
    operation_id?: unknown;
    outcome?: unknown;
    support_reference?: unknown;
  }>) {
    if (typeof row.operation_id !== "string") continue;
    if (row.outcome === "unknown") {
      unknownOperationIds.add(row.operation_id);
    }
    if (
      row.operation_id === input.controlOperationId &&
      typeof row.support_reference === "string"
    ) {
      controlSupportReference = row.support_reference;
    }
  }

  return { kind: "found", unknownOperationIds, controlSupportReference };
}

/**
 * Aplica o outcome durável `unknown` aos formatos ainda `processing`.
 *
 * - leitura indisponível ⇒ fail-closed: todo `processing` vira `unknown`;
 * - operação com outcome `unknown` ⇒ seu formato `processing` vira `unknown`;
 * - `delivered`/`absent` (crédito terminal) NUNCA são rebaixados.
 */
export function applyTwoFormatDurableOutcomes(
  view: TwoFormatDeliveryView,
  input: {
    readonly unknownOperationIds: ReadonlySet<string>;
    readonly outcomesReadFailed: boolean;
    /** Operação de controle; `unknown` nela governa o conjunto não terminal. */
    readonly controlOperationId?: string;
  },
): TwoFormatDeliveryView {
  const controlUnknown =
    input.controlOperationId !== undefined &&
    input.unknownOperationIds.has(input.controlOperationId);
  // Precedência aceita: crédito COMPARTILHADO terminal (`delivered`/`absent`)
  // torna o outcome histórico do controle INERTE. Ele só bloqueia o irmão
  // enquanto a operação compartilhada não é terminal.
  const controlTerminal =
    view.vertical.state === "delivered" || view.vertical.state === "absent";
  const controlUnknownActive =
    !controlTerminal &&
    (controlUnknown ||
      view.vertical.state === "unknown" ||
      view.vertical.state === "unavailable");
  const apply = (formatView: TwoFormatFormatView): TwoFormatFormatView => {
    if (formatView.state !== "processing") return formatView;
    const unknown =
      input.outcomesReadFailed ||
      controlUnknownActive ||
      (formatView.deliveryOperationId !== null &&
        input.unknownOperationIds.has(formatView.deliveryOperationId));
    if (!unknown) return formatView;
    return Object.freeze({
      ...formatView,
      state: "unknown",
      artifactRole: null,
      artifactPath: null,
      supportReference: `two_format:${view.campaignId}:${formatView.format}`,
    });
  };

  const square = apply(view.square);
  const vertical = apply(view.vertical);
  if (square === view.square && vertical === view.vertical) return view;
  return Object.freeze({ ...view, square, vertical });
}
