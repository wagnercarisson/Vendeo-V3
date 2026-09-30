import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeAiErrorMessage } from "@/lib/ai/types";
import {
  LAB_ALLOWED_ARTIFACT_MIME_TYPES,
  LAB_ARTIFACT_BUCKET,
} from "@/lib/lab/persistence/artifact-service";
import type { LabArtifactMimeType } from "@/lib/lab/persistence/artifact-service";
import { listBenchArtifacts, persistBenchArtifact } from "./bench-artifact-service";
import {
  finalizeBenchRun,
  getBenchRun,
  getBenchRunByOperationId,
} from "./bench-run-service";

/**
 * Reuso seguro das **entradas de imagem** entre tentativas da bancada
 * (F48.2.4, D12; spec `lab-bench-run-history`).
 *
 * Uma nova tentativa parte de um run de origem **terminal** e **copia** os
 * objetos de entrada do run anterior para o prefixo do **novo** run
 * (`bench/{toRunId}/inputs/{index}.{ext}`) via download + `persistBenchArtifact`,
 * preservando MIME/dimensões/checksum. O guard de path (`isBenchInputReference`)
 * **não é relaxado**: cada run continua com referências sob seu **próprio**
 * prefixo. O bucket remoto `campaign-images` nunca é lido.
 *
 * ## Máquina de estados da tentativa (idempotência)
 *
 *  - a tentativa só parte de um run de origem **terminal**;
 *  - repetir o **mesmo** `operationId` com o draft **completo** (todas as entradas
 *    já copiadas) devolve o draft **sem nova cópia** (nenhum novo upload/objeto);
 *  - draft **incompleto** (cópia em andamento) ⇒ `attempt_preparing` (409 na rota),
 *    sem iniciar uma segunda cópia concorrente;
 *  - um run anterior com o mesmo `operationId` já finalizado como `failed` exige um
 *    **novo** `operationId` (`attempt_retry_requires_new_operation_id`);
 *  - **falha parcial** (ex.: falha na 2ª cópia) remove/marca como removidos
 *    (`removed_at`) **apenas** os artefatos criados **naquela tentativa** — nunca os
 *    do run de origem — e finaliza o draft como `failed` com **erro sanitizado**.
 *
 * O client Supabase entra **por parâmetro** (fakes em memória nos testes) — nenhuma
 * chamada de rede e nenhuma chamada paga.
 */

// ─── Códigos de erro estáveis (a rota mapeia em HTTP) ────────────────────────

export const BENCH_DUPLICATE_ERROR_CODES = [
  "bench_source_run_not_found",
  "bench_source_not_terminal",
  "attempt_run_not_found",
  "attempt_preparing",
  "attempt_retry_requires_new_operation_id",
  "attempt_duplicate_failed",
] as const;

export type BenchDuplicateErrorCode = (typeof BENCH_DUPLICATE_ERROR_CODES)[number];

/** Erro determinístico do reuso de entradas entre tentativas. */
export class BenchDuplicateError extends Error {
  readonly code: BenchDuplicateErrorCode;

  constructor(code: BenchDuplicateErrorCode) {
    super(code);
    this.name = "BenchDuplicateError";
    this.code = code;
  }
}

/** Estados terminais de um run (o run de origem precisa estar em um deles). */
const BENCH_TERMINAL_SOURCE_STATUSES = new Set<string>([
  "succeeded",
  "failed",
  "cancelled",
  "timeout",
]);

/** Código da falha de cópia parcial persistida como `error_type` do draft. */
export const BENCH_ATTEMPT_INPUT_COPY_FAILED = "bench_attempt_input_copy_failed";

// ─── Contrato ────────────────────────────────────────────────────────────────

export interface DuplicateBenchRunInputsParams {
  client: SupabaseClient;
  /** Run de origem (já terminal). */
  fromRunId: string;
  /** Run `draft` já reservado para a tentativa (novo `operationId`). */
  toRunId: string;
  /** `operationId` da tentativa (idempotência/estado). */
  attemptOperationId: string;
}

