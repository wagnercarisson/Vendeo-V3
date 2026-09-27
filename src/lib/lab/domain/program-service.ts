import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Serviço de programas do Laboratório de IA (F48.2.1, D2/D9/D10).
 *
 * Um **programa** agrupa os experimentos do ciclo de otimização de um prompt do
 * Diretor, registra os checkpoints (matriz aprovada, autorização de orçamento,
 * relatório e recomendação) e mantém o orçamento atômico em USD:
 * `budget_usd` (autorizado), `budget_reserved_usd` (reservado) e
 * `budget_consumed_usd` (consumido). O saldo restante é sempre
 * `budget_usd - budget_consumed_usd - budget_reserved_usd`.
 *
 * O client Supabase entra **por parâmetro** em todas as funções — testes usam
 * fakes em memória (nenhuma chamada de rede e nenhuma chamada paga). A
 * autorização de orçamento é um passo **separado** da criação do programa.
 */

// ─── Contexto e erros tipados ────────────────────────────────────────────────

export interface LabProgramContext {
  actorId: string;
  client: SupabaseClient;
}

export type LabProgramErrorCode =
  | "program_not_found"
  | "program_not_authorized"
  | "program_closed"
  | "budget_exceeded"
  | "program_write_failed";

/** Erro determinístico do serviço de programa (carrega o `code`). */
export class LabProgramError extends Error {
  readonly code: LabProgramErrorCode;

  constructor(code: LabProgramErrorCode) {
    super(code);
    this.name = "LabProgramError";
    this.code = code;
  }
}

// ─── Linha e saldo ───────────────────────────────────────────────────────────

