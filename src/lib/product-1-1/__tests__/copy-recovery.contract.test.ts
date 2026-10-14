// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import { NetworkError } from "@/lib/copy/errors";

import {
  COPY_LEASE_TTL_MS,
  COPY_RECOVERY_WAITS_MS,
  createCopyBudgetSignal,
  drainCopyTask,
  readCopyAttempts,
  readCopyDelivery,
  readCopyRecoverySummary,
  readCopyState,
  recordCancellation,
  recordCopyState,
  type CopyState,
  type CopyStateStore,
  type CopyCommit,
} from "../copy/copy-state";

// ---------------------------------------------------------------------------
// F56.2b2a — B2.1 / Plano 01: identidade POR TENTATIVA + posse/lease +
// `stale_attempt` + terminal NÃO sobrescrito + drenador IDENTIFICADO que
// CLASSIFICA a falha server-side.
//
// Contract test ESTÁTICO (SQL da migration) + SIMULADO (store/DB fiel, sem
// banco/sem provider). As RPCs REAIS são provadas na instância isolada do
// Plano 05; aqui provamos (a) que o SQL contém a mecânica aprovada, (b) que a
// FONTE ÚNICA das esperas vive em `copy-state.ts` (sem referência ao Plano 02 /
// sem ciclo de import) e (c) o comportamento da camada de estado/dreno sobre
// envelopes condicionais POR TENTATIVA.
//
// Este arquivo é ESTENDIDO nos Planos 02/03/06 (política/teto/anti-duplicação/
// rota/aquisição) — manter a estrutura importável e os helpers reutilizáveis.
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261013000001_f56_2b2a_copy_attempt_identity.sql";
const migrationSql = readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), "utf8");
// SQL ATIVO (sem linhas de comentário) — o cabeçalho/REVERT são comentados.
const ACTIVE_SQL = migrationSql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

const COPY_STATE_FILE = path.resolve(
  process.cwd(),
  "src",
  "lib",
  "product-1-1",
  "copy",
  "copy-state.ts",
);
const copyStateSource = readFileSync(COPY_STATE_FILE, "utf8");

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const TOKEN_A = "3b0f6c1a-7d2e-4a1b-9c3f-5e8d2b1a0c4f";
const TOKEN_B = "9a8b7c6d-5e4f-4a1b-8c2d-1e0f9a8b7c6d";

// Relógio determinístico para o sumário (lease/espera).
const NOW = 1_780_000_000_000;
const iso = (ms: number): string => new Date(ms).toISOString();

// ---------------------------------------------------------------------------
// (a) Asserções ESTÁTICAS do SQL (identidade/lease/`stale_attempt`/terminal/
//     A2 grants) — SEM depender de linhas de comentário.
// ---------------------------------------------------------------------------

