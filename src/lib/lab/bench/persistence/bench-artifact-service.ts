import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LAB_ALLOWED_ARTIFACT_MIME_TYPES,
  LAB_ARTIFACT_BUCKET,
  assertLabArtifactPath,
  computeArtifactChecksum,
  createArtifactSignedUrl,
} from "@/lib/lab/persistence/artifact-service";
import type { LabArtifactMimeType } from "@/lib/lab/persistence/artifact-service";

/**
 * Persistência de artefatos da **bancada de geração** (F48.2.2, D5/D14).
 *
 * Reutiliza o bucket privado `lab-artifacts` (o mesmo do laboratório A/B) sob um
 * esquema de path **próprio da bancada**: `bench/{runId}/inputs/{index}.{ext}`
 * (entradas enviadas por upload) e `bench/{runId}/output.{ext}` (a saída gerada).
 * O bucket remoto de imagens de campanha **nunca** é lido nem gravado.
 *
 * Reutiliza `computeArtifactChecksum`, `assertLabArtifactPath`,
 * `createArtifactSignedUrl`, `LAB_ALLOWED_ARTIFACT_MIME_TYPES` e
 * `LAB_ARTIFACT_BUCKET` do serviço do laboratório — só os **builders de path** e a
 * tabela de metadados (`lab_bench_artifacts`) são novos.
 *
 * Garantias:
 *  - falha do insert de metadados após o upload **remove** o objeto do storage
 *    (nenhum órfão) e marca a geração reservada como `failed`
 *    (`artifact_persistence_failed`) via `finalizeRun` injetado — o run ainda
 *    está em `draft`, então o slot global nunca é ocupado;
 *  - o client entra **por parâmetro** (fakes em memória nos testes);
 *  - nenhuma leitura pública: toda leitura é por URL assinada server-side.
 */

// ─── Constantes (D14) ────────────────────────────────────────────────────────

/** Prefixo canônico dos paths da bancada. */
export const BENCH_ARTIFACT_PATH_PREFIX = "bench";

/** `kind` da entrada enviada por upload. */
export const BENCH_INPUT_ARTIFACT_KIND = "input";

/** `kind` da saída gerada. */
export const BENCH_OUTPUT_ARTIFACT_KIND = "output";

/** MIME → extensão exigida pelo bucket (png/jpg/webp). */
const MIME_EXTENSION: Record<LabArtifactMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// ─── Códigos de erro estáveis ────────────────────────────────────────────────

const INVALID_BENCH_ARTIFACT_PATH = "invalid_bench_artifact_path";
const EMPTY_BENCH_ARTIFACT_BUFFER = "empty_artifact_buffer";
const UNSUPPORTED_BENCH_ARTIFACT_MIME_TYPE = "unsupported_artifact_mime_type";
const BENCH_ARTIFACT_UPLOAD_FAILED = "artifact_upload_failed";
const BENCH_ARTIFACT_LIST_FAILED = "bench_artifact_list_failed";

/** Código da falha de persistência dos metadados (nenhum órfão é deixado). */
export const BENCH_ARTIFACT_PERSISTENCE_FAILED = "artifact_persistence_failed";