export interface LabProgramRow {
  id: string;
  matrix_version: string;
  status: string;
  budget_usd: number | null;
  budget_reserved_usd: number;
  budget_consumed_usd: number;
  budget_authorized_by: string | null;
  budget_authorized_at: string | null;
  final_report_ref: string | null;
  final_report_hash: string | null;
  recommendation: unknown;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Saldo restante do programa: `budget_usd - budget_consumed_usd -
 * budget_reserved_usd`. Devolve `null` quando o orçamento ainda não foi
 * autorizado (`budget_usd` nulo).
 */
export function remainingUsd(
  program: Pick<LabProgramRow, "budget_usd" | "budget_consumed_usd" | "budget_reserved_usd">,
): number | null {
  const budget = toNumber(program.budget_usd);
  if (budget === null) return null;
  const consumed = toNumber(program.budget_consumed_usd) ?? 0;
  const reserved = toNumber(program.budget_reserved_usd) ?? 0;
  return budget - consumed - reserved;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Cria o programa com o rótulo da versão da matriz. A autorização de orçamento é
 * um passo separado (`authorizeProgramBudget`), no checkpoint humano.
 */
export async function createProgram(
  input: { matrixVersion: string },
  context: LabProgramContext,
): Promise<{ programId: string }> {
  const matrixVersion = input.matrixVersion?.trim();
  if (!matrixVersion) {
    throw new LabProgramError("program_write_failed");
  }

  const { data, error } = await context.client
    .from("lab_prompt_programs")
    .insert({ matrix_version: matrixVersion, status: "draft", created_by: context.actorId })
    .select("id")
    .single();

  if (error || !data) {
    throw new LabProgramError("program_write_failed");
  }

  return { programId: (data as { id: string }).id };
}

/**
 * Autoriza o teto de orçamento em USD (checkpoint humano). Grava `budget_usd`,
 * `budget_authorized_by`/`budget_authorized_at` e promove o status a
 * `authorized`.
 *
 * Fail-closed (C3): um programa `closed` teve a autorização **revogada** e é
 * terminal — a reautorização é recusada com `program_closed` ANTES de qualquer
 * escrita. Um programa ausente é recusado com `program_not_found`.
 */
export async function authorizeProgramBudget(params: {
  programId: string;
  budgetUsd: number;
  actorId: string;
  client: SupabaseClient;
}): Promise<void> {
  const budget = toNumber(params.budgetUsd);
  if (budget === null || budget <= 0) {
    throw new LabProgramError("budget_exceeded");
  }

  // Leitura do estado atual ANTES de escrever: `closed` é terminal.
  const current = await getProgram(params.programId, params.client);
  if (current.status === "closed") {
    throw new LabProgramError("program_closed");
  }

  const now = new Date().toISOString();
  const { data, error } = await params.client
    .from("lab_prompt_programs")
    .update({
      budget_usd: budget,
      budget_authorized_by: params.actorId,
      budget_authorized_at: now,
      status: "authorized",
      updated_at: now,
    })
    .eq("id", params.programId)
    .select("id");

  if (error) {
    throw new LabProgramError("program_write_failed");
  }
  if (!Array.isArray(data) || data.length !== 1) {
    throw new LabProgramError("program_not_found");
  }
}

/** Lê o programa por id (lança `program_not_found` quando ausente). */
export async function getProgram(
  programId: string,
  client: SupabaseClient,
): Promise<LabProgramRow> {
  const { data, error } = await client
    .from("lab_prompt_programs")
    .select("*")
    .eq("id", programId)
    .maybeSingle();

  if (error) {
    throw new LabProgramError("program_write_failed");
  }
  if (!data) {
    throw new LabProgramError("program_not_found");
  }

  return data as unknown as LabProgramRow;
}

/**
 * Encerra o programa revogando a autorização (C3/C4). Grava apenas
 * `status='closed'` + `updated_at`; **nunca** apaga/zerra `budget_usd`,
 * `budget_reserved_usd`, `budget_consumed_usd`, `budget_authorized_by` nem
 * `budget_authorized_at` — o histórico financeiro permanece auditável.
 *
 * `closed` é **terminal**: encerrar um programa já `closed` é idempotente (não
 * escreve nada). Um programa ausente é recusado com `program_not_found`.
 */
export async function closeProgram(params: {
  programId: string;
  actorId: string;
  client: SupabaseClient;
}): Promise<void> {
  const program = await getProgram(params.programId, params.client);

  // Idempotente: já encerrado não reescreve nada.
  if (program.status === "closed") {
    return;
  }

  const now = new Date().toISOString();
  const { data, error } = await params.client
    .from("lab_prompt_programs")
    .update({ status: "closed", updated_at: now })
    .eq("id", params.programId)
    .select("id");

  if (error) {
    throw new LabProgramError("program_write_failed");
  }
  if (!Array.isArray(data) || data.length !== 1) {
    throw new LabProgramError("program_not_found");
  }
}

/** Atualiza status, relatório e recomendação do programa (D10/D11). */
export async function updateProgram(
  programId: string,
  updates: {
    status?: "draft" | "authorized" | "closed";
    finalReportRef?: string;
    finalReportHash?: string;
    recommendation?: unknown;
  },
  client: SupabaseClient,
): Promise<void> {
  // Terminalidade (C3): `closed` não retorna a `draft`/`authorized`. Registrar
  // relatório/recomendação de um programa `closed` permanece permitido (registro
  // consultivo) — só a mudança de status é recusada.
  const current = await getProgram(programId, client);
  if (
    current.status === "closed" &&
    updates.status !== undefined &&
    updates.status !== "closed"
  ) {
    throw new LabProgramError("program_closed");
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.finalReportRef !== undefined) patch.final_report_ref = updates.finalReportRef;
  if (updates.finalReportHash !== undefined) patch.final_report_hash = updates.finalReportHash;
  if (updates.recommendation !== undefined) patch.recommendation = updates.recommendation;

  const { data, error } = await client
    .from("lab_prompt_programs")
    .update(patch)
    .eq("id", programId)
    .select("id");

  if (error) {
    throw new LabProgramError("program_write_failed");
  }
  if (!Array.isArray(data) || data.length !== 1) {
    throw new LabProgramError("program_not_found");
  }
}