describe("B2.1 — migration por tentativa (SQL estático, SEM comentários)", () => {
  it("adiciona identidade/histórico + posse/lease + condição de dedupe", () => {
    expect(ACTIVE_SQL).toContain("attempt_seq");
    expect(ACTIVE_SQL).toContain("attempt_token");
    expect(ACTIVE_SQL).toContain("lease_at");
    expect(ACTIVE_SQL).toContain("request_token");
    // Teto 1..6 da B2A-D2/D4.
    expect(ACTIVE_SQL).toContain("BETWEEN 1 AND 6");
  });

  it("troca a UNIQUE por-OPERAÇÃO por por-TENTATIVA e adiciona dedupe por acionamento", () => {
    expect(ACTIVE_SQL).toContain("uq_p1_1_copy_state_op_attempt");
    expect(ACTIVE_SQL).toContain("UNIQUE (campaign_id, operation_id, attempt_seq)");
    expect(ACTIVE_SQL).toContain("uq_p1_1_copy_state_op_request");
    expect(ACTIVE_SQL).toContain("UNIQUE (campaign_id, operation_id, request_token)");
  });

  it("apply exige identidade e devolve `stale_attempt` p/ tentativa superada", () => {
    expect(ACTIVE_SQL).toContain("missing_attempt_identity");
    expect(ACTIVE_SQL).toContain("invalid_attempt_seq");
    expect(ACTIVE_SQL).toContain("'stale_attempt'");
    // `completed` em qualquer tentativa é terminal para a entrega (recusa).
    expect(ACTIVE_SQL).toContain("v_completed");
  });

  it("aplica a trava FOR UPDATE por operação + corrida via ON CONFLICT/re-leitura", () => {
    expect(ACTIVE_SQL).toContain("FOR UPDATE");
    expect(ACTIVE_SQL).toContain("ON CONFLICT (campaign_id, operation_id, attempt_seq) DO NOTHING");
    expect(ACTIVE_SQL).toContain("copy_state_race_unresolved");
    // POSSE carimbada só ao nascer `pending`.
    expect(ACTIVE_SQL).toContain("CASE WHEN p_state = 'pending' THEN now() ELSE NULL END");
  });

  // Correção da revisão (2026-10-14) — transições e aquisição compartilham a
  // MESMA trava estável por operação, na MESMA ordem fixa (advisory → C4 →
  // copy_state). Asserções POSICIONAIS no SQL ATIVO (sem comentários).
  it("trava estável COMPARTILHADA: advisory → C4 → copy_state na ordem fixa", () => {
    const advisoryIdx = ACTIVE_SQL.indexOf(
      "pg_advisory_xact_lock(hashtextextended(p_campaign_id::text || ':' || p_operation_id::text, 0))",
    );
    const creditIdx = ACTIVE_SQL.indexOf(
      "PERFORM 1 FROM public.product_1_1_campaign_credit_operations",
    );
    const copyLockIdx = ACTIVE_SQL.search(
      /PERFORM 1 FROM public\.product_1_1_copy_state[\s\S]{0,160}?FOR UPDATE/,
    );
    // Presentes no RPC de transição (apply).
    expect(advisoryIdx).toBeGreaterThanOrEqual(0);
    expect(creditIdx).toBeGreaterThanOrEqual(0);
    expect(copyLockIdx).toBeGreaterThanOrEqual(0);
    // ORDEM FIXA: (1) advisory, (2) linha C4 de crédito, (3) copy_state FOR UPDATE.
    expect(advisoryIdx).toBeLessThan(creditIdx);
    expect(creditIdx).toBeLessThan(copyLockIdx);
  });

  it("terminal PROTEGIDO por tentativa derivado + replay NULL-safe preservado", () => {
    expect(ACTIVE_SQL).toContain("v_terminal := v_row.state IN ('completed','failed');");
    expect(ACTIVE_SQL).toContain("IS NOT DISTINCT FROM");
    expect(ACTIVE_SQL).toContain("'idempotent'");
    expect(ACTIVE_SQL).toContain("'conflict'");
    expect(ACTIVE_SQL).toContain("'rejected'");
    expect(ACTIVE_SQL).toContain("'invalid_content'");
  });

  it("RPC-only A2: service_role SELECT only + EXECUTE só nas novas assinaturas", () => {
    expect(ACTIVE_SQL).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_state FROM service_role;",
    );
    expect(ACTIVE_SQL).toContain(
      "GRANT SELECT ON TABLE public.product_1_1_copy_state TO service_role;",
    );
    expect(ACTIVE_SQL).toContain(
      "GRANT EXECUTE ON FUNCTION public.product_1_1_apply_copy_state(UUID, UUID, TEXT, INTEGER, UUID, TEXT, JSONB)",
    );
    expect(ACTIVE_SQL).toContain(
      "GRANT EXECUTE ON FUNCTION public.product_1_1_cancel_copy(UUID, UUID, TEXT, INTEGER, UUID, JSONB)",
    );
    expect(ACTIVE_SQL).toContain("SECURITY DEFINER");
    expect(ACTIVE_SQL).toContain("SET search_path = ''");
  });

  it("cancel REGISTRA somente em applied/idempotent — recusa não declara sucesso (revisão 2026-10-14)", () => {
    // Gate do registro pelo DESFECHO do apply (não pelo estado observado).
    expect(ACTIVE_SQL).toContain("IF v_outcome IN ('applied','idempotent') THEN");
    // Early-return explícito do `stale_attempt` (recusa sem registro) preservado.
    expect(ACTIVE_SQL).toContain("IF v_outcome = 'stale_attempt' THEN");
    // Recusa (conflict/rejected/invalid_content): canceled:false + desfecho, SEM insert.
    expect(ACTIVE_SQL).toContain("'canceled', false, 'outcome', v_outcome");
    // Sucesso: canceled:true também carrega o desfecho observado.
    expect(ACTIVE_SQL).toContain("'canceled', true, 'outcome', v_outcome");
  });
});

// ---------------------------------------------------------------------------
// (a.1) FONTE ÚNICA das ESPERAS em `copy-state.ts` (self-contained wave 1)
// ---------------------------------------------------------------------------

