// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { computeArtifactChecksum } from "@/lib/lab/persistence/artifact-service";
import { parseBenchRunInput } from "../domain/schemas";
import {
  BENCH_ATTEMPT_INPUT_COPY_FAILED,
  BenchDuplicateError,
  duplicateBenchRunInputs,
} from "../persistence/duplicate-bench-run-inputs";
import {
  getBenchRun,
  listBenchRunLineage,
  listBenchRunLineagesByStore,
  reserveBenchRun,
} from "../persistence/bench-run-service";

/**
 * Contrato do **histórico de tentativas** da bancada (F48.2.4, D12/D13; spec
 * `lab-bench-run-history`).
 *
 * Prova, com um client fake **100% em memória** (nenhuma chamada de rede e
 * nenhuma chamada paga):
 *  - nova tentativa cria um **novo run** (`attempt_of_run_id` aponta para a origem);
 *  - o run anterior permanece **imutável** (entradas preservadas);
 *  - as entradas são **copiadas** para `bench/{novoRunId}/inputs/...` preservando
 *    MIME/dimensões/checksum;
 *  - **isolamento por paths**: cada run tem referências sob seu próprio prefixo e
 *    o guard (`isBenchInputReference`) não é relaxado;
 *  - **máquina de estados**: origem terminal; draft completo ⇒ devolvido sem nova
 *    cópia; draft incompleto ⇒ `attempt_preparing`; `operationId` anterior `failed`
 *    ⇒ novo `operationId` exigido;
 *  - **falha parcial** compensa apenas os artefatos da tentativa e finaliza o draft
 *    como `failed` com erro sanitizado;
 *  - **linhagem explícita**: raiz + descendentes ordenados por `created_at` e
 *    múltiplas linhagens separadas por loja (com descendentes `draft` sob a raiz).
 */

const ACTOR_ID = "66666666-6666-4666-8666-666666666666";
const STORE_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_STORE_ID = "33333333-3333-4333-8333-333333333344";
const SOURCE_RUN = "aaaaaaaa-0000-4000-8000-000000000001";
const ROOT_RUN = "aaaaaaaa-0000-4000-8000-000000000002";
const DESC_ONE = "aaaaaaaa-0000-4000-8000-000000000003";
const DESC_TWO = "aaaaaaaa-0000-4000-8000-000000000004";
const OTHER_ROOT = "bbbbbbbb-0000-4000-8000-000000000001";
const OP_ATTEMPT = "55555555-5555-4555-8555-555555555501";

const PNG_0 = Buffer.from("IMAGEM-ZERO");
const PNG_1 = Buffer.from("IMAGEM-UM");

// ─── Fake Supabase (memória) ─────────────────────────────────────────────────

type Row = Record<string, unknown>;

class FakeBuilder {
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private readonly predicates: Array<(row: Row) => boolean> = [];
  private readonly orders: Array<{ column: string; ascending: boolean }> = [];

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  select(): this {
    return this;
  }
  insert(payload: Row | Row[]): this {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row): this {
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  delete(): this {
    this.mode = "delete";
    return this;
  }
  eq(column: string, value: unknown): this {
    this.predicates.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: readonly unknown[]): this {
    this.predicates.push((row) => values.includes(row[column]));
    return this;
  }
  is(column: string, value: unknown): this {
    this.predicates.push((row) => (row[column] ?? null) === value);
    return this;
  }
  lt(column: string, value: unknown): this {
    this.predicates.push((row) => String(row[column] ?? "") < String(value));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }
  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.exec();
    if (result.error) return { data: null, error: result.error };
    return { data: (result.data as Row[])[0] ?? null, error: null };
  }
  async single(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.exec();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data as Row[];
    if (rows.length !== 1) return { data: null, error: { message: "not_single" } };
    return { data: rows[0], error: null };
  }
  then<T1 = { data: unknown; error: unknown }, T2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  private matched(): Row[] {
    const rows = this.db.tables[this.table] ?? [];
    return rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
  }
  private nextId(): string {
    this.db.seq += 1;
    return `00000000-0000-4000-8000-${String(this.db.seq).padStart(12, "0")}`;
  }
  private async exec(): Promise<{ data: unknown; error: unknown }> {
    if (this.mode === "insert") {
      const rows = (this.db.tables[this.table] ??= []);
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const inserted = payloads.map((payload) => {
        const row: Row = { id: this.nextId(), created_at: this.db.now(), ...payload };
        rows.push(row);
        return row;
      });
      return { data: inserted, error: null };
    }
    if (this.mode === "update") {
      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.payload ?? {});
      return { data: matched, error: null };
    }
    if (this.mode === "delete") {
      const rows = this.db.tables[this.table] ?? [];
      const matched = this.matched();
      for (const row of matched) {
        const index = rows.indexOf(row);
        if (index >= 0) rows.splice(index, 1);
      }
      return { data: matched, error: null };
    }
    let result = this.matched();
    for (const { column, ascending } of [...this.orders].reverse()) {
      result = [...result].sort((left, right) => {
        const a = String(left[column] ?? "");
        const b = String(right[column] ?? "");
        return ascending ? a.localeCompare(b) : b.localeCompare(a);
      });
    }
    return { data: result, error: null };
  }
}

