import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import { parseResumeContext } from "./durable-input";

/**
 * Quick 261120-qvp (D-01/D-02/D-03/D-04) — leitor BEST-EFFORT do snapshot
 * econômico CONGELADO do run.
 *
 * Fonte única: `campaigns.input_snapshot.resumeContext.economicSnapshot`,
 * interpretado pelo parser já existente (`parseResumeContext`). A consulta é
 * restrita à identidade já validada (`campaigns.id = campaignId` E
 * `campaigns.store_id = storeId`) e seleciona apenas `input_snapshot`.
 *
 * Nunca lança e nunca consulta o parâmetro econômico VIGENTE: ausência de
 * linha, `resumeContext` ausente/malformado, exceção/rejeição do cliente e
 * timeout resultam em `null` explícito por campo (nunca zero, nunca fallback).
 */

/** Limite padrão de espera da leitura (2.000 ms, injetável para teste). */
export const ECONOMIC_SNAPSHOT_READ_TIMEOUT_MS = 2000;

export interface EconomicSnapshotValues {
  readonly usdBrlRateAtGeneration: number | null;
  readonly creditValueBrlAtGeneration: number | null;
}

export interface EconomicSnapshotReaderInput {
  readonly campaignId: string;
  readonly storeId: string;
  readonly client?: unknown;
  readonly timeoutMs?: number;
}

const NULLS: EconomicSnapshotValues = Object.freeze({
  usdBrlRateAtGeneration: null,
  creditValueBrlAtGeneration: null,
});

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeResult(value: unknown): EconomicSnapshotValues {
  if (value === null || typeof value !== "object") return NULLS;
  const record = value as Record<string, unknown>;
  return {
    usdBrlRateAtGeneration: finiteOrNull(record.usdBrlRateAtGeneration),
    creditValueBrlAtGeneration: finiteOrNull(record.creditValueBrlAtGeneration),
  };
}

/**
 * Lê o snapshot durável. O `client` é injetável (default `supabaseAdmin`).
 * Toda falha — síncrona, assíncrona ou PostgREST — degrada para `NULLS`.
 */
export async function readExpansionEconomicSnapshot(
  input: EconomicSnapshotReaderInput,
): Promise<EconomicSnapshotValues> {
  try {
    const client = (input.client ?? supabaseAdmin) as SupabaseClient;
    const { data, error } = await client
      .from("campaigns")
      .select("input_snapshot")
      .eq("id", input.campaignId)
      .eq("store_id", input.storeId)
      .maybeSingle();

    if (error || !data) return NULLS;

    const snapshot = (data as { input_snapshot?: unknown }).input_snapshot;
    const record: Record<string, unknown> =
      snapshot !== null && typeof snapshot === "object" && !Array.isArray(snapshot)
        ? (snapshot as Record<string, unknown>)
        : {};

    const parsed = parseResumeContext(record.resumeContext);
    if (!parsed.ok) return NULLS;

    return {
      usdBrlRateAtGeneration: finiteOrNull(
        parsed.context.economicSnapshot.usdBrlRateAtGeneration,
      ),
      creditValueBrlAtGeneration: finiteOrNull(
        parsed.context.economicSnapshot.creditValueBrlAtGeneration,
      ),
    };
  } catch {
    return NULLS;
  }
}

/**
 * Executa um THUNK de leitura sob um limite de espera injetável. O thunk é
 * invocado EXATAMENTE uma vez (nunca recebe uma promise já iniciada). Rejeição,
 * exceção síncrona, estouro do limite ou resultado inválido ⇒ `NULLS`. O timer
 * é sempre limpo em `finally`. `timeoutMs` ausente/não finito/≤ 0 usa o default
 * de 2.000 ms — nunca ilimitado.
 */
export async function withEconomicReadBudget(
  read: () => Promise<EconomicSnapshotValues>,
  timeoutMs?: number,
): Promise<EconomicSnapshotValues> {
  const budget =
    typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : ECONOMIC_SNAPSHOT_READ_TIMEOUT_MS;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<EconomicSnapshotValues>((resolve) => {
    timer = setTimeout(() => resolve(NULLS), budget);
  });

  try {
    const result = await Promise.race([Promise.resolve().then(read), timeout]);
    return normalizeResult(result);
  } catch {
    return NULLS;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