describe("B2.1 — FONTE ÚNICA das esperas (copy-state.ts, sem ciclo/sem wave 3)", () => {
  it("COPY_RECOVERY_WAITS_MS com after1: 5_000 / after2: 10_000 definidos LOCALMENTE", () => {
    expect(copyStateSource).toMatch(/COPY_RECOVERY_WAITS_MS\s*=\s*Object\.freeze\(/);
    expect(copyStateSource).toMatch(/after1:\s*5_000/);
    expect(copyStateSource).toMatch(/after2:\s*10_000/);
    expect(copyStateSource).toMatch(/COPY_LEASE_TTL_MS\s*=\s*45_000/);
  });

  it("`copy-state.ts` NÃO IMPORTA `copy/copy-recovery-policy` (sem ciclo / sem referência futura)", () => {
    // A restrição é sobre IMPORT (não sobre o texto de comentários, que explicam
    // a política do Plano 02): nenhum import de `copy-recovery-policy`.
    expect(copyStateSource).not.toMatch(/import\s[^;]*?copy-recovery-policy/);
    expect(copyStateSource).not.toMatch(/from\s+["'][^"']*copy-recovery-policy["']/);
  });

  it("declara LOCAL-ONLY/autorada (aplicação somente na instância isolada)", () => {
    expect(migrationSql).toContain("LOCAL-ONLY");
    expect(migrationSql).toContain("migration up --local");
    expect(migrationSql).toContain("Autorar aqui ≠ aplicar");
  });
});

// ---------------------------------------------------------------------------
// (b) Simulador FIEL por TENTATIVA do CAS do banco (espelha a migration) +
//     client gravador (rpc → DB; from/select/eq/order/limit → linhas).
// ---------------------------------------------------------------------------

interface AttemptRow {
  campaign_id: string;
  operation_id: string;
  attempt_seq: number;
  attempt_token: string | null;
  state: CopyState;
  copy_text: string | null;
  copy_payload: Record<string, unknown> | null;
  lease_at: string | null;
  request_token: string | null;
  updated_at: string;
  created_at: string;
}

type Envelope = { applied: boolean; outcome: string; state: CopyState | null };
type CancelEnvelope = {
  applied: boolean;
  state: CopyState | null;
  canceled: boolean;
  outcome?: string;
};

/** Espelha `product_1_1_apply_copy_state`/`product_1_1_cancel_copy` POR TENTATIVA. */
class CopyAttemptDb {
  private readonly map = new Map<string, AttemptRow>();
  cancellations = 0;

  private key(c: string, o: string, s: number): string {
    return `${c}:${o}:${s}`;
  }

  /** Injeta linhas diretamente (para o sumário read-only). */
  seed(...rows: AttemptRow[]): void {
    for (const row of rows) this.map.set(this.key(row.campaign_id, row.operation_id, row.attempt_seq), row);
  }

  rowsArray(): AttemptRow[] {
    return [...this.map.values()];
  }

  applyRpc(params: Record<string, unknown>): Envelope {
    const campaignId = String(params.p_campaign_id);
    const operationId = String(params.p_operation_id);
    const state = params.p_state as CopyState;
    const attemptSeq = params.p_attempt_seq as number;
    const attemptToken = params.p_attempt_token as string;
    const copyText = (params.p_copy_text as string | null) ?? null;
    const copyPayload = (params.p_copy_payload as Record<string, unknown> | null) ?? null;

    // C2 — `completed` sem conteúdo entregável ⇒ invalid_content (nunca persistido).
    if (state === "completed" && (copyText === null || copyText.trim() === "")) {
      return { applied: false, outcome: "invalid_content", state: null };
    }

    const keys = [...this.map.keys()]
      .filter((k) => k.startsWith(`${campaignId}:${operationId}:`))
      .map((k) => Number(k.split(":")[2]))
      .sort((a, b) => a - b);
    const maxSeq = keys.length > 0 ? (keys[keys.length - 1] as number) : 0;
    const maxRow = maxSeq > 0 ? this.map.get(this.key(campaignId, operationId, maxSeq)) ?? null : null;

    // 1) STALE — seq MENOR que a corrente (conclusão atrasada): NÃO toca o persistido.
    if (attemptSeq < maxSeq) {
      return { applied: false, outcome: "stale_attempt", state: maxRow ? maxRow.state : null };
    }

    // 2) `completed` em QUALQUER tentativa é TERMINAL para a entrega: nunca sobrescrito.
    const completedExists = this.rowsArray().some(
      (r) => r.campaign_id === campaignId && r.operation_id === operationId && r.state === "completed",
    );
    if (completedExists && !(maxRow && maxRow.state === "completed" && attemptSeq === maxSeq)) {
      return { applied: false, outcome: "rejected", state: "completed" };
    }

    // 3) ALVO = linha da TENTATIVA `attemptSeq`.
    let row = this.map.get(this.key(campaignId, operationId, attemptSeq)) ?? null;
    if (row === null) {
      // PRIMEIRA escrita da tentativa; POSSE só ao NASCER `pending`.
      const stamp = iso(NOW);
      this.map.set(this.key(campaignId, operationId, attemptSeq), {
        campaign_id: campaignId,
        operation_id: operationId,
        attempt_seq: attemptSeq,
        attempt_token: attemptToken,
        state,
        copy_text: copyText,
        copy_payload: copyPayload,
        lease_at: state === "pending" ? stamp : null,
        request_token: null,
        updated_at: stamp,
        created_at: stamp,
      });
      return { applied: true, outcome: "applied", state };
    }

    // 4) IDENTIDADE — mesma seq, token DIVERGENTE ⇒ CONFLITO (nunca sobrescrita).
    if (row.attempt_token !== attemptToken) {
      return { applied: false, outcome: "conflict", state: row.state };
    }

    const terminal = row.state === "completed" || row.state === "failed";
    // 5) TERMINAL PROTEGIDO por tentativa + replay NULL-safe.
    if (terminal) {
      if (row.state === state) {
        const equivalent =
          (row.copy_text ?? null) === copyText &&
          JSON.stringify(row.copy_payload ?? null) === JSON.stringify(copyPayload);
        return equivalent
          ? { applied: false, outcome: "idempotent", state: row.state }
          : { applied: false, outcome: "conflict", state: row.state };
      }
      return { applied: false, outcome: "rejected", state: row.state };
    }
    if (row.state === state) {
      return { applied: false, outcome: "idempotent", state: row.state };
    }
    // 6) transição `pending` → terminal.
    this.map.set(this.key(campaignId, operationId, attemptSeq), {
      ...row,
      state,
      copy_text: copyText,
      copy_payload: copyPayload,
      updated_at: iso(NOW + 1),
    });
    return { applied: true, outcome: "applied", state };
  }

  cancelRpc(params: Record<string, unknown>): CancelEnvelope {
    const apply = this.applyRpc({ ...params, p_state: "failed", p_copy_text: null });
    if (apply.outcome === "stale_attempt") {
      return { applied: false, state: apply.state, canceled: false, outcome: "stale_attempt" };
    }
    // CORREÇÃO DA REVISÃO (2026-10-14) — espelha o gate da SQL: o registro e a
    // resposta `canceled:true` SÓ acontecem quando o `apply` interno aplicou
    // (`applied`) ou replayou o terminal equivalente (`idempotent`). Qualquer
    // outro desfecho (`conflict`/`rejected`/`invalid_content`) é RECUSA: nenhum
    // cancellation é registrado e `canceled:false` é devolvido.
    if (apply.outcome === "applied" || apply.outcome === "idempotent") {
      this.cancellations += 1;
      return { applied: apply.applied, state: "failed", canceled: true, outcome: apply.outcome };
    }
    return { applied: false, state: apply.state, canceled: false, outcome: apply.outcome };
  }
}

interface RecordedEvent {
  name: string;
  params: Record<string, unknown>;
}

function makeRecordingClient(db: CopyAttemptDb): { client: SupabaseClient; events: RecordedEvent[] } {
  const events: RecordedEvent[] = [];
  const makeQueryChain = () => {
    const filters: Record<string, unknown> = {};
    let desc = false;
    let lim: number | undefined;
    const chain: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        filters[col] = val;
        return chain;
      },
      order(_col: string, opts?: { ascending?: boolean }) {
        desc = opts ? opts.ascending === false : false;
        return chain;
      },
      limit(n: number) {
        lim = n;
        return chain;
      },
      maybeSingle() {
        return Promise.resolve({ data: pick()[0] ?? null, error: null });
      },
      then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve({ data: pick(), error: null }).then(onFulfilled, onRejected);
      },
    };
    function pick(): AttemptRow[] {
      const rows = db
        .rowsArray()
        .filter(
          (r) => r.campaign_id === filters.campaign_id && r.operation_id === filters.operation_id,
        );
      rows.sort((a, b) => (desc ? b.attempt_seq - a.attempt_seq : a.attempt_seq - b.attempt_seq));
      return typeof lim === "number" ? rows.slice(0, lim) : rows;
    }
    return chain;
  };

  const client = {
    from() {
      return {
        select() {
          return makeQueryChain();
        },
      };
    },
    rpc(name: string, params: Record<string, unknown>) {
      events.push({ name, params });
      if (name === "product_1_1_apply_copy_state") {
        return Promise.resolve({ data: db.applyRpc(params), error: null });
      }
      if (name === "product_1_1_cancel_copy") {
        return Promise.resolve({ data: db.cancelRpc(params), error: null });
      }
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
    },
  } as unknown as SupabaseClient;
  return { client, events };
}

