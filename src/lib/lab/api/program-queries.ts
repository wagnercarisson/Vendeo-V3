import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { remainingUsd as computeRemainingUsd } from "@/lib/lab/domain/program-service";

/**
 * Camada de **leitura** dos programas de otimização do Laboratório de IA
 * (F48.2.1, D2/D9/D10).
 *
 * Um programa agrupa os experimentos do ciclo de um prompt do Diretor e mantém o
 * orçamento atômico em USD. Regras:
 *  - o client Supabase entra **por parâmetro** (testes usam fakes em memória —
 *    nenhuma chamada de rede e nenhuma chamada paga);
 *  - a superfície é **somente leitura**; a criação/autorização vive em
 *    `program-service.ts` e nas rotas;
 *  - nenhum conteúdo de cenário (nem base64 de imagens) é exposto — apenas
 *    metadados e o saldo.
 */

type Row = Record<string, unknown>;

function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

function asRow(data: unknown): Row | null {
  return data && typeof data === "object" ? (data as Row) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function num(value: unknown, fallback = 0): number {
  return numOrNull(value) ?? fallback;
}

/**
 * Saldo restante do programa: `budget_usd - budget_consumed_usd -
 * budget_reserved_usd`. Reexportado de `program-service` (fonte única da
 * definição de saldo — nunca duplicada).
 */
export const remainingUsd = computeRemainingUsd;

export interface LabProgramSummary {
  id: string;
  matrixVersion: string;
  status: string;
  budgetUsd: number | null;
  budgetReservedUsd: number;
  budgetConsumedUsd: number;
  remainingUsd: number | null;
  updatedAt: string;
}

export interface LabProgramDetail extends LabProgramSummary {
  budgetAuthorizedBy: string | null;
  budgetAuthorizedAt: string | null;
  finalReportRef: string | null;
  finalReportHash: string | null;
  recommendation: unknown;
  createdAt: string;
}

const PROGRAM_COLUMNS =
  "id, matrix_version, status, budget_usd, budget_reserved_usd, budget_consumed_usd, budget_authorized_by, budget_authorized_at, final_report_ref, final_report_hash, recommendation, created_at, updated_at";

function mapProgram(row: Row): LabProgramDetail {
  const budgetUsd = numOrNull(row.budget_usd);
  return {
    id: text(row.id),
    matrixVersion: text(row.matrix_version),
    status: text(row.status),
    budgetUsd,
    budgetReservedUsd: num(row.budget_reserved_usd),
    budgetConsumedUsd: num(row.budget_consumed_usd),
    remainingUsd: computeRemainingUsd({
      budget_usd: budgetUsd,
      budget_consumed_usd: num(row.budget_consumed_usd),
      budget_reserved_usd: num(row.budget_reserved_usd),
    }),
    budgetAuthorizedBy: text(row.budget_authorized_by) || null,
    budgetAuthorizedAt: text(row.budget_authorized_at) || null,
    finalReportRef: text(row.final_report_ref) || null,
    finalReportHash: text(row.final_report_hash) || null,
    recommendation: row.recommendation ?? null,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

/** Lista os programas mais recentes (default 20). */
export async function listPrograms(
  client: SupabaseClient,
  limit = 20,
): Promise<LabProgramSummary[]> {
  const { data, error } = await client
    .from("lab_prompt_programs")
    .select(PROGRAM_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`lab_prompt_programs_read_failed:${error.message}`);
  }

  return asRows(data).map((row) => {
    const detail = mapProgram(row);
    const { budgetAuthorizedBy, budgetAuthorizedAt, finalReportRef, finalReportHash, recommendation, createdAt, ...summary } = detail;
    void budgetAuthorizedBy;
    void budgetAuthorizedAt;
    void finalReportRef;
    void finalReportHash;
    void recommendation;
    void createdAt;
    return summary;
  });
}

/** Detalhe do programa por id; `null` quando ausente. */
export async function getProgramDetail(
  client: SupabaseClient,
  programId: string,
): Promise<LabProgramDetail | null> {
  const { data, error } = await client
    .from("lab_prompt_programs")
    .select(PROGRAM_COLUMNS)
    .eq("id", programId)
    .maybeSingle();

  if (error) {
    throw new Error(`lab_prompt_programs_read_failed:${error.message}`);
  }

  const row = asRow(data);
  return row ? mapProgram(row) : null;
}