class FakeDb {
  readonly tables: Record<string, Row[]> = {};
  readonly objects = new Map<string, Buffer>();
  readonly failDownload = new Set<string>();
  readonly throwDownload = new Set<string>();
  seq = 0;

  now(): string {
    return new Date().toISOString();
  }
  from(table: string): FakeBuilder {
    return new FakeBuilder(this, table);
  }
  readonly storage = {
    from: (_bucket: string) => ({
      upload: async (storagePath: string, body: Buffer) => {
        this.objects.set(storagePath, Buffer.from(body));
        return { data: { path: storagePath }, error: null };
      },
      download: async (storagePath: string) => {
        if (this.throwDownload.has(storagePath)) {
          throw new Error("https://api.exemplo.com sk-secret-leak");
        }
        if (this.failDownload.has(storagePath)) {
          return { data: null, error: { message: "download_failed" } };
        }
        const buffer = this.objects.get(storagePath);
        if (!buffer) return { data: null, error: { message: "not_found" } };
        const arrayBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer;
        return { data: { arrayBuffer: async () => arrayBuffer }, error: null };
      },
      remove: async (paths: string[]) => {
        for (const path of paths) this.objects.delete(path);
        return { data: null, error: null };
      },
      createSignedUrl: async (storagePath: string) => ({
        data: { signedUrl: `signed:${storagePath}` },
        error: null,
      }),
    }),
  };
}

function asClient(db: FakeDb): SupabaseClient {
  return db as unknown as SupabaseClient;
}

function seedRun(
  db: FakeDb,
  params: {
    id: string;
    status?: string;
    attemptOfRunId?: string | null;
    storeId?: string | null;
    createdAt?: string;
  },
): Row {
  const row: Row = {
    id: params.id,
    operation_id: `op-${params.id}`,
    status: params.status ?? "draft",
    created_by: ACTOR_ID,
    created_at: params.createdAt ?? db.now(),
    attempt_of_run_id: params.attemptOfRunId ?? null,
    branding_snapshot: params.storeId ? { storeId: params.storeId } : null,
  };
  (db.tables.lab_bench_runs ??= []).push(row);
  return row;
}

function seedInput(
  db: FakeDb,
  params: {
    id: string;
    runId: string;
    storagePath: string;
    buffer: Buffer;
    mimeType: string;
    width: number;
    height: number;
    createdAt?: string;
  },
): void {
  db.objects.set(params.storagePath, Buffer.from(params.buffer));
  (db.tables.lab_bench_artifacts ??= []).push({
    id: params.id,
    run_id: params.runId,
    kind: "input",
    storage_path: params.storagePath,
    mime_type: params.mimeType,
    width: params.width,
    height: params.height,
    bytes: params.buffer.byteLength,
    checksum: computeArtifactChecksum(params.buffer),
    removed_at: null,
    created_at: params.createdAt ?? db.now(),
  });
}

function inputArtifacts(db: FakeDb, runId: string): Row[] {
  return (db.tables.lab_bench_artifacts ?? []).filter(
    (row) => row.run_id === runId && row.kind === "input" && (row.removed_at ?? null) === null,
  );
}

let db: FakeDb;

beforeEach(() => {
  db = new FakeDb();
});

// ─── Cópia + imutabilidade + isolamento ──────────────────────────────────────

