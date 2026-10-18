// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import { ProductOneToOnePendingResolutionSchema } from "@/lib/admin/schemas";
import {
  resolutionErrorStatus,
  resolvePendingOperation,
} from "../pending/resolve-pending-operation";
import {
  SupabasePendingOperationsRepository,
  type PendingOperationState,
} from "../pending/pending-operations-repository";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 07: resolução administrativa auditada de pendências
// (B1B-D5 / REQ-56.2.2-08). Contract test estático + simulado, sem banco, sem
// provider, sem crédito (a migration é apenas AUTORADA aqui — LOCAL-ONLY;
// aplicação só no Plano 09 / O2).
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261009000002_f56_2b1b_pending_resolution.sql";
const migrationPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);

const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const activeLines = sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0);
const activeSql = activeLines.join("\n");

describe("F56.2b1b — migration 20261009000002 pending_resolution (contrato estático)", () => {
  it("é LOCAL-ONLY, sem comando mutável remoto e com bloco REVERT", () => {
    expect(activeLines.filter((l) => /db push/i.test(l))).toEqual([]);
    expect(sql).toMatch(/LOCAL-ONLY/);
    expect(sql).toMatch(/REVERT/);
  });

  it("estende o CHECK de `admin_audit_log.action` com a ação auditada (preservando os valores anteriores)", () => {
    expect(activeSql).toMatch(
      /ALTER TABLE public\.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_action_check/,
    );
    expect(activeSql).toMatch(/product_1_1_pending_resolution/);
    // Preserva valores históricos conhecidos (não cria conjunto divergente).
    expect(activeSql).toMatch(/image_model_pair_config_update/);
    expect(activeSql).toMatch(/manual_refund/);
  });

  it("cria a RPC auditada `admin_resolve_product_1_1_pending` com SECURITY DEFINER e search_path vazio", () => {
    expect(activeSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.admin_resolve_product_1_1_pending\(/,
    );
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
  });

  it("guarda motivo/ator/operação e idempotência por `resolution_operation_id` via `admin_audit_log`", () => {
    expect(activeSql).toMatch(/RAISE EXCEPTION 'missing_reason'/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'missing_actor_id'/);
    // F2 — a colisão é detectada de forma INDEPENDENTE de `action`: a consulta a
    // `admin_audit_log` filtra SOMENTE por `operation_id` (sem `action =`).
    expect(activeSql).toMatch(
      /FROM public\.admin_audit_log\s+WHERE operation_id = p_resolution_operation_id;/,
    );
    expect(activeSql).not.toMatch(/operation_id = p_resolution_operation_id\s+AND action =/);
    expect(activeSql).toMatch(
      /INSERT INTO public\.admin_audit_log[\s\S]*?'product_1_1_pending_resolution'/,
    );
  });

  it("F2 — protege a identidade GLOBAL de `resolution_operation_id` com trava ADVISORY de transação, ANTES da trava C4 e de qualquer efeito", () => {
    // Trava advisory namespaced e determinística sobre a identidade de resolução.
    expect(activeSql).toMatch(
      /PERFORM pg_advisory_xact_lock\(hashtext\('p1_1_pending_resolution:' \|\| p_resolution_operation_id::text\)\);/,
    );
    // Ordem: guardas de evidência → advisory global → trava C4 (FOR UPDATE).
    const advisoryIdx = activeSql.indexOf("pg_advisory_xact_lock");
    const forUpdateIdx = activeSql.indexOf("FOR UPDATE");
    expect(advisoryIdx).toBeGreaterThan(-1);
    expect(forUpdateIdx).toBeGreaterThan(advisoryIdx);
  });

  it("F2 — colisão INDEPENDENTE de `action`: id já usado por OUTRA ação ou conteúdo divergente ⇒ `operation_identity_conflict`", () => {
    // A checagem exige que a ação existente seja `product_1_1_pending_resolution`
    // E que TODO o conteúdo seja equivalente; caso contrário ⇒ conflito.
    expect(activeSql).toMatch(/v_existing_action = 'product_1_1_pending_resolution'/);
    expect(activeSql).toMatch(/reason', 'operation_identity_conflict'/);
    // Belt-and-suspenders: `unique_violation` no INSERT do audit ⇒ conflito
    // (transação abortada — nenhum efeito financeiro parcial permanece).
    expect(activeSql).toMatch(/EXCEPTION WHEN unique_violation THEN/);
    expect(activeSql).toMatch(
      /EXCEPTION WHEN unique_violation THEN\s+RAISE EXCEPTION 'operation_identity_conflict';/,
    );
  });

  it("C4 — toma a MESMA trava `FOR UPDATE` da linha de crédito ANTES das verificações/transições", () => {
    expect(activeSql).toMatch(
      /FROM public\.product_1_1_campaign_credit_operations[\s\S]*?FOR UPDATE/,
    );
  });

  it("F5/C2 — evidência TIPADA derivada server-side; `invalid`/`indeterminate` BLOQUEIAM; refund só com `absent`", () => {
    expect(activeSql).toMatch(
      /v_art_kind NOT IN \('integral','absent','invalid','indeterminate'\)/,
    );
    expect(activeSql).toMatch(/v_art_kind IN \('invalid','indeterminate'\)/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'insufficient_evidence'/);
    expect(activeSql).toMatch(/v_art_kind <> 'absent'/);
    expect(activeSql).toMatch(/v_art_kind <> 'integral'/);
  });

  it("F5 — recusa evidência sem marca de verificação server-side e revalida o estado antes da transição", () => {
    expect(activeSql).toMatch(/jsonb_typeof\(p_evidence\) <> 'object'/);
    expect(activeSql).toMatch(/server-derived/);
    expect(activeSql).toMatch(/jsonb_typeof\(p_evidence->'execution_ended'\) <> 'boolean'/);
  });

  it("F5/C2 — guarda de execução ativa (`operation_in_progress`) via claim `in_progress`", () => {
    expect(activeSql).toMatch(
      /FROM public\.product_1_1_generation_attempt_claims[\s\S]*?status = 'in_progress'/,
    );
    expect(activeSql).toMatch(/RAISE EXCEPTION 'operation_in_progress'/);
  });

  it("F1 — REVALIDA `execution_ended` SOB A TRAVA: o valor autoritativo é DERIVADO do estado travado, nunca da evidência (stale)", () => {
    // Derivação SOB a trava (após `FOR UPDATE` e o `EXISTS` de claim `in_progress`).
    expect(activeSql).toMatch(/v_execution_ended := NOT v_in_progress/);
    // O valor da EVIDÊNCIA não governa a decisão: não há atribuição stale.
    expect(activeSql).not.toMatch(
      /v_execution_ended := \(p_evidence->>'execution_ended'\)::boolean/,
    );
    // Ordem: trava C4 → EXISTS `in_progress` → derivação sob a trava → recusa.
    const lockIdx = activeSql.indexOf("FOR UPDATE");
    const inProgressIdx = activeSql.indexOf("status = 'in_progress'");
    const derivedIdx = activeSql.indexOf("v_execution_ended := NOT v_in_progress");
    const raiseIdx = activeSql.indexOf("operation_in_progress");
    expect(lockIdx).toBeGreaterThan(-1);
    expect(inProgressIdx).toBeGreaterThan(lockIdx);
    expect(derivedIdx).toBeGreaterThan(inProgressIdx);
    expect(raiseIdx).toBeGreaterThan(derivedIdx);
  });

  it("F2(b) — a equivalência do replay inclui `actor_id` e o `reason` (TRIM) ⇒ divergência de administrador/motivo ⇒ conflito", () => {
    expect(activeSql).toMatch(/v_existing_actor = p_actor_id/);
    expect(activeSql).toMatch(/v_existing_reason = btrim\(p_reason\)/);
  });

  it("F2(c) — a checagem de idempotência do audit ocorre DEPOIS da trava (replays concorrentes serializam) e usa o índice único parcial", () => {
    const lockIdx = activeSql.indexOf("FOR UPDATE");
    const auditIdx = activeSql.indexOf("FROM public.admin_audit_log");
    expect(lockIdx).toBeGreaterThan(-1);
    expect(auditIdx).toBeGreaterThan(lockIdx);
    expect(sql).toMatch(/idx_admin_audit_log_operation/);
  });

  it("F5 — conflito de conteúdo devolve `operation_identity_conflict` (nunca sucesso enganoso)", () => {
    expect(activeSql).toMatch(/reason', 'operation_identity_conflict'/);
  });

  it("F5 — arte íntegra com operação `reserved` registra `art_uploaded` E entrega na MESMA transação", () => {
    expect(activeSql).toMatch(
      /PERFORM public\.product_1_1_mark_campaign_credit_art_uploaded\(/,
    );
    expect(activeSql).toMatch(
      /PERFORM public\.product_1_1_deliver_campaign_credit_operation\(/,
    );
    expect(activeSql).toMatch(
      /PERFORM public\.product_1_1_refund_campaign_credit_operation\(/,
    );
  });

  it("E1 — CONSUME o status TERMINAL `abandoned` (já definido no Plano 03) sem criar conjunto divergente de status", () => {
    expect(activeSql).toMatch(/status = 'abandoned'/);
    // Esta migration NÃO recria a CHECK de claims de tentativa (o status vive no
    // Plano 03 / 20261009000001); nenhuma CHECK divergente é introduzida aqui.
    expect(activeSql).not.toMatch(/ck_p1_1_attempt_claim_status/);
    expect(activeSql).not.toMatch(
      /CHECK \(status IN \('in_progress','done','failed','abandoned'\)\)/,
    );
  });

  it("E1 — finaliza o claim `in_progress` residual NA MESMA transação da transição (sem COMMIT intermediário)", () => {
    expect(activeSql).toMatch(
      /UPDATE public\.product_1_1_generation_attempt_claims[\s\S]*?SET status = 'abandoned'/,
    );
    expect(activeSql).toMatch(/v_in_progress AND NOT v_execution_ended/);
    // Único commit: nenhum COMMIT intermediário no corpo do RPC.
    expect(activeSql).not.toMatch(/\bCOMMIT\b/);
  });

  it("privilégios: execução apenas por service_role (REVOKE de PUBLIC/anon/authenticated)", () => {
    expect(activeSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.admin_resolve_product_1_1_pending\([^)]*\) FROM PUBLIC, anon, authenticated/,
    );
    expect(activeSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.admin_resolve_product_1_1_pending\([^)]*\) TO service_role/,
    );
  });

  it("NENHUM caminho de re-queue/nova geração/chamada ao provider", () => {
    expect(activeSql).not.toMatch(/provider/i);
    expect(activeSql).not.toMatch(/enqueue|requeue|re-queue|new_generation/i);
  });

  it("D13 — risco aceito só na b1b inativa + GATE bloqueante da b2 (limitação documentada, sem recuperabilidade completa)", () => {
    // O texto de D13 (limitação/comentário) afirma: sem fonte operacional
    // comprovada de encerramento ⇒ resolução BLOQUEADA (sem estorno/nova
    // geração/retomada); b1b NÃO declara recuperabilidade completa; evidência
    // simulada NÃO é prova operacional; GATE obrigatório da b2.
    expect(sql).toMatch(/D13/);
    expect(sql).toMatch(/risco (?:explicitamente )?aceito/i);
    expect(sql).toMatch(/n[ãa]o declara recuperabilidade completa/i);
    expect(sql).toMatch(/evid[êe]ncia simulada/i);
    expect(sql).toMatch(/GATE/i);
    expect(sql).toMatch(/b2/);
  });
});

// ---------------------------------------------------------------------------
// Task 2 — repositório/serviço/rota/schema (simulado, sem banco/provider)
// ---------------------------------------------------------------------------

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "44444444-4444-4444-8444-444444444444";
const RESOLUTION_ID = "55555555-5555-4555-8555-555555555555";

interface FakeBuilder {
  select: ReturnType<typeof vi.fn>;
}

/** Builder Supabase fake mínimo (select/eq/order/maybeSingle/in). */
function createFakeClient(tables: {
  credit?: Record<string, unknown> | null;
  creditList?: Record<string, unknown>[];
  claims?: Record<string, unknown>[];
  outcome?: Record<string, unknown> | null;
}) {
  const storage = {
    from: vi.fn(() => ({
      download: vi.fn(async () => ({ data: null, error: { message: "Object not found", statusCode: "404" } })),
      upload: vi.fn(async () => ({ data: null, error: null })),
      createSignedUrl: vi.fn(async (p: string) => ({ data: { signedUrl: `signed://${p}` }, error: null })),
    })),
  };

  const from = vi.fn((table: string) => {
    const rowsFor = () => {
      if (table === "product_1_1_campaign_credit_operations") {
        return tables.creditList ?? (tables.credit ? [tables.credit] : []);
      }
      if (table === "product_1_1_generation_attempt_claims") return tables.claims ?? [];
      if (table === "product_1_1_generation_outcomes") {
        return tables.outcome ? [tables.outcome] : [];
      }
      return [];
    };
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = vi.fn(self);
    chain.eq = vi.fn(self);
    chain.in = vi.fn(self);
    chain.order = vi.fn(self);
    chain.limit = vi.fn(self);
    chain.maybeSingle = vi.fn(async () => ({ data: rowsFor()[0] ?? null, error: null }));
    chain.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: rowsFor(), error: null }).then(resolve);
    return chain;
  });

  return { from, storage, rpc: vi.fn() } as unknown as SupabaseClient & {
    rpc: ReturnType<typeof vi.fn>;
  };
}

function record(overrides: Partial<PendingOperationState> = {}): PendingOperationState {
  return {
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    storeId: STORE_ID,
    status: "reserved",
    amount: 1,
    terminal: false,
    unknown: false,
    failed: false,
    processing: false,
    stateEpoch: 0,
    publicationState: "none",
    supportReference: null,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    latestAttemptAt: null,
    ...overrides,
  };
}

function fakeRepository(input: {
  record?: PendingOperationState | null;
  probe?: { kind: "integral" } | { kind: "absent" } | { kind: "invalid" } | { kind: "indeterminate" };
}) {
  return {
    findPendingOperation: vi.fn(async () => input.record ?? null),
    listPendingOperations: vi.fn(async () => []),
    probeArtifact: vi.fn(async () =>
      input.probe && input.probe.kind === "integral"
        ? {
            kind: "integral" as const,
            ref: { storagePath: "p", width: 1024, height: 1024, mimeType: "image/jpeg" },
            width: 1024,
            height: 1024,
            mimeType: "image/jpeg",
            storagePath: "p",
          }
        : input.probe ?? { kind: "indeterminate" as const },
    ),
  };
}

describe("F56.2b1b — repositório de pendências (I2/I3, simulado)", () => {
  it("I2: estado TERMINAL prevalece sobre `outcome='unknown'` histórico", async () => {
    const client = createFakeClient({
      credit: { campaign_id: CAMPAIGN_ID, operation_id: OPERATION_ID, store_id: STORE_ID, amount: 1, status: "delivered", created_at: "x", updated_at: "y" },
      outcome: { outcome: "unknown", support_reference: "IMG-001-abc" },
    }) as unknown as SupabaseClient;
    const repo = new SupabasePendingOperationsRepository(client);
    const found = await repo.findPendingOperation(CAMPAIGN_ID, OPERATION_ID);
    expect(found?.status).toBe("delivered");
    expect(found?.terminal).toBe(true);
    expect(found?.unknown).toBe(false);
    expect(found?.supportReference).toBeNull();
  });

  it("deriva `processing` de um claim `in_progress` residual e a última tentativa", async () => {
    const client = createFakeClient({
      credit: { campaign_id: CAMPAIGN_ID, operation_id: OPERATION_ID, store_id: STORE_ID, amount: 1, status: "reserved", created_at: "x", updated_at: "y" },
      claims: [
        { status: "in_progress", attempt_number: 2, updated_at: "2026-10-12T10:00:00.000Z" },
        { status: "failed", attempt_number: 1, updated_at: "2026-10-12T09:00:00.000Z" },
      ],
    }) as unknown as SupabaseClient;
    const repo = new SupabasePendingOperationsRepository(client);
    const found = await repo.findPendingOperation(CAMPAIGN_ID, OPERATION_ID);
    expect(found?.processing).toBe(true);
    expect(found?.latestAttemptAt).toBe("2026-10-12T10:00:00.000Z");
  });

  it("`findPendingOperation` devolve null quando a operação não existe", async () => {
    const client = createFakeClient({ credit: null }) as unknown as SupabaseClient;
    const repo = new SupabasePendingOperationsRepository(client);
    await expect(repo.findPendingOperation(CAMPAIGN_ID, OPERATION_ID)).resolves.toBeNull();
  });

  it("I3: a derivação de evidência NÃO assina URL (usa o probe tipado)", async () => {
    const client = createFakeClient({
      credit: { campaign_id: CAMPAIGN_ID, operation_id: OPERATION_ID, store_id: STORE_ID, amount: 1, status: "reserved", created_at: "x", updated_at: "y" },
    }) as unknown as SupabaseClient;
    const repo = new SupabasePendingOperationsRepository(client);
    const probe = await repo.probeArtifact(STORE_ID, CAMPAIGN_ID, OPERATION_ID);
    expect(["integral", "absent", "invalid", "indeterminate"]).toContain(probe.kind);
    const storageFrom = (client.storage.from as unknown as ReturnType<typeof vi.fn>);
    const signed = (storageFrom.mock.results[0]?.value as { createSignedUrl: ReturnType<typeof vi.fn> }).createSignedUrl;
    expect(signed).not.toHaveBeenCalled();
  });
});

describe("F56.2b1b — serviço resolvePendingOperation (F5/C4/E1, simulado)", () => {
  function fakeRpcClient(result: unknown) {
    return { rpc: vi.fn(async () => ({ data: result, error: null })) } as unknown as SupabaseClient & {
      rpc: ReturnType<typeof vi.fn>;
    };
  }

  /** Envelope VÁLIDO e COERENTE da RPC (identidade + status terminal — F3). */
  function envelope(overrides: Record<string, unknown> = {}) {
    return {
      success: true,
      idempotent: false,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      action: "deliver_existing_art",
      status: "delivered",
      art_kind: "integral",
      ...overrides,
    };
  }

  it("deliver_existing_art com arte íntegra: invoca SOMENTE a RPC auditada com evidência server-derived", async () => {
    const client = fakeRpcClient(envelope());
    const repository = fakeRepository({ record: record(), probe: { kind: "integral" } });
    const result = await resolvePendingOperation(
      { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "arte existente", resolutionOperationId: RESOLUTION_ID },
      { client, repository },
    );
    expect(client.rpc).toHaveBeenCalledTimes(1);
    const [fn, params] = client.rpc.mock.calls[0];
    expect(fn).toBe("admin_resolve_product_1_1_pending");
    expect(params.p_evidence).toMatchObject({ origin: "server-derived", art_kind: "integral", execution_ended: true });
    expect(params.p_action).toBe("deliver_existing_art");
    expect(params.p_resolution_operation_id).toBe(RESOLUTION_ID);
    expect(result.status).toBe("delivered");
  });

  it("Quick 261017-cdi: deliver_existing_art confirmado projeta a campanha", async () => {
    const client = fakeRpcClient(envelope());
    const repository = fakeRepository({ record: record(), probe: { kind: "integral" } });
    const project = vi.fn(async () => ({ projected: true, reason: "projected" }));
    const result = await resolvePendingOperation(
      { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "arte existente", resolutionOperationId: RESOLUTION_ID },
      { client, repository, projectDeliveredCampaign: project as never },
    );
    expect(result.status).toBe("delivered");
    expect(project).toHaveBeenCalledWith({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
  });

  it("Quick 261017-cdi: falha da projeção não altera o resultado da resolução", async () => {
    const client = fakeRpcClient(envelope());
    const repository = fakeRepository({ record: record(), probe: { kind: "integral" } });
    const project = vi.fn(async () => {
      throw new Error("projection boom");
    });
    const result = await resolvePendingOperation(
      { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "arte existente", resolutionOperationId: RESOLUTION_ID },
      { client, repository, projectDeliveredCampaign: project as never },
    );
    expect(result).toMatchObject({ status: "delivered", action: "deliver_existing_art" });
  });

  it("refund_once com ausência confirmada e execução encerrada: invoca a RPC", async () => {
    const client = fakeRpcClient(
      envelope({ action: "refund_once", status: "refunded", art_kind: "absent" }),
    );
    const repository = fakeRepository({ record: record(), probe: { kind: "absent" } });
    const result = await resolvePendingOperation(
      { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "refund_once", reason: "ausência confirmada", resolutionOperationId: RESOLUTION_ID },
      { client, repository },
    );
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc.mock.calls[0][1].p_evidence).toMatchObject({ art_kind: "absent", execution_ended: true });
    expect(result.status).toBe("refunded");
  });

  it("E1/D13: claim `in_progress` residual BLOQUEIA sem evidência de encerramento (RPC NÃO chamada)", async () => {
    const client = fakeRpcClient({ success: true });
    const repository = fakeRepository({ record: record({ processing: true, unknown: true }), probe: { kind: "absent" } });
    await expect(
      resolvePendingOperation(
        { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "refund_once", reason: "tentativa", resolutionOperationId: RESOLUTION_ID },
        { client, repository },
      ),
    ).rejects.toMatchObject({ code: "operation_in_progress" });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("C1: claim `in_progress` COM `authorizeAbandon:true` ⇒ ALCANÇA a RPC com `authorized_abandon:true`", async () => {
    const client = fakeRpcClient(
      envelope({ action: "refund_once", status: "refunded", art_kind: "absent" }),
    );
    const repository = fakeRepository({ record: record({ processing: true }), probe: { kind: "absent" } });
    const result = await resolvePendingOperation(
      {
        actorId: ACTOR_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        action: "refund_once",
        reason: "abandono autorizado",
        resolutionOperationId: RESOLUTION_ID,
        authorizeAbandon: true,
      },
      { client, repository },
    );
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc.mock.calls[0][1].p_evidence).toMatchObject({
      origin: "server-derived",
      art_kind: "absent",
      authorized_abandon: true,
    });
    expect(result.status).toBe("refunded");
  });

  it("C1: SEM `authorizeAbandon` a evidência NÃO contém a marca (comportamento de hoje)", async () => {
    const client = fakeRpcClient(envelope());
    const repository = fakeRepository({ record: record(), probe: { kind: "integral" } });
    await resolvePendingOperation(
      { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "x", resolutionOperationId: RESOLUTION_ID },
      { client, repository },
    );
    expect(client.rpc.mock.calls[0][1].p_evidence).not.toHaveProperty("authorized_abandon");
  });

  it("F5/C2: evidência `invalid`/`indeterminate` BLOQUEIA (sem refund/deliver)", async () => {
    for (const kind of ["invalid", "indeterminate"] as const) {
      const client = fakeRpcClient({ success: true });
      const repository = fakeRepository({ record: record(), probe: { kind } });
      await expect(
        resolvePendingOperation(
          { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "x", resolutionOperationId: RESOLUTION_ID },
          { client, repository },
        ),
      ).rejects.toMatchObject({ code: "insufficient_evidence" });
      expect(client.rpc).not.toHaveBeenCalled();
    }
  });

  it("F5: deliver sem arte íntegra e refund sem `absent` RECUSAM", async () => {
    const client = fakeRpcClient({ success: true });
    await expect(
      resolvePendingOperation(
        { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "x", resolutionOperationId: RESOLUTION_ID },
        { client, repository: fakeRepository({ record: record(), probe: { kind: "absent" } }) },
      ),
    ).rejects.toMatchObject({ code: "insufficient_evidence" });
    await expect(
      resolvePendingOperation(
        { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "refund_once", reason: "x", resolutionOperationId: RESOLUTION_ID },
        { client, repository: fakeRepository({ record: record(), probe: { kind: "integral" } }) },
      ),
    ).rejects.toMatchObject({ code: "insufficient_evidence" });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("F1: tentativa que INICIOU entre a leitura e a trava ⇒ a RPC REVALIDA sob a trava e RECUSA (`operation_in_progress`), nunca resolve ativo", async () => {
    // O serviço observou o estado SEM claim ativo (stale) e envia
    // `execution_ended:true`; a RPC, sob a trava, encontra o claim `in_progress`
    // e recusa. O serviço NUNCA converte a recusa em sucesso.
    const client = fakeRpcClient({ success: false, reason: "operation_in_progress" });
    const repository = fakeRepository({ record: record({ processing: false }), probe: { kind: "integral" } });
    await expect(
      resolvePendingOperation(
        { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "x", resolutionOperationId: RESOLUTION_ID },
        { client, repository },
      ),
    ).rejects.toMatchObject({ code: "operation_in_progress" });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    // A evidência enviada carrega o valor STALE (`true`), provando que a recusa
    // veio da REVALIDAÇÃO SOB A TRAVA na RPC — a evidência NÃO é a autoridade.
    expect(client.rpc.mock.calls[0][1].p_evidence).toMatchObject({ execution_ended: true });
  });

  it("F2(a): replay EQUIVALENTE após `delivered` é IDEMPOTENTE (a RPC decide; o serviço não recusa terminal)", async () => {
    const client = fakeRpcClient(envelope({ idempotent: true }));
    const result = await resolvePendingOperation(
      { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "replay", resolutionOperationId: RESOLUTION_ID },
      { client, repository: fakeRepository({ record: record({ status: "delivered", terminal: true }), probe: { kind: "integral" } }) },
    );
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(result.idempotent).toBe(true);
    expect(result.status).toBe("delivered");
  });

  it("F2(a): replay EQUIVALENTE após `refunded` é IDEMPOTENTE", async () => {
    const client = fakeRpcClient(
      envelope({ idempotent: true, action: "refund_once", status: "refunded", art_kind: "absent" }),
    );
    const result = await resolvePendingOperation(
      { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "refund_once", reason: "replay", resolutionOperationId: RESOLUTION_ID },
      { client, repository: fakeRepository({ record: record({ status: "refunded", terminal: true }), probe: { kind: "absent" } }) },
    );
    expect(result.idempotent).toBe(true);
    expect(result.status).toBe("refunded");
  });

  it("F2(a): replay DIVERGENTE (mesmo `resolution_operation_id`) ⇒ CONFLITO `operation_identity_conflict`", async () => {
    const client = fakeRpcClient({ success: false, reason: "operation_identity_conflict" });
    await expect(
      resolvePendingOperation(
        { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "motivo divergente", resolutionOperationId: RESOLUTION_ID },
        { client, repository: fakeRepository({ record: record({ status: "delivered", terminal: true }), probe: { kind: "integral" } }) },
      ),
    ).rejects.toMatchObject({ code: "operation_identity_conflict" });
  });

  it("F2(a): terminal de AÇÃO divergente ⇒ `operation_terminal` (delegado à RPC, sem efeito local)", async () => {
    const client = fakeRpcClient({ success: false, reason: "operation_terminal" });
    await expect(
      resolvePendingOperation(
        { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "refund_once", reason: "x", resolutionOperationId: RESOLUTION_ID },
        { client, repository: fakeRepository({ record: record({ status: "delivered", terminal: true }), probe: { kind: "absent" } }) },
      ),
    ).rejects.toMatchObject({ code: "operation_terminal" });
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it("F2(c): replay concorrente EQUIVALENTE ⇒ EXATAMENTE um efeito e uma auditoria (serializados)", async () => {
    // Fake stateful que simula a trava `FOR UPDATE` + o índice único de auditoria.
    const audits = new Map<string, Record<string, unknown>>();
    let effects = 0;
    let lock: Promise<void> = Promise.resolve();
    const rpc = vi.fn(async (_fn: string, params: Record<string, unknown>) => {
      const prev = lock;
      let release!: () => void;
      lock = new Promise<void>((resolve) => (release = resolve));
      await prev; // SERIALIZA como o `FOR UPDATE` (C4)
      try {
        const key = String(params.p_resolution_operation_id);
        const existing = audits.get(key);
        if (existing) {
          if (
            existing.campaign_id === params.p_campaign_id &&
            existing.action === params.p_action &&
            existing.actor_id === params.p_actor_id &&
            existing.reason === params.p_reason
          ) {
            return { data: { ...existing, idempotent: true }, error: null };
          }
          return { data: { success: false, reason: "operation_identity_conflict" }, error: null };
        }
        effects += 1;
        const stored = {
          success: true,
          idempotent: false,
          campaign_id: params.p_campaign_id,
          operation_id: params.p_operation_id,
          action: params.p_action,
          status: params.p_action === "deliver_existing_art" ? "delivered" : "refunded",
          art_kind: (params.p_evidence as { art_kind: string }).art_kind,
          actor_id: params.p_actor_id,
          reason: params.p_reason,
        };
        audits.set(key, stored);
        return { data: stored, error: null };
      } finally {
        release();
      }
    });
    const client = { rpc } as unknown as SupabaseClient;
    const input = {
      actorId: ACTOR_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      action: "deliver_existing_art" as const,
      reason: "replay concorrente",
      resolutionOperationId: RESOLUTION_ID,
    };
    const [a, b] = await Promise.all([
      resolvePendingOperation(input, { client, repository: fakeRepository({ record: record(), probe: { kind: "integral" } }) }),
      resolvePendingOperation(input, { client, repository: fakeRepository({ record: record(), probe: { kind: "integral" } }) }),
    ]);
    expect(effects).toBe(1);
    expect(audits.size).toBe(1);
    expect([a.idempotent, b.idempotent].filter(Boolean)).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // F2 — proteção da identidade GLOBAL de `resolution_operation_id` (d/e/f)
  // Modela a trava ADVISORY global + a colisão INDEPENDENTE de `action` da
  // migration: a MESMA identidade serializa mesmo em campanhas/operações
  // DIFERENTES e nunca cai em `unique_violation`/efeito parcial.
  // -------------------------------------------------------------------------

  function repoByCampaign(
    records: Record<string, PendingOperationState>,
    probe:
      | { kind: "integral" }
      | { kind: "absent" }
      | { kind: "invalid" }
      | { kind: "indeterminate" } = { kind: "integral" },
  ) {
    return {
      findPendingOperation: vi.fn(async (campaignId: string) => records[campaignId] ?? null),
      listPendingOperations: vi.fn(async () => []),
      probeArtifact: vi.fn(async () =>
        probe.kind === "integral"
          ? {
              kind: "integral" as const,
              ref: { storagePath: "p", width: 1024, height: 1024, mimeType: "image/jpeg" },
              width: 1024,
              height: 1024,
              mimeType: "image/jpeg",
              storagePath: "p",
            }
          : probe,
      ),
    };
  }

  /** Fake stateful da RPC: trava advisory GLOBAL por identidade + colisão action-independente. */
  function createGlobalIdentityRpc(
    seed: Array<{ key: string; audit: Record<string, unknown> }> = [],
  ) {
    // `audit` = linha de `admin_audit_log` (action fixa 'product_1_1_pending_resolution');
    // `result` = envelope de `metadata` devolvido pela RPC (action = p_action).
    interface Stored {
      action: string;
      campaign_id: unknown;
      operation_id: unknown;
      actor_id: unknown;
      reason: unknown;
      art_kind: unknown;
      result: Record<string, unknown>;
    }
    const audits = new Map<string, Stored>();
    for (const item of seed) {
      audits.set(item.key, {
        action: String(item.audit.action),
        campaign_id: item.audit.campaign_id,
        operation_id: item.audit.operation_id,
        actor_id: item.audit.actor_id,
        reason: item.audit.reason,
        art_kind: item.audit.art_kind,
        result: item.audit,
      });
    }
    let effects = 0;
    const tail = new Map<string, Promise<void>>();
    const acquire = async (key: string) => {
      const prev = tail.get(key) ?? Promise.resolve();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      tail.set(
        key,
        prev.then(() => gate),
      );
      await prev;
      return release;
    };
    const rpc = vi.fn(async (_fn: string, params: Record<string, unknown>) => {
      const key = String(params.p_resolution_operation_id);
      const release = await acquire(key); // trava advisory GLOBAL (namespaced)
      try {
        const existing = audits.get(key);
        if (existing) {
          if (
            existing.action === "product_1_1_pending_resolution" &&
            existing.campaign_id === params.p_campaign_id &&
            existing.operation_id === params.p_operation_id &&
            existing.actor_id === params.p_actor_id &&
            existing.reason === params.p_reason &&
            existing.art_kind === (params.p_evidence as { art_kind: string }).art_kind
          ) {
            return { data: { ...existing.result, idempotent: true }, error: null };
          }
          return { data: { success: false, reason: "operation_identity_conflict" }, error: null };
        }
        effects += 1;
        const result = {
          success: true,
          idempotent: false,
          campaign_id: params.p_campaign_id,
          operation_id: params.p_operation_id,
          action: params.p_action,
          status: params.p_action === "deliver_existing_art" ? "delivered" : "refunded",
          art_kind: (params.p_evidence as { art_kind: string }).art_kind,
          reason: params.p_reason,
        };
        audits.set(key, {
          action: "product_1_1_pending_resolution",
          campaign_id: params.p_campaign_id,
          operation_id: params.p_operation_id,
          actor_id: params.p_actor_id,
          reason: params.p_reason,
          art_kind: (params.p_evidence as { art_kind: string }).art_kind,
          result,
        });
        return { data: result, error: null };
      } finally {
        release();
      }
    });
    return { rpc, effects: () => effects, audits };
  }

  it("F2(d) — MESMO `resolution_operation_id` em OPERAÇÕES DIFERENTES (simultâneo) ⇒ `operation_identity_conflict` (nunca unique_violation/500), SEM efeito parcial duplicado", async () => {
    const CAMPAIGN_B = "66666666-6666-4666-8666-666666666666";
    const OPERATION_B = "77777777-7777-4777-8777-777777777777";
    const { rpc, effects, audits } = createGlobalIdentityRpc();
    const client = { rpc } as unknown as SupabaseClient;
    const repository = repoByCampaign({
      [CAMPAIGN_ID]: record(),
      [CAMPAIGN_B]: record({ campaignId: CAMPAIGN_B, operationId: OPERATION_B }),
    });
    const results = await Promise.allSettled([
      resolvePendingOperation(
        {
          actorId: ACTOR_ID,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          action: "deliver_existing_art",
          reason: "res A",
          resolutionOperationId: RESOLUTION_ID,
        },
        { client, repository },
      ),
      resolvePendingOperation(
        {
          actorId: ACTOR_ID,
          campaignId: CAMPAIGN_B,
          operationId: OPERATION_B,
          action: "deliver_existing_art",
          reason: "res B",
          resolutionOperationId: RESOLUTION_ID,
        },
        { client, repository },
      ),
    ]);
    // UMA única resolução efetiva e UMA auditoria; a segunda resolve CONFLITO
    // tipado (nunca um erro de banco/efeito parcial).
    expect(effects()).toBe(1);
    expect(audits.size).toBe(1);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "operation_identity_conflict",
    });
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("F2(e) — `resolution_operation_id` JÁ USADO POR OUTRA ação administrativa ⇒ `operation_identity_conflict` (checagem action-independente), SEM efeito", async () => {
    const { rpc, effects } = createGlobalIdentityRpc([
      {
        key: RESOLUTION_ID,
        audit: {
          action: "credit_grant",
          campaign_id: CAMPAIGN_ID,
          operation_id: OPERATION_ID,
          actor_id: ACTOR_ID,
          reason: "outra ação administrativa",
          art_kind: "integral",
        },
      },
    ]);
    const client = { rpc } as unknown as SupabaseClient;
    await expect(
      resolvePendingOperation(
        {
          actorId: ACTOR_ID,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          action: "deliver_existing_art",
          reason: "res",
          resolutionOperationId: RESOLUTION_ID,
        },
        { client, repository: fakeRepository({ record: record(), probe: { kind: "integral" } }) },
      ),
    ).rejects.toMatchObject({ code: "operation_identity_conflict" });
    expect(effects()).toBe(0);
  });

  it("F2(f) — replay EQUIVALENTE (mesma identidade/conteúdo) reusa IDEMPOTENTE: UMA única auditoria/efeito (checagem action-independente)", async () => {
    const { rpc, effects, audits } = createGlobalIdentityRpc();
    const client = { rpc } as unknown as SupabaseClient;
    const input = {
      actorId: ACTOR_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      action: "deliver_existing_art" as const,
      reason: "replay equivalente",
      resolutionOperationId: RESOLUTION_ID,
    };
    const first = await resolvePendingOperation(input, {
      client,
      repository: fakeRepository({ record: record(), probe: { kind: "integral" } }),
    });
    const second = await resolvePendingOperation(input, {
      client,
      repository: fakeRepository({
        record: record({ status: "delivered", terminal: true }),
        probe: { kind: "integral" },
      }),
    });
    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(effects()).toBe(1);
    expect(audits.size).toBe(1);
  });

  it("F3: envelope AUSENTE/INCOMPLETO/CONTRADITÓRIO ⇒ FAIL CLOSED (`invalid_response`), nunca sucesso", async () => {
    const badEnvelopes: unknown[] = [
      null,
      {},
      { campaign_id: CAMPAIGN_ID }, // sem `success`
      { success: undefined, status: "delivered" },
      envelope({ success: false, reason: undefined }), // `success:false` sem motivo ⇒ unknown
      envelope({ campaign_id: "99999999-9999-4999-8999-999999999999" }), // identidade divergente
      envelope({ operation_id: "99999999-9999-4999-8999-999999999999" }),
      envelope({ action: "refund_once" }), // ação divergente do pedido
      envelope({ status: "refunded" }), // status incoerente com a ação (pedido = deliver)
    ];
    for (const bad of badEnvelopes) {
      const client = fakeRpcClient(bad);
      await expect(
        resolvePendingOperation(
          { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "x", resolutionOperationId: RESOLUTION_ID },
          { client, repository: fakeRepository({ record: record(), probe: { kind: "integral" } }) },
        ),
      ).rejects.toBeInstanceOf(Error);
    }
    // Um envelope bem-formado é aceito (controle).
    const ok = await resolvePendingOperation(
      { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "x", resolutionOperationId: RESOLUTION_ID },
      { client: fakeRpcClient(envelope()), repository: fakeRepository({ record: record(), probe: { kind: "integral" } }) },
    );
    expect(ok.status).toBe("delivered");
  });

  it("F5: conflito divergente da RPC é propagado como `operation_identity_conflict`", async () => {
    const client = { rpc: vi.fn(async () => ({ data: null, error: { message: "operation_identity_conflict" } })) } as unknown as SupabaseClient;
    await expect(
      resolvePendingOperation(
        { actorId: ACTOR_ID, campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, action: "deliver_existing_art", reason: "x", resolutionOperationId: RESOLUTION_ID },
        { client, repository: fakeRepository({ record: record(), probe: { kind: "integral" } }) },
      ),
    ).rejects.toMatchObject({ code: "operation_identity_conflict" });
  });
});

describe("F56.2b1b — schema e rota admin de resolução (estático)", () => {
  it("schema `.strict()` aceita o corpo válido e REJEITA evidência declarada pelo cliente", () => {
    const valid = {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      action: "deliver_existing_art",
      resolutionOperationId: RESOLUTION_ID,
      reason: "motivo",
    };
    expect(ProductOneToOnePendingResolutionSchema.safeParse(valid).success).toBe(true);
    expect(
      ProductOneToOnePendingResolutionSchema.safeParse({ ...valid, art_kind: "integral" }).success,
    ).toBe(false);
    expect(
      ProductOneToOnePendingResolutionSchema.safeParse({ ...valid, execution_ended: true }).success,
    ).toBe(false);
    expect(
      ProductOneToOnePendingResolutionSchema.safeParse({ ...valid, reason: "   " }).success,
    ).toBe(false);
    expect(
      ProductOneToOnePendingResolutionSchema.safeParse({ ...valid, action: "generate_new" }).success,
    ).toBe(false);
  });

  it("rota admin: GET lista (requireAdmin) e POST resolution (requireAdmin + requireSameOrigin + schema + serviço)", () => {
    const routeSource = readFileSync(
      path.resolve(process.cwd(), "src/app/api/admin/product-1-1-pending/route.ts"),
      "utf8",
    );
    expect(routeSource).toMatch(/requireAdmin/);
    expect(routeSource).toMatch(/requireSameOrigin/);
    expect(routeSource).toMatch(/apiHandler/);
    expect(routeSource).toMatch(/ProductOneToOnePendingResolutionSchema/);
    expect(routeSource).toMatch(/resolvePendingOperation/);
    expect(routeSource).toMatch(/export const GET/);
    expect(routeSource).toMatch(/export const POST/);
  });

  it("I3 (estático): repositório/serviço NÃO chamam `createSignedUrl`/`getSignedArtifactUrl`", () => {
    for (const file of [
      "src/lib/product-1-1/pending/pending-operations-repository.ts",
      "src/lib/product-1-1/pending/resolve-pending-operation.ts",
    ]) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/createSignedUrl|getSignedArtifactUrl/);
    }
  });

  it("mapeia códigos→status HTTP (400/404/409/500)", () => {
    expect(resolutionErrorStatus({ code: "insufficient_evidence" })).toBe(400);
    expect(resolutionErrorStatus({ code: "operation_not_found" })).toBe(404);
    expect(resolutionErrorStatus({ code: "operation_in_progress" })).toBe(409);
    expect(resolutionErrorStatus({ code: "execution_not_ended" })).toBe(409);
    expect(resolutionErrorStatus({ code: "operation_identity_conflict" })).toBe(409);
    expect(resolutionErrorStatus({ code: "invalid_response" })).toBe(500);
    expect(resolutionErrorStatus({ code: "unknown" })).toBe(500);
  });
});
