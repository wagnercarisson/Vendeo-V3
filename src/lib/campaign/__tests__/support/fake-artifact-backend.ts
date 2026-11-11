import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * F60.2/F60.3 — Fake compartilhado da fronteira DB/Storage.
 *
 * Extraído de `square-preparation/__tests__/support/fake-artifact-backend.ts`
 * (F60.3, extração com re-export: o caminho antigo continua funcionando). O fake
 * é independente do fake local de `persist.contract.test.ts` (que não é
 * refatorado). Imita apenas o subconjunto do cliente Supabase usado por
 * `verifyCampaignAccess`, `getArtifactByIdentity`/`getArtifactById`/
 * `getArtifactByStoragePath`, `insertArtifactRow` e
 * `CompositionArtifactStorage.downloadBytes`/`readObjectInfo`/`uploadImmutable`.
 *
 * Nenhum estado global: cada caso cria a própria instância. Nenhuma rede,
 * banco, Storage real, IA ou chamada paga.
 */

const ARTIFACT_TABLE = "campaign_composition_artifacts";
export const DEFAULT_BUCKET = "campaign-internal-artifacts";

export type FakeRow = Record<string, unknown>;

export interface FakeUpload {
  readonly bucket: string;
  readonly path: string;
  readonly options: Record<string, unknown>;
}

export interface FakeHandles {
  readonly uploads: FakeUpload[];
  readonly inserts: FakeRow[];
  readonly downloads: string[];
  readonly infos: string[];
  signed: number;
  removes: number;
  updates: number;
  lists: number;
  rpcCalls: number;
}

export interface FakeObjectSnapshot {
  readonly checksumSha256: string;
  readonly byteSize: number;
  readonly metadata: Record<string, unknown>;
}

export interface FakeSourceSnapshot {
  readonly row: FakeRow | null;
  readonly object: FakeObjectSnapshot | null;
}

export interface ArtifactIdentityLike {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly role: string;
}

export interface FakeArtifactBackend {
  readonly client: SupabaseClient;
  readonly handles: FakeHandles;
  seedStore: (id: string, userId: string) => void;
  seedCampaign: (id: string, storeId: string) => void;
  seedArtifactRow: (row: FakeRow) => void;
  putObject: (
    path: string,
    bytes: Buffer,
    metadata?: Record<string, unknown>,
    bucket?: string,
  ) => void;
  removeObject: (path: string, bucket?: string) => void;
  replaceObjectBytes: (path: string, bytes: Buffer, bucket?: string) => void;
  hasObject: (path: string, bucket?: string) => boolean;
  objectBytes: (path: string, bucket?: string) => Buffer | null;
  rowsFor: (identity: ArtifactIdentityLike) => FakeRow[];
  rowsForPath: (storagePath: string) => FakeRow[];
  rowsForTable: (table: string) => FakeRow[];
  getObjectMetadata: (
    path: string,
    bucket?: string,
  ) => Record<string, unknown> | null;
  setObjectMetadata: (
    path: string,
    metadata: Record<string, unknown>,
    bucket?: string,
  ) => void;
  removeObjectMetadata: (path: string, bucket?: string) => void;
  snapshotSource: (path: string, bucket?: string) => FakeSourceSnapshot;
  failNextInsert: () => void;
  setUploadThrows: () => void;
  /** `setDownloadError(error)` é global; `setDownloadError(bucket, error)` é por bucket. */
  setDownloadError: (first: unknown, second?: unknown) => void;
  setInfoError: (error: unknown) => void;
  hideNextObjectInfo: (path: string) => void;
  /**
   * Faz a próxima leitura de `info(path)` falhar SOMENTE quando o objeto já
   * existe — isola a leitura pós-upload (ambiguidade após gravar).
   */
  hideNextObjectInfoWhenPresent: (path: string) => void;
  hideNextObjectDownload: (path: string) => void;
  /**
   * Define bytes de download explícitos para um path (sem criar objeto
   * observável em `info`/Storage). Útil para simular conteúdo divergente.
   */
  setDownloadBytes: (path: string, bytes: Buffer, bucket?: string) => void;
  removeDownloadBytes: (path: string, bucket?: string) => void;
  /** Faz o próximo insert da tabela falhar com violação de unicidade (23505). */
  setInsertUniqueViolationOnce: (table: string) => void;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function copyRow(row: FakeRow): FakeRow {
  return JSON.parse(JSON.stringify(row)) as FakeRow;
}

function camelizeMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    result[key === "vendeo_composition_artifact" ? "vendeoCompositionArtifact" : key] =
      value;
  }
  return result;
}