describe("duplicateBenchRunInputs — cópia, imutabilidade e isolamento por paths", () => {
  beforeEach(() => {
    seedRun(db, { id: SOURCE_RUN, status: "succeeded", storeId: STORE_ID });
    seedInput(db, {
      id: "src-art-0",
      runId: SOURCE_RUN,
      storagePath: `bench/${SOURCE_RUN}/inputs/0.png`,
      buffer: PNG_0,
      mimeType: "image/png",
      width: 10,
      height: 10,
    });
    seedInput(db, {
      id: "src-art-1",
      runId: SOURCE_RUN,
      storagePath: `bench/${SOURCE_RUN}/inputs/1.png`,
      buffer: PNG_1,
      mimeType: "image/png",
      width: 20,
      height: 20,
    });
  });

  it("cria novo run (attempt_of_run_id) e copia as entradas para o prefixo do novo run", async () => {
    const reserved = await reserveBenchRun({
      client: asClient(db),
      operationId: OP_ATTEMPT,
      createdBy: ACTOR_ID,
      attemptOfRunId: SOURCE_RUN,
    });

    const inserted = (db.tables.lab_bench_runs ?? []).find((row) => row.id === reserved.runId);
    expect(inserted?.attempt_of_run_id).toBe(SOURCE_RUN);

    const result = await duplicateBenchRunInputs({
      client: asClient(db),
      fromRunId: SOURCE_RUN,
      toRunId: reserved.runId,
      attemptOperationId: OP_ATTEMPT,
    });

    expect(result.idempotent).toBe(false);
    expect(result.references).toHaveLength(2);
    for (const reference of result.references) {
      expect(reference.startsWith(`bench/${reserved.runId}/inputs/`)).toBe(true);
      expect(reference.startsWith(`bench/${SOURCE_RUN}/inputs/`)).toBe(false);
    }

    // Metadados preservados (MIME/dimensões/checksum).
    const copied = inputArtifacts(db, reserved.runId).sort((a, b) =>
      String(a.storage_path).localeCompare(String(b.storage_path)),
    );
    expect(copied.map((row) => row.mime_type)).toEqual(["image/png", "image/png"]);
    expect(copied.map((row) => row.width)).toEqual([10, 20]);
    expect(copied.map((row) => row.height)).toEqual([10, 20]);
    expect(copied.map((row) => row.checksum)).toEqual([
      computeArtifactChecksum(PNG_0),
      computeArtifactChecksum(PNG_1),
    ]);
  });

  it("o run de origem permanece imutável (entradas e objetos preservados)", async () => {
    const reserved = await reserveBenchRun({
      client: asClient(db),
      operationId: OP_ATTEMPT,
      createdBy: ACTOR_ID,
      attemptOfRunId: SOURCE_RUN,
    });
    await duplicateBenchRunInputs({
      client: asClient(db),
      fromRunId: SOURCE_RUN,
      toRunId: reserved.runId,
      attemptOperationId: OP_ATTEMPT,
    });

    expect(inputArtifacts(db, SOURCE_RUN)).toHaveLength(2);
    expect(db.objects.has(`bench/${SOURCE_RUN}/inputs/0.png`)).toBe(true);
    expect(db.objects.has(`bench/${SOURCE_RUN}/inputs/1.png`)).toBe(true);
  });

  it("o guard de path do próprio run não é relaxado", async () => {
    const reserved = await reserveBenchRun({
      client: asClient(db),
      operationId: OP_ATTEMPT,
      createdBy: ACTOR_ID,
      attemptOfRunId: SOURCE_RUN,
    });
    const result = await duplicateBenchRunInputs({
      client: asClient(db),
      fromRunId: SOURCE_RUN,
      toRunId: reserved.runId,
      attemptOperationId: OP_ATTEMPT,
    });

    const base = {
      operationId: OP_ATTEMPT,
      storeId: STORE_ID,
      presetId: "gpt-image-2-low",
      prompt: "prompt",
      confirmed: true as const,
      product: { name: "Produto" },
      offer: {},
    };

    // Referências sob o prefixo do PRÓPRIO run: aceitas.
    expect(() =>
      parseBenchRunInput({ ...base, runId: reserved.runId, references: result.references }),
    ).not.toThrow();

    // Referências do novo run com o runId da ORIGEM: recusadas (guard intacto).
    expect(() =>
      parseBenchRunInput({ ...base, runId: SOURCE_RUN, references: result.references }),
    ).toThrow(/invalid_bench_reference_path/);
  });
});

// ─── Máquina de estados da tentativa ─────────────────────────────────────────