function extensionForMimeType(mimeType: string): string {
  if (!(LAB_ALLOWED_ARTIFACT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new Error(UNSUPPORTED_BENCH_ARTIFACT_MIME_TYPE);
  }
  return MIME_EXTENSION[mimeType as LabArtifactMimeType];
}

// ─── Builders de path (validados pelo guard do laboratório) ──────────────────

/** Path de entrada: `bench/{runId}/inputs/{index}.{ext}`. */
export function buildBenchInputArtifactPath(params: {
  runId: string;
  index: number;
  mimeType: string;
}): string {
  const ext = extensionForMimeType(params.mimeType);
  if (!Number.isInteger(params.index) || params.index < 0) {
    throw new Error(INVALID_BENCH_ARTIFACT_PATH);
  }
  const storagePath = `${BENCH_ARTIFACT_PATH_PREFIX}/${params.runId}/inputs/${params.index}.${ext}`;
  assertLabArtifactPath(storagePath);
  return storagePath;
}

/** Path de saída: `bench/{runId}/output.{ext}`. */
export function buildBenchOutputArtifactPath(params: {
  runId: string;
  mimeType: string;
}): string {
  const ext = extensionForMimeType(params.mimeType);
  const storagePath = `${BENCH_ARTIFACT_PATH_PREFIX}/${params.runId}/output.${ext}`;
  assertLabArtifactPath(storagePath);
  return storagePath;
}

// ─── Persistência com rollback (D5/T-48-2-2-13) ──────────────────────────────

export interface PersistedBenchArtifact {
  artifactId: string;
  storagePath: string;
  checksum: string;
  bytes: number;
}

/**
 * Dependência injetada para marcar a geração reservada como `failed` quando a
 * gravação dos metadados falha após o upload (o plano 06 injeta
 * `finalizeBenchRun`). Mantém os serviços desacoplados (sem dependência circular).
 */
export type BenchArtifactFinalizeRun = (params: {
  runId: string;
  status: "failed";
  errorType: string;
}) => Promise<void>;

/**
 * Grava uma entrada ou a saída da bancada no bucket `lab-artifacts` e registra os
 * metadados em `lab_bench_artifacts`.
 *
 * Ordem: valida buffer/MIME → monta e valida o path → calcula checksum/bytes →
 * upload sem sobrescrita → insert dos metadados. Se o insert falhar, o objeto é
 * **removido** (rollback best-effort) e, quando `finalizeRun` é injetado, a
 * geração reservada é marcada como `failed` (`artifact_persistence_failed`) —
 * sem órfão e sem ocupar o slot global (o run ainda está em `draft`). Se o upload
 * falhar, nada é inserido.
 */
export async function persistBenchArtifact(params: {
  client: SupabaseClient;
  runId: string;
  kind: typeof BENCH_INPUT_ARTIFACT_KIND | typeof BENCH_OUTPUT_ARTIFACT_KIND;
  buffer: Buffer;
  mimeType: LabArtifactMimeType;
  index?: number;
  width?: number | null;
  height?: number | null;
  finalizeRun?: BenchArtifactFinalizeRun;
}): Promise<PersistedBenchArtifact> {
  const { client, runId, kind, buffer, mimeType, finalizeRun } = params;

  if (!buffer || buffer.byteLength === 0) {
    throw new Error(EMPTY_BENCH_ARTIFACT_BUFFER);
  }

  const storagePath =
    kind === BENCH_INPUT_ARTIFACT_KIND
      ? buildBenchInputArtifactPath({ runId, index: params.index ?? -1, mimeType })
      : buildBenchOutputArtifactPath({ runId, mimeType });

  const checksum = computeArtifactChecksum(buffer);
  const bytes = buffer.byteLength;

  const { error: uploadError } = await client.storage
    .from(LAB_ARTIFACT_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    throw new Error(BENCH_ARTIFACT_UPLOAD_FAILED);
  }

  const { data, error } = await client
    .from("lab_bench_artifacts")
    .insert({
      run_id: runId,
      kind,
      storage_path: storagePath,
      mime_type: mimeType,
      width: params.width ?? null,
      height: params.height ?? null,
      bytes,
      checksum,
    })
    .select("id")
    .single();

  if (error || !data || !(data as { id?: string }).id) {
    // Rollback best-effort: o `remove` do Supabase **resolve** com `{ error }` em
    // falha (não lança), então o retorno é inspecionado. A falha do rollback é
    // registrada sem conteúdo sensível (apenas o path validado) e nunca mascara o
    // erro original de persistência.
    try {
      const { error: rollbackError } = await client.storage
        .from(LAB_ARTIFACT_BUCKET)
        .remove([storagePath]);
      if (rollbackError) {
        console.warn(
          `[bench-artifacts] rollback falhou para ${storagePath}: ${rollbackError.message}`,
        );
      }
    } catch (rollbackThrown) {
      const detail = rollbackThrown instanceof Error ? rollbackThrown.message : String(rollbackThrown);
      console.warn(`[bench-artifacts] rollback lançou para ${storagePath}: ${detail}`);
    }

    // Marca a geração reservada como falha (slot liberado). Best-effort: uma
    // falha aqui não pode substituir o código canônico de persistência.
    if (finalizeRun) {
      try {
        await finalizeRun({
          runId,
          status: "failed",
          errorType: BENCH_ARTIFACT_PERSISTENCE_FAILED,
        });
      } catch (finalizeThrown) {
        const detail =
          finalizeThrown instanceof Error ? finalizeThrown.message : String(finalizeThrown);
        console.warn(`[bench-artifacts] finalizeRun falhou para ${runId}: ${detail}`);
      }
    }

    throw new Error(BENCH_ARTIFACT_PERSISTENCE_FAILED);
  }

  return {
    artifactId: (data as { id: string }).id,
    storagePath,
    checksum,
    bytes,
  };
}

// ─── Leitura de metadados ────────────────────────────────────────────────────

export interface BenchRunArtifact {
  id: string;
  kind: string;
  storagePath: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  checksum: string | null;
  createdAt: string;
}

/**
 * Lista os artefatos não removidos de um run, ordenados por `created_at`. Cada
 * `storage_path` passa por `assertLabArtifactPath` antes de ser retornado —
 * defesa contra metadado corrompido/forjado no banco.
 */
export async function listBenchArtifacts(params: {
  client: SupabaseClient;
  runId: string;
}): Promise<BenchRunArtifact[]> {
  const { data, error } = await params.client
    .from("lab_bench_artifacts")
    .select("id, kind, storage_path, mime_type, width, height, bytes, checksum, created_at")
    .eq("run_id", params.runId)
    .is("removed_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(BENCH_ARTIFACT_LIST_FAILED);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const storagePath = row.storage_path as string;
    assertLabArtifactPath(storagePath);
    return {
      id: row.id as string,
      kind: row.kind as string,
      storagePath,
      mimeType: (row.mime_type as string | null) ?? null,
      width: (row.width as number | null) ?? null,
      height: (row.height as number | null) ?? null,
      bytes: (row.bytes as number | null) ?? null,
      checksum: (row.checksum as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}

// ─── Leitura por URL assinada (D14) ──────────────────────────────────────────

/**
 * Gera uma URL assinada server-side de curta duração para leitura do artefato da
 * bancada, reutilizando `createArtifactSignedUrl` (bucket `lab-artifacts`, TTL do
 * servidor). O path é validado pelo guard antes de qualquer assinatura.
 */
export async function createBenchArtifactSignedUrl(params: {
  client: SupabaseClient;
  storagePath: string;
}): Promise<string> {
  return createArtifactSignedUrl(params);
}