function storeFor(client: SupabaseClient): CopyStateStore {
  return {
    recordCopyState: (input) => recordCopyState(client, input),
    recordCancellation: (input) => recordCancellation(client, input),
  };
}

describe("B2.1 — identidade enviada na RPC (recording client)", () => {
  it("recordCopyState envia p_attempt_seq/p_attempt_token", async () => {
    const db = new CopyAttemptDb();
    const { client, events } = makeRecordingClient(db);
    await recordCopyState(client, {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      attemptSeq: 2,
      attemptToken: TOKEN_A,
      state: "pending",
    });
    expect(events[0].name).toBe("product_1_1_apply_copy_state");
    expect(events[0].params).toMatchObject({ p_attempt_seq: 2, p_attempt_token: TOKEN_A });
  });

  it("recordCancellation envia p_attempt_seq/p_attempt_token/p_copy_payload", async () => {
    const db = new CopyAttemptDb();
    const { client, events } = makeRecordingClient(db);
    await recordCancellation(client, {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      reason: "r",
      attemptSeq: 1,
      attemptToken: TOKEN_A,
      copyPayload: { recovery: { kind: "auto", failureClass: "transient", nextWaitMs: 5000 } },
    });
    expect(events[0].name).toBe("product_1_1_cancel_copy");
    expect(events[0].params).toMatchObject({ p_attempt_seq: 1, p_attempt_token: TOKEN_A });
    expect(events[0].params.p_copy_payload).toMatchObject({
      recovery: { kind: "auto", failureClass: "transient" },
    });
  });

  it("apply/cancel NÃO enviam request_token (só a aquisição o grava)", async () => {
    const db = new CopyAttemptDb();
    const { client, events } = makeRecordingClient(db);
    await recordCopyState(client, {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      attemptSeq: 1,
      attemptToken: TOKEN_A,
      state: "pending",
    });
    await recordCancellation(client, {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      reason: "r",
      attemptSeq: 1,
      attemptToken: TOKEN_A,
    });
    for (const ev of events) {
      expect(ev.params).not.toHaveProperty("p_request_token");
      expect(ev.params).not.toHaveProperty("request_token");
    }
  });
});