export function createFakeArtifactBackend(): FakeArtifactBackend {
  const handles: FakeHandles = {
    uploads: [],
    inserts: [],
    downloads: [],
    infos: [],
    signed: 0,
    removes: 0,
    updates: 0,
    lists: 0,
    rpcCalls: 0,
  };

  const rows: FakeRow[] = [];
  const objects = new Map<
    string,
    { bytes: Buffer; metadata: Record<string, unknown> }
  >();
  const hiddenInfo = new Set<string>();
  const hiddenInfoWhenPresent = new Set<string>();
  const hiddenDownload = new Set<string>();
  const downloadErrors = new Map<string, unknown>();
  const downloadOverrides = new Map<string, Buffer>();
  const uniqueViolationOnce = new Set<string>();

  let failNextInsert = false;
  let uploadThrows = false;
  let infoError: unknown = null;
  let rowCounter = 0;

  const key = (bucket: string, path: string) => `${bucket}:${path}`;

  function selectBuilder(table: string) {
    const filters: Array<[string, unknown]> = [];
    const matches = (entry: FakeRow): boolean =>
      entry.__table === table &&
      filters.every(([column, value]) =>
        value === null || value === undefined
          ? entry[column] === null || entry[column] === undefined
          : entry[column] === value,
      );
    const builder = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      /** `is(column, null)` — mesmo efeito de `eq` para nulo/ausente. */
      is(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      /** Ordenação é irrelevante para o subconjunto imitado: no-op encadeável. */
      order(_column?: string, _options?: unknown) {
        return builder;
      },
      limit(_count?: number) {
        return builder;
      },
      async maybeSingle() {
        const row = rows.find(matches);
        return { data: row ? copyRow(row) : null, error: null };
      },
      async single() {
        return builder.maybeSingle();
      },
    };
    return builder;
  }

  function insertBuilder(table: string, row: FakeRow) {
    handles.inserts.push(row);

    let data: FakeRow | null = null;
    let error: unknown = null;

    if (failNextInsert) {
      failNextInsert = false;
      error = { message: "injected_insert_failure" };
    } else if (uniqueViolationOnce.has(table)) {
      uniqueViolationOnce.delete(table);
      error = { code: "23505", message: "duplicate key value (injected)" };
    } else {
      const conflict =
        table === ARTIFACT_TABLE &&
        rows.some(
          (entry) =>
            entry.__table === ARTIFACT_TABLE &&
            ((entry.store_id === row.store_id &&
              entry.campaign_id === row.campaign_id &&
              entry.operation_id === row.operation_id &&
              entry.role === row.role) ||
              entry.storage_path === row.storage_path),
        );
      if (conflict) {
        error = { code: "23505", message: "duplicate key value" };
      } else {
        rowCounter += 1;
        const stored: FakeRow = {
          ...row,
          __table: table,
          id: `99999999-9999-4999-8999-${String(rowCounter).padStart(12, "0")}`,
          created_at: "2026-11-11T00:00:00.000Z",
        };
        rows.push(stored);
        data = copyRow(stored);
      }
    }

    const result = { data, error };
    return {
      select: () => ({ single: async () => result }),
    };
  }

  const client = {
    from(table: string) {
      return {
        select: () => selectBuilder(table),
        insert: (row: FakeRow) => insertBuilder(table, row),
        update: () => ({
          eq: async () => {
            handles.updates += 1;
            return { data: null, error: null };
          },
        }),
        delete: () => ({
          eq: async () => {
            handles.removes += 1;
            return { data: null, error: null };
          },
        }),
      };
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(
            path: string,
            bytes: Buffer | Uint8Array,
            options: Record<string, unknown> = {},
          ) {
            handles.uploads.push({ bucket, path, options });
            if (uploadThrows) throw new Error("upload_timeout");
            if (objects.has(key(bucket, path))) {
              return {
                data: null,
                error: { statusCode: "409", message: "already exists" },
              };
            }
            const metadata =
              (options.metadata as Record<string, unknown> | undefined) ?? {};
            objects.set(key(bucket, path), {
              bytes: Buffer.from(bytes),
              metadata: JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>,
            });
            return { data: { path }, error: null };
          },
          async download(path: string) {
            handles.downloads.push(path);
            if (hiddenDownload.has(path)) {
              hiddenDownload.delete(path);
              return {
                data: null,
                error: { statusCode: "404", message: "Object not found" },
              };
            }
            if (downloadErrors.has(bucket)) {
              return { data: null, error: downloadErrors.get(bucket) };
            }
            const override = downloadOverrides.get(key(bucket, path));
            if (override !== undefined) {
              return { data: Buffer.from(override), error: null };
            }
            const object = objects.get(key(bucket, path));
            if (!object) {
              return {
                data: null,
                error: { statusCode: "404", message: "Object not found" },
              };
            }
            return { data: Buffer.from(object.bytes), error: null };
          },
          async info(path: string) {
            handles.infos.push(path);
            if (
              hiddenInfoWhenPresent.has(path) &&
              objects.has(key(bucket, path))
            ) {
              hiddenInfoWhenPresent.delete(path);
              return {
                data: null,
                error: { statusCode: "503", message: "Service unavailable" },
              };
            }
            if (hiddenInfo.has(path)) {
              hiddenInfo.delete(path);
              return {
                data: null,
                error: { statusCode: "404", message: "Object not found" },
              };
            }
            if (infoError !== null) return { data: null, error: infoError };
            const object = objects.get(key(bucket, path));
            if (!object) {
              return {
                data: null,
                error: { statusCode: "404", message: "Object not found" },
              };
            }
            return {
              data: { metadata: camelizeMetadata(object.metadata) },
              error: null,
            };
          },
          async createSignedUrl() {
            handles.signed += 1;
            return { data: null, error: null };
          },
          getPublicUrl() {
            handles.signed += 1;
            return { data: { publicUrl: "https://example.invalid/public" } };
          },
          async remove() {
            handles.removes += 1;
            return { data: null, error: null };
          },
          async update() {
            handles.updates += 1;
            return { data: null, error: null };
          },
          async list() {
            handles.lists += 1;
            return { data: [], error: null };
          },
        };
      },
    },
    async rpc() {
      handles.rpcCalls += 1;
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;

  return {
    client,
    handles,
    seedStore: (id, userId) => {
      rows.push({ __table: "stores", id, user_id: userId });
    },
    seedCampaign: (id, storeId) => {
      rows.push({ __table: "campaigns", id, store_id: storeId });
    },
    seedArtifactRow: (row) => {
      rows.push({ ...row, __table: ARTIFACT_TABLE });
    },
    putObject: (path, bytes, metadata = {}, bucket = DEFAULT_BUCKET) => {
      objects.set(key(bucket, path), {
        bytes: Buffer.from(bytes),
        metadata: JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>,
      });
    },
    removeObject: (path, bucket = DEFAULT_BUCKET) => {
      objects.delete(key(bucket, path));
    },
    replaceObjectBytes: (path, bytes, bucket = DEFAULT_BUCKET) => {
      const object = objects.get(key(bucket, path));
      if (object) object.bytes = Buffer.from(bytes);
    },
    hasObject: (path, bucket = DEFAULT_BUCKET) =>
      objects.has(key(bucket, path)),
    objectBytes: (path, bucket = DEFAULT_BUCKET) => {
      const object = objects.get(key(bucket, path));
      return object ? Buffer.from(object.bytes) : null;
    },
    rowsFor: (identity) =>
      rows
        .filter(
          (entry) =>
            entry.__table === ARTIFACT_TABLE &&
            entry.store_id === identity.storeId &&
            entry.campaign_id === identity.campaignId &&
            entry.operation_id === identity.operationId &&
            entry.role === identity.role,
        )
        .map(copyRow),
    rowsForPath: (storagePath) =>
      rows
        .filter(
          (entry) =>
            entry.__table === ARTIFACT_TABLE &&
            entry.storage_path === storagePath,
        )
        .map(copyRow),
    rowsForTable: (table) =>
      rows.filter((entry) => entry.__table === table).map(copyRow),
    getObjectMetadata: (path, bucket = DEFAULT_BUCKET) => {
      const object = objects.get(key(bucket, path));
      return object
        ? (JSON.parse(JSON.stringify(object.metadata)) as Record<string, unknown>)
        : null;
    },
    setObjectMetadata: (path, metadata, bucket = DEFAULT_BUCKET) => {
      const object = objects.get(key(bucket, path));
      if (object) {
        object.metadata = JSON.parse(JSON.stringify(metadata)) as Record<
          string,
          unknown
        >;
      }
    },
    removeObjectMetadata: (path, bucket = DEFAULT_BUCKET) => {
      const object = objects.get(key(bucket, path));
      if (object) object.metadata = {};
    },
    snapshotSource: (path, bucket = DEFAULT_BUCKET) => {
      const row = rows.find(
        (entry) =>
          entry.__table === ARTIFACT_TABLE && entry.storage_path === path,
      );
      const object = objects.get(key(bucket, path));
      return {
        row: row ? copyRow(row) : null,
        object: object
          ? {
              checksumSha256: sha256(object.bytes),
              byteSize: object.bytes.byteLength,
              metadata: JSON.parse(
                JSON.stringify(object.metadata),
              ) as Record<string, unknown>,
            }
          : null,
      };
    },
    failNextInsert: () => {
      failNextInsert = true;
    },
    setUploadThrows: () => {
      uploadThrows = true;
    },
    setDownloadError: (first, second) => {
      if (typeof first === "string") {
        downloadErrors.set(first, second);
        return;
      }
      downloadErrors.set(DEFAULT_BUCKET, first);
    },
    setInfoError: (error) => {
      infoError = error;
    },
    hideNextObjectInfo: (path) => {
      hiddenInfo.add(path);
    },
    hideNextObjectInfoWhenPresent: (path) => {
      hiddenInfoWhenPresent.add(path);
    },
    hideNextObjectDownload: (path) => {
      hiddenDownload.add(path);
    },
    setDownloadBytes: (path, bytes, bucket = DEFAULT_BUCKET) => {
      downloadOverrides.set(key(bucket, path), Buffer.from(bytes));
    },
    removeDownloadBytes: (path, bucket = DEFAULT_BUCKET) => {
      downloadOverrides.delete(key(bucket, path));
    },
    setInsertUniqueViolationOnce: (table) => {
      uniqueViolationOnce.add(table);
    },
  };
}