describe("duplicateBenchRunInputs — máquina de estados por operationId", () => {
  beforeEach(() => {
    seedRun(db, { id: SOURCE_RUN, status: "succeeded", storeId: STORE_ID });
    seedInput(db, {
      id: "src-art-0",
      runId: SOURCE_RUN,
      storagePath: `bench/${SOURCE_RUN}/inputs/0.png`,
      buffer: PNG_0,
      mimeType: "image/png",
      width: 10,
      height: 10,
    });
    seedInput(db, {
      id: "src-art-1",
      runId: SOURCE_RUN,
      storagePath: `bench/${SOURCE_RUN}/inputs/1.png`,
      buffer: PNG_1,
      mimeType: "image/png",
      width: 20,
      height: 20,
    });
  });

  it("repetir o mesmo operationId com draft completo devolve sem nova cópia", async () => {
    const reserved = await reserveBenchRun({
      client: asClient(db),
      operationId: OP_ATTEMPT,
      createdBy: ACTOR_ID,
      attemptOfRunId: SOURCE_RUN,
    });
    const first = await duplicateBenchRunInputs({
      client: asClient(db),
      fromRunId: SOURCE_RUN,
      toRunId: reserved.runId,
      attemptOperationId: OP_ATTEMPT,
    });
    const objectsBefore = db.objects.size;

    const second = await duplicateBenchRunInputs({
      client: asClient(db),
      fromRunId: SOURCE_RUN,
      toRunId: reserved.runId,
      attemptOperationId: OP_ATTEMPT,
    });

    expect(second.idempotent).toBe(true);
    expect(second.references).toEqual(first.references);
    expect(inputArtifacts(db, reserved.runId)).toHaveLength(2);
    expect(db.objects.size).toBe(objectsBefore);
  });

  it("draft incompleto (cópia em andamento) ⇒ attempt_preparing", async () => {
    const reserved = await reserveBenchRun({
      client: asClient(db),
      operationId: OP_ATTEMPT,
      createdBy: ACTOR_ID,
      attemptOfRunId: SOURCE_RUN,
    });
    // Simula 1 de 2 entradas já copiadas (cópia em andamento).
    seedInput(db, {
      id: "partial-0",
      runId: reserved.runId,
      storagePath: `bench/${reserved.runId}/inputs/0.png`,
      buffer: PNG_0,
      mimeType: "image/png",
      width: 10,
      height: 10,
    });

    await expect(
      duplicateBenchRunInputs({
        client: asClient(db),
        fromRunId: SOURCE_RUN,
        toRunId: reserved.runId,
        attemptOperationId: OP_ATTEMPT,
      }),
    ).rejects.toMatchObject({ name: "BenchDuplicateError", code: "attempt_preparing" });
  });

  it("operationId anterior já failed exige novo operationId", async () => {
    const reserved = await reserveBenchRun({
      client: asClient(db),
      operationId: OP_ATTEMPT,
      createdBy: ACTOR_ID,
      attemptOfRunId: SOURCE_RUN,
    });
    const attemptRow = (db.tables.lab_bench_runs ?? []).find((row) => row.id === reserved.runId);
    if (attemptRow) attemptRow.status = "failed";

    await expect(
      duplicateBenchRunInputs({
        client: asClient(db),
        fromRunId: SOURCE_RUN,
        toRunId: reserved.runId,
        attemptOperationId: OP_ATTEMPT,
      }),
    ).rejects.toMatchObject({ code: "attempt_retry_requires_new_operation_id" });
  });

  it("run de origem não terminal ⇒ bench_source_not_terminal", async () => {
    const running = seedRun(db, { id: DESC_ONE, status: "running", storeId: STORE_ID });
    expect(running.status).toBe("running");
    const reserved = await reserveBenchRun({
      client: asClient(db),
      operationId: OP_ATTEMPT,
      createdBy: ACTOR_ID,
      attemptOfRunId: DESC_ONE,
    });

    await expect(
      duplicateBenchRunInputs({
        client: asClient(db),
        fromRunId: DESC_ONE,
        toRunId: reserved.runId,
        attemptOperationId: OP_ATTEMPT,
      }),
    ).rejects.toMatchObject({ code: "bench_source_not_terminal" });
  });
});

// ─── Falha parcial ───────────────────────────────────────────────────────────