describe("B2.1 — parseCopyStateEnvelope aceita stale_attempt / falha fechado em contradição", () => {
  function clientRpc(data: unknown): SupabaseClient {
    return { rpc: () => Promise.resolve({ data, error: null }) } as unknown as SupabaseClient;
  }

  it("aceita stale_attempt (applied:false) SEM lançar", async () => {
    await expect(
      recordCopyState(clientRpc({ applied: false, outcome: "stale_attempt", state: "completed" }), {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: TOKEN_A,
        state: "completed",
        copyText: "t",
      }),
    ).resolves.toEqual({ applied: false, outcome: "stale_attempt", state: "completed" });
  });

  it("contradição applied:true × stale_attempt ⇒ LANÇA (fail-closed preservado)", async () => {
    await expect(
      recordCopyState(clientRpc({ applied: true, outcome: "stale_attempt", state: "completed" }), {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: TOKEN_A,
        state: "completed",
        copyText: "t",
      }),
    ).rejects.toThrow(/product_1_1_apply_copy_state/);
  });

  it("cancel tolera outcome stale_attempt; canceled:true sem failed ainda lança", async () => {
    await expect(
      recordCancellation(clientRpc({ applied: false, state: "completed", canceled: false, outcome: "stale_attempt" }), {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        reason: "r",
        attemptSeq: 1,
        attemptToken: TOKEN_A,
      }),
    ).resolves.toEqual({ applied: false, state: "completed", canceled: false, outcome: "stale_attempt" });

    await expect(
      recordCancellation(clientRpc({ applied: true, state: "pending", canceled: true, outcome: "stale_attempt" }), {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        reason: "r",
        attemptSeq: 1,
        attemptToken: TOKEN_A,
      }),
    ).rejects.toThrow(/product_1_1_cancel_copy/);
  });

  // Correção da revisão (2026-10-14) — coerência `canceled:true` × desfecho.
  it("cancel: `canceled:true` + desfecho de RECUSA (conflict) ⇒ contradição ⇒ LANÇA", async () => {
    await expect(
      recordCancellation(clientRpc({ applied: false, state: "failed", canceled: true, outcome: "conflict" }), {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        reason: "r",
        attemptSeq: 1,
        attemptToken: TOKEN_A,
      }),
    ).rejects.toThrow(/product_1_1_cancel_copy_incoherent_envelope/);
  });

  it("cancel: `outcome` desconhecido falha FECHADO; `canceled:true`+`idempotent` é aceito", async () => {
    await expect(
      recordCancellation(clientRpc({ applied: false, state: "failed", canceled: false, outcome: "bogus" }), {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        reason: "r",
        attemptSeq: 1,
        attemptToken: TOKEN_A,
      }),
    ).rejects.toThrow(/product_1_1_cancel_copy_incoherent_envelope/);

    await expect(
      recordCancellation(clientRpc({ applied: false, state: "failed", canceled: true, outcome: "idempotent" }), {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        reason: "r",
        attemptSeq: 1,
        attemptToken: TOKEN_A,
      }),
    ).resolves.toEqual({ applied: false, state: "failed", canceled: true, outcome: "idempotent" });
  });

  it("cancel: `canceled:true` SEM `outcome` + `failed` permanece VÁLIDO (compatibilidade b1b)", async () => {
    await expect(
      recordCancellation(clientRpc({ applied: true, state: "failed", canceled: true }), {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        reason: "r",
        attemptSeq: 1,
        attemptToken: TOKEN_A,
      }),
    ).resolves.toEqual({ applied: true, state: "failed", canceled: true });
  });
});

describe("B2.1 — comportamento do store simulado (tentativa)", () => {
  it("tentativa SUPERADA ⇒ stale_attempt; o persistido da corrente NÃO muda", async () => {
    const db = new CopyAttemptDb();
    const store = storeFor(makeRecordingClient(db).client);
    // Corrente: seq 2 `completed`.
    await store.recordCopyState({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      attemptSeq: 2,
      attemptToken: TOKEN_B,
      state: "completed",
      copyText: "final",
      copyPayload: { caption: "final" },
    });
    // Conclusão ATRASADA da seq 1.
    const stale = await store.recordCopyState({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      attemptSeq: 1,
      attemptToken: TOKEN_A,
      state: "completed",
      copyText: "atrasada",
    });
    expect(stale).toEqual({ applied: false, outcome: "stale_attempt", state: "completed" });
    // A seq 1 NÃO foi criada; a corrente permanece `final`.
    await expect(readCopyDelivery(makeRecordingClient(db).client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID })).resolves.toMatchObject({
      state: "completed",
      copyText: "final",
    });
    expect((await readCopyAttempts(makeRecordingClient(db).client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID })).length).toBe(1);
  });

  it("terminal PROTEGIDO por tentativa: equivalente⇒idempotent / divergente⇒conflict / não-terminal⇒rejected", async () => {
    const db = new CopyAttemptDb();
    const { client } = makeRecordingClient(db);
    const store = storeFor(client);
    await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_A, state: "pending" });
    await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_A, state: "completed", copyText: "t", copyPayload: null });
    // Replay EQUIVALENTE ⇒ idempotent.
    expect(
      await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_A, state: "completed", copyText: "t", copyPayload: null }),
    ).toMatchObject({ outcome: "idempotent", state: "completed" });
    // Conteúdo DIVERGENTE ⇒ conflict (persistido inalterado).
    expect(
      await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_A, state: "completed", copyText: "OUTRO" }),
    ).toMatchObject({ outcome: "conflict", state: "completed" });
    // Escrita não-terminal tardia ⇒ rejected.
    expect(
      await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_A, state: "pending" }),
    ).toMatchObject({ outcome: "rejected", state: "completed" });
    // `completed` NUNCA é substituído.
    await expect(readCopyDelivery(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID })).resolves.toMatchObject({ copyText: "t" });
  });

  it("mesma tentativa com token DIVERGENTE ⇒ conflict (nunca sobrescrita de outro dono)", async () => {
    const db = new CopyAttemptDb();
    const store = storeFor(makeRecordingClient(db).client);
    await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_A, state: "pending" });
    expect(
      await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_B, state: "failed" }),
    ).toMatchObject({ outcome: "conflict", state: "pending" });
  });

  it("`completed` em QUALQUER tentativa é terminal para a entrega: seq MAIOR é recusada", async () => {
    const db = new CopyAttemptDb();
    const store = storeFor(makeRecordingClient(db).client);
    await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_A, state: "completed", copyText: "keep" });
    expect(
      await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 2, attemptToken: TOKEN_B, state: "completed", copyText: "new" }),
    ).toMatchObject({ outcome: "rejected", state: "completed" });
    const { client } = makeRecordingClient(db);
    await expect(readCopyDelivery(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID })).resolves.toMatchObject({ copyText: "keep" });
  });

  it("cancel sobre tentativa superada ⇒ canceled:false + outcome stale_attempt", async () => {
    const db = new CopyAttemptDb();
    const store = storeFor(makeRecordingClient(db).client);
    await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 2, attemptToken: TOKEN_B, state: "pending" });
    expect(
      await store.recordCancellation({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, reason: "r", attemptSeq: 1, attemptToken: TOKEN_A }),
    ).toEqual({ applied: false, state: "pending", canceled: false, outcome: "stale_attempt" });
  });

  it("cancel sobre `completed` persistido ⇒ canceled:false (b1b preservado)", async () => {
    const db = new CopyAttemptDb();
    const store = storeFor(makeRecordingClient(db).client);
    await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_A, state: "completed", copyText: "t" });
    expect(
      await store.recordCancellation({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, reason: "r", attemptSeq: 1, attemptToken: TOKEN_A }),
    ).toMatchObject({ canceled: false, state: "completed" });
    expect(db.cancellations).toBe(0);
  });

  // Correção da revisão (2026-10-14) — o cancelamento NÃO pode declarar sucesso
  // indevido quando o `apply` interno RECUSA (mesmo com estado observado
  // `failed`): sem registro de cancelamento e `canceled:false`.
  it("cancel onde apply devolve `conflict` com estado `failed` ⇒ canceled:false, SEM registro", async () => {
    const db = new CopyAttemptDb();
    const { client } = makeRecordingClient(db);
    const store = storeFor(client);
    await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_A, state: "pending" });
    // Terminal `failed` persistido com payload DEFINITIVO.
    await store.recordCopyState({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      attemptSeq: 1,
      attemptToken: TOKEN_A,
      state: "failed",
      copyPayload: { recovery: { kind: "auto", failureClass: "definitive", nextWaitMs: null } },
    });
    // Cancel traz payload DIVERGENTE ⇒ apply `conflict` sobre `failed` ⇒ RECUSA.
    const res = await store.recordCancellation({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      reason: "r",
      attemptSeq: 1,
      attemptToken: TOKEN_A,
      copyPayload: { recovery: { kind: "auto", failureClass: "transient", nextWaitMs: 5000 } },
    });
    expect(res).toEqual({ applied: false, state: "failed", canceled: false, outcome: "conflict" });
    expect(db.cancellations).toBe(0);
    // O persistido NÃO muda (payload definitivo intacto).
    const { client: reader } = makeRecordingClient(db);
    await expect(readCopyDelivery(reader, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID })).resolves.toMatchObject({
      state: "failed",
      copyPayload: { recovery: { failureClass: "definitive" } },
    });
  });

  it("cancel em tentativa SUPERADA (`stale_attempt`) ⇒ canceled:false, SEM registro, persistido intocado", async () => {
    const db = new CopyAttemptDb();
    const { client } = makeRecordingClient(db);
    const store = storeFor(client);
    await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 2, attemptToken: TOKEN_B, state: "pending" });
    const res = await store.recordCancellation({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, reason: "r", attemptSeq: 1, attemptToken: TOKEN_A });
    expect(res).toMatchObject({ canceled: false, outcome: "stale_attempt" });
    expect(db.cancellations).toBe(0);
    // A corrente (seq 2) permanece `pending` — o cancelamento recusado não a altera.
    await expect(readCopyState(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID })).resolves.toBe("pending");
  });
});

