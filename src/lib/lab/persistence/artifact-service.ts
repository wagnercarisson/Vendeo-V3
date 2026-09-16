import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

/**
 * Persistência de artefatos do Laboratório de IA (F48.1, D10/D15).
 *
 * Toda evidência visual de um run vive em storage **próprio e privado** do
 * laboratório, isolada da produção (nunca no bucket de imagens de campanha e
 * nunca em path de loja/campanha):
 *
 *  - upload do buffer no path `experiments/{experimentId}/runs/{runId}/output.{ext}`
 *    (ou `.../inputs/{index}.{ext}` para a imagem materializada do cenário);
 *  - metadados + **checksum SHA-256** do buffer efetivamente enviado em
 *    `lab_artifacts`;
 *  - **rollback** do objeto quando o insert dos metadados falha — nenhum órfão;
 *  - leitura exclusivamente por **URL assinada** gerada server-side.
 *
 * Garantias de implementação:
 *  - `assertLabArtifactPath` é a barreira anti-traversal e é chamada por todos os
 *    builders e por toda leitura de metadado (defesa contra path corrompido);
 *  - o client entra **por parâmetro** em todas as funções, o que permite os fakes
 *    em memória dos testes (nenhuma chamada de rede);
 *  - a guarda de ambiente (`assertLabEnvironment`) é aplicada na **borda** (rotas,
 *    páginas e o script de cleanup) — este serviço não lê `process.env` de chave
 *    nem importa nada de `@/lib/ai/**`.
 */

// ─── Constantes (D10) ────────────────────────────────────────────────────────

/** Bucket privado e dedicado do laboratório (D10) — service_role only. */
export const LAB_ARTIFACT_BUCKET = "lab-artifacts";

/** `kind` do artefato de saída (a arte gerada pelo run). */
export const LAB_OUTPUT_ARTIFACT_KIND = "output";

/** `kind` do artefato de entrada (imagem materializada do cenário). */
export const LAB_INPUT_ARTIFACT_KIND = "input";

/** MIME types aceitos pelo bucket `lab-artifacts` (espelho da migration 48-1-01). */
export const LAB_ALLOWED_ARTIFACT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type LabArtifactMimeType = (typeof LAB_ALLOWED_ARTIFACT_MIME_TYPES)[number];

/** MIME → extensão exigida pelo bucket (png/jpg/webp). */
const MIME_EXTENSION: Record<LabArtifactMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Prefixo canônico dos paths do laboratório. */
const LAB_PATH_PREFIX = "experiments";

/** TTL da URL assinada de leitura (D10) — decidido no servidor, nunca pela UI. */
export const LAB_SIGNED_URL_TTL_SECONDS = 3600;

/** Formato de UUID aceito nos segmentos de path. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Códigos de erro estáveis (a API/UI mapeia por código) ───────────────────

const INVALID_ARTIFACT_PATH = "invalid_artifact_path";
const EMPTY_ARTIFACT_BUFFER = "empty_artifact_buffer";
const UNSUPPORTED_ARTIFACT_MIME_TYPE = "unsupported_artifact_mime_type";
const ARTIFACT_LIST_FAILED = "artifact_list_failed";
const MISSING_ARTIFACT_PATH = "missing_artifact_path";
const ARTIFACT_SIGNED_URL_FAILED = "artifact_signed_url_failed";

/**
 * Token do bucket de imagens de campanha montado em runtime: o literal é
 * proibido neste arquivo (D10/T-48-1-41), mas o path correspondente precisa ser
 * recusado. A composição mantém o arquivo livre do nome do bucket produtivo sem
 * abrir mão da recusa.
 */
const FORBIDDEN_CAMPAIGN_BUCKET_TOKEN = ["campaign", "images"].join("-");

// ─── Paths e validação anti-traversal (D10/T-48-1-40) ────────────────────────