describe("duplicateBenchRunInputs — falha parcial", () => {
  it("compensa apenas a tentativa e finaliza o draft failed com erro sanitizado", async () => {
    seedRun(db, { id: SOURCE_RUN, status: "succeeded", storeId: STORE_ID });
    seedInput(db, {
      id: "src-art-0",
      runId: SOURCE_RUN,
      storagePath: `bench/${SOURCE_RUN}/inputs/0.png`,
      buffer: PNG_0,
      mimeType: "image/png",
      width: 10,
      height: 10,
    });
    seedInput(db, {
      id: "src-art-1",
      runId: SOURCE_RUN,
      storagePath: `bench/${SOURCE_RUN}/inputs/1.png`,
      buffer: PNG_1,
      mimeType: "image/png",
      width: 20,
      height: 20,
    });
    // 2ª cópia falha (download com segredo — deve ser sanitizado).
    db.throwDownload.add(`bench/${SOURCE_RUN}/inputs/1.png`);

    const reserved = await reserveBenchRun({
      client: asClient(db),
      operationId: OP_ATTEMPT,
      createdBy: ACTOR_ID,
      attemptOfRunId: SOURCE_RUN,
    });

    await expect(
      duplicateBenchRunInputs({
        client: asClient(db),
        fromRunId: SOURCE_RUN,
        toRunId: reserved.runId,
        attemptOperationId: OP_ATTEMPT,
      }),
    ).rejects.toBeInstanceOf(BenchDuplicateError);

    // Nenhum artefato órfão referenciado na tentativa.
    expect(inputArtifacts(db, reserved.runId)).toHaveLength(0);
    expect(db.objects.has(`bench/${reserved.runId}/inputs/0.png`)).toBe(false);

    // Origem intocada.
    expect(inputArtifacts(db, SOURCE_RUN)).toHaveLength(2);

    // Draft finalizado como failed com erro sanitizado.
    const attemptRow = (db.tables.lab_bench_runs ?? []).find((row) => row.id === reserved.runId);
    expect(attemptRow?.status).toBe("failed");
    expect(attemptRow?.error_type).toBe(BENCH_ATTEMPT_INPUT_COPY_FAILED);
    const message = String(attemptRow?.error_message ?? "");
    expect(message).not.toContain("sk-secret-leak");
    expect(message).not.toContain("api.exemplo.com");
  });
});

// ─── Linhagem explícita ──────────────────────────────────────────────────────

describe("linhagem explícita (sem nova tabela)", () => {
  it("listBenchRunLineage devolve raiz + descendentes ordenados por created_at", async () => {
    seedRun(db, { id: ROOT_RUN, status: "succeeded", storeId: STORE_ID, createdAt: "2026-09-01T00:00:00.000Z" });
    seedRun(db, {
      id: DESC_ONE,
      status: "succeeded",
      attemptOfRunId: ROOT_RUN,
      storeId: STORE_ID,
      createdAt: "2026-09-02T00:00:00.000Z",
    });
    seedRun(db, {
      id: DESC_TWO,
      status: "draft",
      attemptOfRunId: ROOT_RUN,
      createdAt: "2026-09-03T00:00:00.000Z",
    });

    const fromLeaf = await listBenchRunLineage({ client: asClient(db), runId: DESC_ONE });
    expect(fromLeaf.map((run) => run.id)).toEqual([ROOT_RUN, DESC_ONE, DESC_TWO]);

    const fromRoot = await listBenchRunLineage({ client: asClient(db), runId: ROOT_RUN });
    expect(fromRoot.map((run) => run.id)).toEqual([ROOT_RUN, DESC_ONE, DESC_TWO]);
  });

  it("listBenchRunLineagesByStore devolve linhagens separadas e inclui descendentes draft", async () => {
    seedRun(db, { id: ROOT_RUN, status: "succeeded", storeId: STORE_ID, createdAt: "2026-09-01T00:00:00.000Z" });
    seedRun(db, {
      id: DESC_ONE,
      status: "draft",
      attemptOfRunId: ROOT_RUN,
      createdAt: "2026-09-02T00:00:00.000Z",
    });
    seedRun(db, { id: OTHER_ROOT, status: "succeeded", storeId: STORE_ID, createdAt: "2026-09-03T00:00:00.000Z" });
    seedRun(db, { id: DESC_TWO, status: "succeeded", storeId: OTHER_STORE_ID, createdAt: "2026-09-04T00:00:00.000Z" });

    const lineages = await listBenchRunLineagesByStore({ client: asClient(db), storeId: STORE_ID });

    // Duas campanhas independentes da mesma loja ⇒ duas linhagens separadas.
    expect(lineages).toHaveLength(2);
    expect(lineages[0].root.id).toBe(ROOT_RUN);
    expect(lineages[0].runs.map((run) => run.id)).toEqual([ROOT_RUN, DESC_ONE]);
    expect(lineages[1].root.id).toBe(OTHER_ROOT);
    expect(lineages[1].runs.map((run) => run.id)).toEqual([OTHER_ROOT]);

    // Linhagem de outra loja não aparece.
    const allIds = lineages.flatMap((lineage) => lineage.runs.map((run) => run.id));
    expect(allIds).not.toContain(DESC_TWO);
  });
});