describe("B2.1 — leitores: MAIOR attempt_seq + histórico ordenado", () => {
  it("readCopyState/readCopyDelivery leem a MAIOR attempt_seq", async () => {
    const db = new CopyAttemptDb();
    db.seed(
      { campaign_id: CAMPAIGN_ID, operation_id: OPERATION_ID, attempt_seq: 1, attempt_token: TOKEN_A, state: "failed", copy_text: null, copy_payload: null, lease_at: null, request_token: null, updated_at: iso(NOW), created_at: iso(NOW) },
      { campaign_id: CAMPAIGN_ID, operation_id: OPERATION_ID, attempt_seq: 2, attempt_token: TOKEN_B, state: "completed", copy_text: "maior", copy_payload: { caption: "maior" }, lease_at: null, request_token: null, updated_at: iso(NOW), created_at: iso(NOW) },
    );
    const { client } = makeRecordingClient(db);
    await expect(readCopyState(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID })).resolves.toBe("completed");
    await expect(readCopyDelivery(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID })).resolves.toEqual({
      state: "completed",
      copyText: "maior",
      copyPayload: { caption: "maior" },
    });
  });

  it("readCopyAttempts reconstrói o histórico ASC com leaseAt/requestToken nullable", async () => {
    const db = new CopyAttemptDb();
    const { client } = makeRecordingClient(db);
    const store = storeFor(client);
    await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: TOKEN_A, state: "pending" });
    await store.recordCopyState({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 2, attemptToken: TOKEN_B, state: "failed" });
    const attempts = await readCopyAttempts(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    expect(attempts.map((a) => a.attemptSeq)).toEqual([1, 2]);
    // seq 1 nasceu `pending` ⇒ tem lease; seq 2 nasceu `failed` ⇒ sem lease.
    expect(attempts[0]?.leaseAt).not.toBeNull();
    expect(attempts[1]?.leaseAt).toBeNull();
    // `request_token` é gravado só pela aquisição (Plano 06) ⇒ null aqui.
    expect(attempts.every((a) => a.requestToken === null)).toBe(true);
    expect(attempts[0]?.attemptToken).toBe(TOKEN_A);
  });
});