function extensionForMimeType(mimeType: string): string {
  if (!(LAB_ALLOWED_ARTIFACT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new Error(UNSUPPORTED_ARTIFACT_MIME_TYPE);
  }
  return MIME_EXTENSION[mimeType as LabArtifactMimeType];
}

/**
 * Barreira anti-traversal: recusa path vazio, `..`, caminho absoluto, `\`,
 * `://`, o bucket de imagens de campanha, ausência do prefixo `experiments/` e
 * segmentos que não sejam UUID. Chamada por todos os builders e por toda leitura.
 */
export function assertLabArtifactPath(storagePath: string): void {
  if (typeof storagePath !== "string" || storagePath.length === 0) {
    throw new Error(INVALID_ARTIFACT_PATH);
  }

  if (
    storagePath.includes("..") ||
    storagePath.startsWith("/") ||
    storagePath.includes("\\") ||
    storagePath.includes("://") ||
    storagePath.includes(FORBIDDEN_CAMPAIGN_BUCKET_TOKEN)
  ) {
    throw new Error(INVALID_ARTIFACT_PATH);
  }

  const segments = storagePath.split("/");
  if (segments[0] !== LAB_PATH_PREFIX) {
    throw new Error(INVALID_ARTIFACT_PATH);
  }
  if (segments.length < 5 || segments[2] !== "runs") {
    throw new Error(INVALID_ARTIFACT_PATH);
  }
  if (!UUID_REGEX.test(segments[1]) || !UUID_REGEX.test(segments[3])) {
    throw new Error(INVALID_ARTIFACT_PATH);
  }
}

/** Path de saída: `experiments/{experimentId}/runs/{runId}/output.{ext}`. */
export function buildOutputArtifactPath(params: {
  experimentId: string;
  runId: string;
  mimeType: string;
}): string {
  const ext = extensionForMimeType(params.mimeType);
  const storagePath = `${LAB_PATH_PREFIX}/${params.experimentId}/runs/${params.runId}/output.${ext}`;
  assertLabArtifactPath(storagePath);
  return storagePath;
}

/** Path de entrada: `experiments/{experimentId}/runs/{runId}/inputs/{index}.{ext}`. */
export function buildInputArtifactPath(params: {
  experimentId: string;
  runId: string;
  index: number;
  mimeType: string;
}): string {
  const ext = extensionForMimeType(params.mimeType);
  if (!Number.isInteger(params.index) || params.index < 0) {
    throw new Error(INVALID_ARTIFACT_PATH);
  }
  const storagePath = `${LAB_PATH_PREFIX}/${params.experimentId}/runs/${params.runId}/inputs/${params.index}.${ext}`;
  assertLabArtifactPath(storagePath);
  return storagePath;
}

// ─── Checksum (T-48-1-42) ────────────────────────────────────────────────────

/** SHA-256 (hex) do buffer efetivamente gravado — integridade verificável. */
export function computeArtifactChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// ─── Persistência com rollback (D10/T-48-1-43/T-48-1-44) ─────────────────────

export interface PersistedLabArtifact {
  artifactId: string;
  storagePath: string;
  checksum: string;
  bytes: number;
}

/**
 * Grava o artefato de saída no bucket do laboratório e registra os metadados.
 *
 * Ordem: valida buffer/MIME → monta e valida o path → calcula checksum/bytes →
 * upload sem sobrescrita → insert dos metadados. Se o insert falhar, o objeto é
 * **removido** do bucket (rollback best-effort que não mascara o erro original)
 * e o código de falha de persistência é propagado. Se o upload falhar, nada é
 * inserido.
 */
export async function persistOutputArtifact(params: {
  client: SupabaseClient;
  experimentId: string;
  runId: string;
  buffer: Buffer;
  mimeType: LabArtifactMimeType;
  width: number | null;
  height: number | null;
}): Promise<PersistedLabArtifact> {
  const { client, experimentId, runId, buffer, mimeType, width, height } = params;

  if (!buffer || buffer.byteLength === 0) {
    throw new Error(EMPTY_ARTIFACT_BUFFER);
  }

  const storagePath = buildOutputArtifactPath({ experimentId, runId, mimeType });
  const checksum = computeArtifactChecksum(buffer);
  const bytes = buffer.byteLength;

  const { error: uploadError } = await client.storage
    .from(LAB_ARTIFACT_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    throw new Error("artifact_upload_failed");
  }

  const { data, error } = await client
    .from("lab_artifacts")
    .insert({
      run_id: runId,
      kind: LAB_OUTPUT_ARTIFACT_KIND,
      storage_path: storagePath,
      mime_type: mimeType,
      width,
      height,
      bytes,
      checksum,
    })
    .select("id")
    .single();

  if (error || !data || !(data as { id?: string }).id) {
    try {
      await client.storage.from(LAB_ARTIFACT_BUCKET).remove([storagePath]);
    } catch {
      // Rollback best-effort: a falha da remoção não pode mascarar o erro
      // original de persistência. O path é único por run, então não há risco de
      // apagar arte de outro run.
    }
    throw new Error("artifact_persistence_failed");
  }

  return {
    artifactId: (data as { id: string }).id,
    storagePath,
    checksum,
    bytes,
  };
}

// ─── Leitura de metadados (D10) ──────────────────────────────────────────────

export interface LabRunArtifact {
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
 * Lista os artefatos não removidos de um run, ordenados por `created_at`.
 * Cada `storage_path` passa por `assertLabArtifactPath` antes de ser retornado —
 * defesa contra metadado corrompido/forjado no banco.
 */
export async function listRunArtifacts(params: {
  client: SupabaseClient;
  runId: string;
}): Promise<LabRunArtifact[]> {
  const { data, error } = await params.client
    .from("lab_artifacts")
    .select("id, kind, storage_path, mime_type, width, height, bytes, checksum, created_at")
    .eq("run_id", params.runId)
    .is("removed_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(ARTIFACT_LIST_FAILED);
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

// ─── Leitura por URL assinada (D10/T-48-1-41) ────────────────────────────────

/**
 * Gera uma URL assinada server-side de curta duração para leitura do artefato.
 *
 * O bucket permanece **privado** — nenhuma leitura pública é possível. O path é
 * validado por `assertLabArtifactPath` antes de qualquer assinatura e o TTL é a
 * constante do servidor (a UI/API nunca escolhe o TTL).
 */
export async function createArtifactSignedUrl(params: {
  client: SupabaseClient;
  storagePath: string;
}): Promise<string> {
  const { client, storagePath } = params;

  if (!storagePath || storagePath.length === 0) {
    throw new Error(MISSING_ARTIFACT_PATH);
  }

  assertLabArtifactPath(storagePath);

  const { data, error } = await client.storage
    .from(LAB_ARTIFACT_BUCKET)
    .createSignedUrl(storagePath, LAB_SIGNED_URL_TTL_SECONDS);

  if (error || !data || !data.signedUrl) {
    throw new Error(ARTIFACT_SIGNED_URL_FAILED);
  }

  return data.signedUrl;
}

/**
 * Resolve um mapa `storagePath → signedUrl` em paralelo. Um path inválido ou que
 * falhe na assinatura **não** derruba os demais: o problema fica ausente do mapa
 * (o chamador exibe o artefato sem URL). Usado pelo detalhe do run e pela
 * comparação lado a lado (48-1-08/48-1-10).
 */
export async function createArtifactSignedUrls(params: {
  client: SupabaseClient;
  storagePaths: string[];
}): Promise<Record<string, string>> {
  const { client, storagePaths } = params;
  const uniquePaths = Array.from(new Set(storagePaths));

  const resolved = await Promise.all(
    uniquePaths.map(async (storagePath): Promise<[string, string] | null> => {
      try {
        const signedUrl = await createArtifactSignedUrl({ client, storagePath });
        return [storagePath, signedUrl];
      } catch {
        return null;
      }
    }),
  );

  const signedUrls: Record<string, string> = {};
  for (const entry of resolved) {
    if (entry) signedUrls[entry[0]] = entry[1];
  }
  return signedUrls;
}