export interface DuplicateBenchRunInputsResult {
  runId: string;
  /** Referências do novo run (`bench/{toRunId}/inputs/...`). */
  references: string[];
  /** `true` quando o draft já estava completo (devolvido sem nova cópia). */
  idempotent: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INPUT_PATH_RE = /\/inputs\/(\d+)\.[A-Za-z0-9]+$/;

/** Índice preservado do path `bench/{runId}/inputs/{index}.{ext}`. */
function indexFromPath(storagePath: string): number {
  const match = INPUT_PATH_RE.exec(storagePath);
  if (!match) throw new Error("invalid_bench_input_path");
  return Number.parseInt(match[1], 10);
}

const EXTENSION_MIME: Record<string, LabArtifactMimeType> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** MIME do artefato de origem — usa o metadado quando válido, senão a extensão. */
function resolveMimeType(mimeType: string | null, storagePath: string): LabArtifactMimeType {
  if (mimeType && (LAB_ALLOWED_ARTIFACT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return mimeType as LabArtifactMimeType;
  }
  const ext = storagePath.slice(storagePath.lastIndexOf(".") + 1).toLowerCase();
  const inferred = EXTENSION_MIME[ext];
  if (!inferred) throw new Error("unsupported_artifact_mime_type");
  return inferred;
}

/**
 * Compensação de falha parcial: remove (best-effort) e marca `removed_at` **apenas**
 * os artefatos criados naquela tentativa. O run de origem nunca é tocado.
 */
async function compensateAttemptArtifacts(params: {
  client: SupabaseClient;
  created: readonly { artifactId: string; storagePath: string }[];
}): Promise<void> {
  const removedAt = new Date().toISOString();
  for (const artifact of params.created) {
    try {
      const { error } = await params.client.storage
        .from(LAB_ARTIFACT_BUCKET)
        .remove([artifact.storagePath]);
      if (error) {
        console.warn(`[bench-attempt] remoção de storage falhou para ${artifact.storagePath}`);
      }
    } catch (thrown) {
      const detail = thrown instanceof Error ? thrown.message : String(thrown);
      console.warn(`[bench-attempt] remoção de storage lançou: ${detail}`);
    }
    try {
      await params.client
        .from("lab_bench_artifacts")
        .update({ removed_at: removedAt })
        .eq("id", artifact.artifactId);
    } catch (thrown) {
      const detail = thrown instanceof Error ? thrown.message : String(thrown);
      console.warn(`[bench-attempt] marcação removed_at lançou: ${detail}`);
    }
  }
}

// ─── Reuso das entradas ──────────────────────────────────────────────────────

/**
 * Copia as entradas do run de origem para o prefixo do novo run, preservando
 * MIME/dimensões/checksum. Idempotente por `attemptOperationId` (ver máquina de
 * estados acima). Falha parcial compensa apenas os artefatos da tentativa e
 * finaliza o draft como `failed` com erro sanitizado.
 */
export async function duplicateBenchRunInputs(
  params: DuplicateBenchRunInputsParams,
): Promise<DuplicateBenchRunInputsResult> {
  const { client, fromRunId, toRunId, attemptOperationId } = params;

  // 1. Run de origem precisa existir e estar terminal.
  const source = await getBenchRun({ client, runId: fromRunId });
  if (!source) throw new BenchDuplicateError("bench_source_run_not_found");
  if (!BENCH_TERMINAL_SOURCE_STATUSES.has(source.status)) {
    throw new BenchDuplicateError("bench_source_not_terminal");
  }

  // 2. Máquina de estados da tentativa por `operationId`.
  const attempt = await getBenchRunByOperationId({ client, operationId: attemptOperationId });
  if (!attempt || attempt.id !== toRunId) {
    throw new BenchDuplicateError("attempt_run_not_found");
  }
  if (attempt.status === "failed") {
    throw new BenchDuplicateError("attempt_retry_requires_new_operation_id");
  }

  const sourceInputs = (await listBenchArtifacts({ client, runId: fromRunId })).filter(
    (artifact) => artifact.kind === "input",
  );
  const targetInputs = (await listBenchArtifacts({ client, runId: toRunId })).filter(
    (artifact) => artifact.kind === "input",
  );

  // Sem entradas a copiar: nada a fazer (draft permanece vazio).
  if (sourceInputs.length === 0) {
    return { runId: toRunId, references: [], idempotent: false };
  }

  // Draft completo ⇒ devolve sem nova cópia.
  if (targetInputs.length >= sourceInputs.length) {
    return {
      runId: toRunId,
      references: targetInputs.map((artifact) => artifact.storagePath),
      idempotent: true,
    };
  }

  // Draft incompleto (cópia em andamento) ⇒ 409 attempt_preparing.
  if (targetInputs.length > 0) {
    throw new BenchDuplicateError("attempt_preparing");
  }

  // 3. Cópia (download + persist) com compensação de falha parcial.
  const created: Array<{ artifactId: string; storagePath: string }> = [];
  try {
    for (const artifact of sourceInputs) {
      const { data, error } = await client.storage
        .from(LAB_ARTIFACT_BUCKET)
        .download(artifact.storagePath);
      if (error || !data) throw new Error("attempt_input_download_failed");

      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = resolveMimeType(artifact.mimeType, artifact.storagePath);

      const persisted = await persistBenchArtifact({
        client,
        runId: toRunId,
        kind: "input",
        buffer,
        mimeType,
        index: indexFromPath(artifact.storagePath),
        width: artifact.width,
        height: artifact.height,
      });

      created.push({ artifactId: persisted.artifactId, storagePath: persisted.storagePath });
    }
  } catch (thrown) {
    await compensateAttemptArtifacts({ client, created });
    const message = sanitizeAiErrorMessage(thrown instanceof Error ? thrown.message : String(thrown));
    try {
      await finalizeBenchRun({
        client,
        runId: toRunId,
        status: "failed",
        errorType: BENCH_ATTEMPT_INPUT_COPY_FAILED,
        errorMessage: message,
      });
    } catch {
      // Terminal é imutável — a compensação dos artefatos já foi feita.
    }
    throw new BenchDuplicateError("attempt_duplicate_failed");
  }

  const references = (await listBenchArtifacts({ client, runId: toRunId }))
    .filter((artifact) => artifact.kind === "input")
    .map((artifact) => artifact.storagePath);

  return { runId: toRunId, references, idempotent: false };
}