describe("B2.1 — readCopyRecoverySummary (ATIVA × INTERROMPIDA + espera + contadores)", () => {
  function seededClient(rows: AttemptRow[]): SupabaseClient {
    const db = new CopyAttemptDb();
    db.seed(...rows);
    return makeRecordingClient(db).client;
  }
  const row = (over: Partial<AttemptRow>): AttemptRow => ({
    campaign_id: CAMPAIGN_ID,
    operation_id: OPERATION_ID,
    attempt_seq: 1,
    attempt_token: TOKEN_A,
    state: "pending",
    copy_text: null,
    copy_payload: null,
    lease_at: null,
    request_token: null,
    updated_at: iso(NOW),
    created_at: iso(NOW),
    ...over,
  });

  it("sem linhas ⇒ zeros/false", async () => {
    const summary = await readCopyRecoverySummary(seededClient([]), {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      nowMs: NOW,
    });
    expect(summary).toEqual({
      attemptSeq: 0,
      state: null,
      attemptActive: false,
      waitRemainingMs: 0,
      autoAttempts: 0,
      manualAttempts: 0,
      definitive: false,
    });
  });

  it("pending com lease VIGENTE ⇒ attemptActive true (ATIVA)", async () => {
    const summary = await readCopyRecoverySummary(
      seededClient([row({ state: "pending", lease_at: iso(NOW - 1000), updated_at: iso(NOW - 1000) })]),
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, nowMs: NOW },
    );
    expect(summary.attemptActive).toBe(true);
    expect(summary.state).toBe("pending");
  });

  it("pending com lease EXPIRADO ⇒ attemptActive false (INTERROMPIDA, nunca spinner)", async () => {
    const summary = await readCopyRecoverySummary(
      seededClient([row({ state: "pending", lease_at: iso(NOW - COPY_LEASE_TTL_MS - 1000), updated_at: iso(NOW - COPY_LEASE_TTL_MS - 1000) })]),
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, nowMs: NOW },
    );
    expect(summary.attemptActive).toBe(false);
  });

  it("pending sem lease (null) ⇒ attemptActive false", async () => {
    const summary = await readCopyRecoverySummary(
      seededClient([row({ state: "pending", lease_at: null, updated_at: iso(NOW) })]),
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, nowMs: NOW },
    );
    expect(summary.attemptActive).toBe(false);
  });

  it("espera restante = updated_at + nextWaitMs - now (server-side)", async () => {
    const summary = await readCopyRecoverySummary(
      seededClient([
        row({
          state: "failed",
          updated_at: iso(NOW),
          copy_payload: { recovery: { kind: "auto", failureClass: "transient", nextWaitMs: COPY_RECOVERY_WAITS_MS.after1 } },
        }),
      ]),
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, nowMs: NOW - 1000 },
    );
    // atualizado em NOW; espera 5000 ⇒ a 1000ms antes de NOW restam 5000 + 1000? => updated_at+wait-now.
    expect(summary.waitRemainingMs).toBe(COPY_RECOVERY_WAITS_MS.after1 + 1000);
    expect(summary.waitRemainingMs).toBeGreaterThan(0);
  });

  it("contadores auto/manual + definitive", async () => {
    const summary = await readCopyRecoverySummary(
      seededClient([
        row({ attempt_seq: 1, state: "failed", copy_payload: { recovery: { kind: "auto", failureClass: "transient", nextWaitMs: 5000 } } }),
        row({ attempt_seq: 2, state: "failed", copy_payload: { recovery: { kind: "auto", failureClass: "transient", nextWaitMs: 10000 } } }),
        row({ attempt_seq: 3, state: "failed", copy_payload: { recovery: { kind: "manual", failureClass: "transient", nextWaitMs: null } } }),
        row({ attempt_seq: 4, state: "failed", copy_payload: { recovery: { kind: "manual", failureClass: "definitive", nextWaitMs: null } } }),
      ]),
      { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, nowMs: NOW },
    );
    expect(summary.attemptSeq).toBe(4);
    expect(summary.autoAttempts).toBe(2);
    expect(summary.manualAttempts).toBe(2);
    expect(summary.definitive).toBe(true);
  });
});

describe("B2.1 — drenador IDENTIFICADO que CLASSIFICA a falha server-side", () => {
  function drainEvents(db: CopyAttemptDb) {
    const { client, events } = makeRecordingClient(db);
    return { store: storeFor(client), events };
  }

  it("TODA escrita (pending/failed) carrega attemptSeq/attemptToken", async () => {
    const db = new CopyAttemptDb();
    const { store, events } = drainEvents(db);
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: TOKEN_A,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async () => {},
      },
      store,
    );
    expect(result).toEqual({ state: "failed", canceled: false });
    for (const ev of events) {
      expect(ev.params.p_attempt_seq).toBe(1);
      expect(ev.params.p_attempt_token).toBe(TOKEN_A);
    }
  });

  it("erro TRANSIENT (isRetryableError) ⇒ recovery transient + espera after1 na seq 1", async () => {
    const db = new CopyAttemptDb();
    const { store, events } = drainEvents(db);
    await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: TOKEN_A,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async () => {
          throw new NetworkError();
        },
      },
      store,
    );
    const failed = events.find((e) => e.name === "product_1_1_apply_copy_state" && e.params.p_state === "failed");
    expect(failed).toBeDefined();
    expect(failed?.params.p_copy_payload).toMatchObject({
      recovery: { kind: "auto", failureClass: "transient", nextWaitMs: COPY_RECOVERY_WAITS_MS.after1 },
    });
  });

  it("erro DEFINITIVE ⇒ recovery definitive + nextWaitMs null", async () => {
    const db = new CopyAttemptDb();
    const { store, events } = drainEvents(db);
    await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: TOKEN_A,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async () => {
          throw new Error("copy_definitive_violation");
        },
      },
      store,
    );
    const failed = events.find((e) => e.name === "product_1_1_apply_copy_state" && e.params.p_state === "failed");
    expect(failed?.params.p_copy_payload).toMatchObject({
      recovery: { kind: "auto", failureClass: "definitive", nextWaitMs: null },
    });
  });

  it("task resolve SEM commit (sem erro) ⇒ transient", async () => {
    const db = new CopyAttemptDb();
    const { store, events } = drainEvents(db);
    await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 2,
        attemptToken: TOKEN_A,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async () => {
          /* sem commit */
        },
      },
      store,
    );
    const failed = events.find((e) => e.name === "product_1_1_apply_copy_state" && e.params.p_state === "failed");
    expect(failed?.params.p_copy_payload).toMatchObject({
      recovery: { kind: "auto", failureClass: "transient", nextWaitMs: COPY_RECOVERY_WAITS_MS.after2 },
    });
  });

  it("orçamento esgotado ⇒ cancel ATÔMICO identificado com recovery transient (sem write separado de failed)", async () => {
    const db = new CopyAttemptDb();
    const { store, events } = drainEvents(db);
    const budget = createCopyBudgetSignal(0);
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: TOKEN_A,
        recoveryKind: "auto",
        signal: budget.signal,
        run: ({ signal }) =>
          new Promise<void>((_resolve, reject) => {
            if (signal.aborted) {
              reject(new DOMException("aborted", "AbortError"));
              return;
            }
            signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
          }),
      },
      store,
    );
    budget.dispose();

    expect(result).toEqual({ state: "failed", canceled: true });
    // ATÔMICO: o `failed` vem do CANCELAMENTO (uma ÚNICA chamada de cancel), não
    // de um write separado de estado `failed`.
    const applies = events.filter((e) => e.name === "product_1_1_apply_copy_state");
    const cancels = events.filter((e) => e.name === "product_1_1_cancel_copy");
    expect(applies.map((e) => e.params.p_state)).toEqual(["pending"]);
    expect(cancels).toHaveLength(1);
    expect(cancels[0]?.params).toMatchObject({ p_attempt_seq: 1, p_attempt_token: TOKEN_A });
    expect(cancels[0]?.params.p_copy_payload).toMatchObject({
      recovery: { kind: "auto", failureClass: "transient", nextWaitMs: COPY_RECOVERY_WAITS_MS.after1 },
    });
  });

  // Correção da revisão (2026-10-14) — recusa do cancelamento NUNCA declara
  // `failed` nem cancelamento confirmado: `unconfirmed` + re-leitura (A1) resolve.
  it("drain: recusa `stale_attempt` (corrente `pending`) ⇒ {unconfirmed, canceled:true}, NÃO failed", async () => {
    const db = new CopyAttemptDb();
    // Corrente: tentativa 2 `pending` (outro dono). O dreno roda a tentativa 1 SUPERADA.
    db.seed({
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      attempt_seq: 2,
      attempt_token: TOKEN_B,
      state: "pending",
      copy_text: null,
      copy_payload: null,
      lease_at: iso(NOW),
      request_token: null,
      updated_at: iso(NOW),
      created_at: iso(NOW),
    });
    const { client, events } = makeRecordingClient(db);
    const budget = createCopyBudgetSignal(0);
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: TOKEN_A,
        recoveryKind: "auto",
        signal: budget.signal,
        run: ({ signal }) =>
          new Promise<void>((_resolve, reject) => {
            const abort = () => reject(new DOMException("aborted", "AbortError"));
            if (signal.aborted) {
              abort();
              return;
            }
            signal.addEventListener("abort", abort, { once: true });
          }),
      },
      storeFor(client),
    );
    budget.dispose();

    // NUNCA `failed`+`canceled:true` sobre recusa: nada é afirmado (A1 resolve).
    expect(result).toEqual({ state: "unconfirmed", canceled: true });
    // O cancelamento recusado NÃO registrou nada.
    expect(db.cancellations).toBe(0);
    // O persistido da corrente (seq 2 `pending`) NÃO foi tocado.
    await expect(readCopyState(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID })).resolves.toBe("pending");
    // Houve exatamente UMA chamada de cancel (sem segundo write — A1).
    const cancels = events.filter((e) => e.name === "product_1_1_cancel_copy");
    expect(cancels).toHaveLength(1);
  });

  it("conclusão TARDIA após o settle NÃO persiste (latch preservado)", async () => {
    const db = new CopyAttemptDb();
    const { store, events } = drainEvents(db);
    let capturedCommit: ((d: { copyText: string; payload?: Record<string, unknown> | null }) => Promise<void>) | null = null;
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: TOKEN_A,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async ({ commit }) => {
          capturedCommit = commit;
        },
      },
      store,
    );
    expect(result).toEqual({ state: "failed", canceled: false });
    const appliesBefore = events.filter((e) => e.name === "product_1_1_apply_copy_state").length;
    expect(appliesBefore).toBe(2); // pending + failed
    // Conclusão tardia APOS o settle: NO-OP (nenhum write extra).
    await (capturedCommit as CopyCommit | null)?.({ copyText: "tarde demais" });
    const appliesAfter = events.filter((e) => e.name === "product_1_1_apply_copy_state").length;
    expect(appliesAfter).toBe(appliesBefore);
  });
});
