// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Plano 03 — dublês CONTROLADOS da rota (`[id]/copy-recovery`): auth/ownership/
// getCampaign/não-ativação + um provider SIMULADO com contador. A LÓGICA da
// recuperação (`copy-recovery`/`copy-state`/`default-copy-runner`) permanece REAL
// contra estes dublês; nenhum crédito/artefato é tocado (nenhuma chamada paga).
// ---------------------------------------------------------------------------
const routeHarness = vi.hoisted(() => {
  interface Row {
    campaign_id: string;
    operation_id: string;
    attempt_seq: number;
    attempt_token: string | null;
    state: string;
    copy_text: string | null;
    copy_payload: Record<string, unknown> | null;
    lease_at: string | null;
    request_token: string | null;
    updated_at: string;
    created_at: string;
  }

  const NOW = 1_780_000_000_000;
  const iso = (ms: number): string => new Date(ms).toISOString();

  const state = {
    rows: [] as Row[],
    acquireResponder: null as null | ((params: Record<string, unknown>) => unknown),
    providerCalls: 0,
    providerSequence: [] as Array<"ok" | Error>,
    providerIndex: 0,
    authUser: { userId: "user-1" } as unknown,
    authError: null as unknown,
    ownershipResult: {
      name: "Loja Teste",
      segment: "outros",
      tone_of_voice: null,
      positioning: null,
      short_description: null,
      slogan: null,
      is_test_store: true,
    } as unknown,
    ownershipError: null as unknown,
    campaign: null as unknown,
    flow: "new_flow" as string,
    authDecision: { allowed: true } as unknown,
    authThrows: false,
    operation: null as unknown,
    sameOriginThrows: false,
    creditOrArtifactCalls: 0,
  };

  function applyRpc(params: Record<string, unknown>) {
    const campaignId = String(params.p_campaign_id);
    const operationId = String(params.p_operation_id);
    const st = params.p_state as string;
    const seq = params.p_attempt_seq as number;
    const token = params.p_attempt_token as string;
    const copyText = (params.p_copy_text as string | null) ?? null;
    const copyPayload = (params.p_copy_payload as Record<string, unknown> | null) ?? null;

    if (st === "completed" && (copyText === null || copyText.trim() === "")) {
      return { applied: false, outcome: "invalid_content", state: null };
    }

    const forOp = state.rows.filter(
      (r) => r.campaign_id === campaignId && r.operation_id === operationId,
    );
    const maxSeq = forOp.length > 0 ? Math.max(...forOp.map((r) => r.attempt_seq)) : 0;
    if (seq < maxSeq) {
      return {
        applied: false,
        outcome: "stale_attempt",
        state: forOp.find((r) => r.attempt_seq === maxSeq)?.state ?? null,
      };
    }
    const completedExists = forOp.some((r) => r.state === "completed");
    const cur = forOp.find((r) => r.attempt_seq === seq);
    if (completedExists && !(cur && cur.state === "completed" && seq === maxSeq)) {
      return { applied: false, outcome: "rejected", state: "completed" };
    }
    if (!cur) {
      state.rows.push({
        campaign_id: campaignId,
        operation_id: operationId,
        attempt_seq: seq,
        attempt_token: token,
        state: st,
        copy_text: copyText,
        copy_payload: copyPayload,
        lease_at: st === "pending" ? iso(NOW) : null,
        request_token: null,
        updated_at: iso(NOW),
        created_at: iso(NOW),
      });
      return { applied: true, outcome: "applied", state: st };
    }
    if (cur.attempt_token !== token) {
      return { applied: false, outcome: "conflict", state: cur.state };
    }
    const terminal = cur.state === "completed" || cur.state === "failed";
    if (terminal) {
      if (cur.state === st) {
        const eq =
          (cur.copy_text ?? null) === copyText &&
          JSON.stringify(cur.copy_payload ?? null) === JSON.stringify(copyPayload);
        return eq
          ? { applied: false, outcome: "idempotent", state: cur.state }
          : { applied: false, outcome: "conflict", state: cur.state };
      }
      return { applied: false, outcome: "rejected", state: cur.state };
    }
    if (cur.state === st) return { applied: false, outcome: "idempotent", state: cur.state };
    cur.state = st;
    cur.copy_text = copyText;
    cur.copy_payload = copyPayload;
    cur.updated_at = iso(NOW + 1);
    return { applied: true, outcome: "applied", state: st };
  }

  const client = {
    from() {
      const filters: Record<string, unknown> = {};
      let asc = true;
      let lim: number | undefined;
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        eq(col: string, val: unknown) {
          filters[col] = val;
          return chain;
        },
        order(_col: string, opts?: { ascending?: boolean }) {
          asc = opts ? opts.ascending !== false : true;
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
      function pick(): Row[] {
        const rows = state.rows.filter(
          (r) => r.campaign_id === filters.campaign_id && r.operation_id === filters.operation_id,
        );
        rows.sort((a, b) => (asc ? a.attempt_seq - b.attempt_seq : b.attempt_seq - a.attempt_seq));
        return typeof lim === "number" ? rows.slice(0, lim) : rows;
      }
      return chain;
    },
    rpc(name: string, params: Record<string, unknown>) {
      if (name === "product_1_1_acquire_copy_attempt") {
        const data = state.acquireResponder
          ? state.acquireResponder(params)
          : { acquired: false, reason: "attempt_limit_reached" };
        return Promise.resolve({ data, error: null });
      }
      if (name === "product_1_1_apply_copy_state") {
        return Promise.resolve({ data: applyRpc(params), error: null });
      }
      if (name === "product_1_1_cancel_copy") {
        const res = applyRpc({
          ...params,
          p_state: "failed",
          p_copy_text: null,
          p_copy_payload: null,
        });
        if (res.state === "failed") {
          return Promise.resolve({
            data: { applied: res.applied, state: "failed", canceled: true, outcome: res.outcome },
            error: null,
          });
        }
        return Promise.resolve({
          data: { applied: res.applied, state: res.state, canceled: false, outcome: res.outcome },
          error: null,
        });
      }
      if (/credit|artifact|deliver|refund|reserve|estorno/i.test(name)) {
        state.creditOrArtifactCalls += 1;
      }
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
    },
  };

  const providerGateway = {
    async invoke(): Promise<{ content: string; model: string }> {
      state.providerCalls += 1;
      const next = state.providerSequence[state.providerIndex] ?? "ok";
      state.providerIndex += 1;
      if (next instanceof Error) throw next;
      return {
        content: JSON.stringify({
          title: "Oferta Especial",
          caption: "Legenda simulada",
          hashtags: [],
          cta_post: "Aproveite!",
        }),
        model: "gpt-4o",
      };
    },
    async hasFallback(): Promise<boolean> {
      return false;
    },
  };

  return { state, client, providerGateway, iso, NOW };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: routeHarness.client,
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return { ...actual, defaultAiGateway: routeHarness.providerGateway };
});

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: (): void => {
    if (routeHarness.state.sameOriginThrows) throw new Error("cross_origin");
  },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: async (): Promise<unknown> => {
    if (routeHarness.state.authError) throw routeHarness.state.authError;
    return routeHarness.state.authUser;
  },
  requireUser: async (): Promise<unknown> => routeHarness.state.authUser,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: async (): Promise<unknown> => {
    if (routeHarness.state.ownershipError) throw routeHarness.state.ownershipError;
    return routeHarness.state.ownershipResult;
  },
}));

vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: async (): Promise<unknown> => routeHarness.state.campaign,
  listArtVersions: async (): Promise<unknown[]> => [],
}));

vi.mock("@/lib/campaign/new-flow-marker", () => ({
  classifyCampaignFlow: (): string => routeHarness.state.flow,
}));

vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: async (): Promise<unknown> => {
    if (routeHarness.state.authThrows) throw new Error("read_failure");
    return routeHarness.state.authDecision;
  },
}));

vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: (): unknown => ({
    requestedScope: "test_stores",
    expectedInstanceIdentity: "test-instance",
    expectedEnvironment: "isolated",
  }),
}));

vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    async getCampaignOperation(): Promise<unknown> {
      return routeHarness.state.operation;
    }
  },
}));

vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: (): { copyDirectorEnabled: boolean } => ({ copyDirectorEnabled: true }),
}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { NetworkError, ProviderRateLimitError } from "@/lib/copy/errors";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

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
  type CopyStateTransitionResult,
  type CopyCommit,
} from "../copy/copy-state";
import {
  ACQUIRE_COPY_ATTEMPT_RPC,
  ProductOneToOneCopyAcquisitionClient,
  type CopyAcquisitionResult,
} from "../copy/copy-acquisition-client";
import { CopyRecoveryRequestSchema } from "../copy/recovery-schemas";
import {
  ProductOneToOneCopyRecoveryClient,
  ProductOneToOneCopyRecoveryError,
  classifyCopyFailure,
} from "../copy/copy-recovery";
import {
  COPY_RECOVERY_AUTO_LIMIT,
  COPY_RECOVERY_MANUAL_LIMIT,
  COPY_RECOVERY_TOTAL_LIMIT,
  canRequestManualCopyRecovery,
  classifyCopyRecoveryFailure,
  copyRecoveryWaitMs,
  nextCopyRecoveryAttempt,
} from "../copy/copy-recovery-policy";
import type { DefaultProductOneToOneCopyRunnerInput } from "../copy/default-copy-runner";
import { AiGateway } from "@/lib/ai/gateway";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiModelConfig, AiModelResolver, AiProtocol } from "@/lib/ai/model-resolver";
import { AiInvocationError } from "@/lib/ai/types";
import type {
  AiAdapter,
  AiAdapterRegistry,
  AiTelemetryContext,
} from "@/lib/ai/types";

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

// Plano 06 — aquisição atômica + backfill transacional (SQL estático).
const stripSqlComments = (sql: string): string =>
  sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

const ACQUIRE_MIGRATION_FILE = "20261013000002_f56_2b2a_copy_acquire_attempt.sql";
const acquireMigrationSql = readFileSync(
  path.join(MIGRATIONS_DIR, ACQUIRE_MIGRATION_FILE),
  "utf8",
);
const ACQUIRE_ACTIVE_SQL = stripSqlComments(acquireMigrationSql);

const BACKFILL_MIGRATION_FILE = "20261013000003_f56_2b2a_copy_state_backfill.sql";
const backfillMigrationSql = readFileSync(
  path.join(MIGRATIONS_DIR, BACKFILL_MIGRATION_FILE),
  "utf8",
);
const BACKFILL_ACTIVE_SQL = stripSqlComments(backfillMigrationSql);

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

function makeRecordingClient(
  db: CopyAttemptDb,
  acquireResponder?: (params: Record<string, unknown>) => unknown,
): { client: SupabaseClient; events: RecordedEvent[] } {
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
      if (name === "product_1_1_acquire_copy_attempt") {
        const data = acquireResponder
          ? acquireResponder(params)
          : {
              acquired: true,
              reason: null,
              attempt_seq: 1,
              attempt_token: TOKEN_A,
              mode: params.p_mode,
            };
        return Promise.resolve({ data, error: null });
      }
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

  /** Store com envelope FIXO para o apply (o desfecho exato sob prova). */
  function fixedEnvelopeStore(result: CopyStateTransitionResult): CopyStateStore {
    return {
      recordCopyState: async () => result,
      recordCancellation: async () => ({ applied: false, state: null, canceled: false }),
    };
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

  // Revisão 2026-10-14 (2ª rodada) — MESMO problema do sucesso indevido já
  // corrigido no cancel (918c7161), agora no caminho terminal NÃO-cancelado:
  // `settleFailTerminal` só declara `failed` quando o envelope CONFIRMA o
  // persistido (`applied`/`idempotent` — `confirmsPersistedState`); recusas ou
  // `state: null` ⇒ incerteza LOCAL (`unconfirmed`), nunca falha confirmada.
  it("drain (não-cancel): recusa `stale_attempt` (corrente `pending`) ⇒ {unconfirmed, canceled:false}, NÃO failed", async () => {
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
    const result = await drainCopyTask(
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
      storeFor(client),
    );
    // RECUSA (`stale_attempt`, estado corrente `pending`): NADA é afirmado — a
    // RE-LEITURA resolve; nunca um `failed` enganoso.
    expect(result).toEqual({ state: "unconfirmed", canceled: false });
    // Caminho NÃO-cancelado: nenhum cancel; exatamente 2 escritas (pending + failed).
    expect(events.filter((e) => e.name === "product_1_1_cancel_copy")).toHaveLength(0);
    expect(events.filter((e) => e.name === "product_1_1_apply_copy_state")).toHaveLength(2);
    // O persistido da corrente (seq 2 `pending`) NÃO foi tocado.
    await expect(
      readCopyState(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    ).resolves.toBe("pending");
  });

  it("drain (não-cancel): recusa `invalid_content` com `state: null` ⇒ unconfirmed (NUNCA failed)", async () => {
    const result = await drainCopyTask(
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
      fixedEnvelopeStore({ applied: false, outcome: "invalid_content", state: null }),
    );
    expect(result).toEqual({ state: "unconfirmed", canceled: false });
  });

  it("drain (não-cancel): recusa `conflict` com estado `failed` ⇒ unconfirmed (recusa NUNCA confirma falha)", async () => {
    const db = new CopyAttemptDb();
    // Mesma seq com token DIVERGENTE (outro dono já terminal `failed`): a
    // escrita do dreno é RECUSADA (`conflict`) e o persistido NÃO muda.
    db.seed({
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      attempt_seq: 1,
      attempt_token: TOKEN_B,
      state: "failed",
      copy_text: null,
      copy_payload: { other: true },
      lease_at: null,
      request_token: null,
      updated_at: iso(NOW),
      created_at: iso(NOW),
    });
    const { client } = makeRecordingClient(db);
    const result = await drainCopyTask(
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
      storeFor(client),
    );
    // `conflict` NÃO é `applied`/`idempotent`: recusa nunca confirma falha.
    expect(result).toEqual({ state: "unconfirmed", canceled: false });
  });

  it("drain (não-cancel): apply `applied` com estado `failed` ⇒ {failed, canceled:false} (positivo preservado)", async () => {
    const db = new CopyAttemptDb();
    const { store } = drainEvents(db);
    const result = await drainCopyTask(
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
    expect(result).toEqual({ state: "failed", canceled: false });
  });

  it("drain (não-cancel): replay `idempotent` com estado `failed` ⇒ {failed, canceled:false} (positivo preservado)", async () => {
    const result = await drainCopyTask(
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
      fixedEnvelopeStore({ applied: false, outcome: "idempotent", state: "failed" }),
    );
    expect(result).toEqual({ state: "failed", canceled: false });
  });

  it("drain (não-cancel): envelope com estado persistido `completed` ⇒ {completed, canceled:false} (terminal protegido preservado)", async () => {
    const result = await drainCopyTask(
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
      fixedEnvelopeStore({ applied: false, outcome: "rejected", state: "completed" }),
    );
    expect(result).toEqual({ state: "completed", canceled: false });
  });
});

// ---------------------------------------------------------------------------
// (c) F56.2b2a — B2.1 / Plano 06: AQUISIÇÃO ATÔMICA (SQL estático) + BACKFILL
//     transacional (SQL estático) + comportamento do cliente (RPC SIMULADA).
// ---------------------------------------------------------------------------

describe("B2.1 — Plano 06: migration de aquisição atômica (SQL estático)", () => {
  it("declara LOCAL-ONLY e a RPC SECURITY DEFINER sob a trava compartilhada", () => {
    expect(acquireMigrationSql).toContain("LOCAL-ONLY");
    expect(acquireMigrationSql).toContain("migration up --local");
    expect(ACQUIRE_ACTIVE_SQL).toContain("product_1_1_acquire_copy_attempt");
    expect(ACQUIRE_ACTIVE_SQL).toContain("FOR UPDATE");
    expect(ACQUIRE_ACTIVE_SQL).toContain("pg_advisory_xact_lock");
    expect(ACQUIRE_ACTIVE_SQL).toContain("product_1_1_campaign_credit_operations");
    expect(ACQUIRE_ACTIVE_SQL).toContain("p_request_token");
    expect(ACQUIRE_ACTIVE_SQL).toContain("SECURITY DEFINER");
    expect(ACQUIRE_ACTIVE_SQL).toContain("SET search_path = ''");
    expect(ACQUIRE_ACTIVE_SQL).toContain("gen_random_uuid()");
  });

  it("ordem FIXA da trava compartilhada: advisory → C4 → copy_state FOR UPDATE", () => {
    const advisoryIdx = ACQUIRE_ACTIVE_SQL.indexOf(
      "pg_advisory_xact_lock(hashtextextended(p_campaign_id::text || ':' || p_operation_id::text, 0))",
    );
    const creditIdx = ACQUIRE_ACTIVE_SQL.indexOf(
      "PERFORM 1 FROM public.product_1_1_campaign_credit_operations",
    );
    const copyLockIdx = ACQUIRE_ACTIVE_SQL.search(
      /PERFORM 1 FROM public\.product_1_1_copy_state[\s\S]{0,160}?FOR UPDATE/,
    );
    expect(advisoryIdx).toBeGreaterThanOrEqual(0);
    expect(creditIdx).toBeGreaterThanOrEqual(0);
    expect(copyLockIdx).toBeGreaterThanOrEqual(0);
    expect(advisoryIdx).toBeLessThan(creditIdx);
    expect(creditIdx).toBeLessThan(copyLockIdx);
  });

  it("devolve os motivos de recusa + marcadores de expiração/lease (terminais separados)", () => {
    for (const reason of [
      "attempt_in_progress",
      "attempt_already_completed",
      "wait_not_elapsed",
      "attempt_limit_reached",
      "already_acquired",
      "automatic_closed",
    ]) {
      expect(ACQUIRE_ACTIVE_SQL).toContain(`'${reason}'`);
    }
    expect(ACQUIRE_ACTIVE_SQL).toContain("staleAttempt");
    expect(ACQUIRE_ACTIVE_SQL).toContain("{recovery,staleAttempt}");
    expect(ACQUIRE_ACTIVE_SQL).toContain("lease_at");
    // Terminais SEPARADOS: a aquisição NÃO devolve `operation_terminal`.
    expect(ACQUIRE_ACTIVE_SQL).not.toContain("'operation_terminal'");
  });

  it("RPC-only A2: GRANT EXECUTE apenas para service_role", () => {
    expect(ACQUIRE_ACTIVE_SQL).toContain(
      "GRANT EXECUTE ON FUNCTION public.product_1_1_acquire_copy_attempt(UUID, UUID, TEXT, UUID)",
    );
    expect(ACQUIRE_ACTIVE_SQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.product_1_1_acquire_copy_attempt\(UUID, UUID, TEXT, UUID\)[\s\S]*?TO service_role;/,
    );
  });
});

describe("B2.1 — Plano 06: backfill transacional (SQL estático)", () => {
  it("é transacional (CLI-controlada) e restaura a imutabilidade do cancelamento", () => {
    // A atomicidade é da TRANSAÇÃO DE BATCH da CLI (SQL + registro de versão
    // juntos); NÃO há `BEGIN;`/`COMMIT;` explícito no arquivo (um `COMMIT;`
    // interno separaria o dado do registro de versão). O `BEGIN` do plpgsql
    // (dentro de `$$ ... $$`, sem `;` sozinho na linha) NÃO conta.
    expect(backfillMigrationSql).not.toMatch(/^\s*begin\s*;/im);
    expect(backfillMigrationSql).not.toMatch(/^\s*commit\s*;/im);
    expect(BACKFILL_ACTIVE_SQL).toContain(
      "DISABLE TRIGGER trg_product_1_1_copy_cancellations_immutable",
    );
    expect(BACKFILL_ACTIVE_SQL).toContain(
      "ENABLE TRIGGER trg_product_1_1_copy_cancellations_immutable",
    );
  });

  it("atribui a tentativa histórica ao contador AUTOMÁTICO (aditivo, sem apagar)", () => {
    expect(BACKFILL_ACTIVE_SQL).toContain(
      "jsonb_build_object('recovery', jsonb_build_object('kind', 'auto'))",
    );
    // Nenhum DELETE em massa do histórico.
    expect(BACKFILL_ACTIVE_SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("vincula o token do cancelamento ao token do estado da MESMA tentativa", () => {
    expect(BACKFILL_ACTIVE_SQL).toContain("gen_random_uuid() AS token");
    expect(BACKFILL_ACTIVE_SQL).toMatch(
      /FROM public\.product_1_1_copy_state cs[\s\S]*?cs\.campaign_id = cc\.campaign_id[\s\S]*?cs\.operation_id = cc\.operation_id/,
    );
  });

  it("troca a UNIQUE por tentativa, aplica NOT NULL e RECRIA o cancel (novo ON CONFLICT)", () => {
    expect(BACKFILL_ACTIVE_SQL).toContain("SET NOT NULL");
    expect(BACKFILL_ACTIVE_SQL).toContain("UNIQUE (campaign_id, operation_id, attempt_seq)");
    expect(BACKFILL_ACTIVE_SQL).toContain(
      "DROP FUNCTION IF EXISTS public.product_1_1_cancel_copy",
    );
    expect(BACKFILL_ACTIVE_SQL).toContain(
      "ON CONFLICT (campaign_id, operation_id, attempt_seq) DO NOTHING",
    );
    expect(BACKFILL_ACTIVE_SQL).toContain(
      "(campaign_id, operation_id, attempt_seq, attempt_token, reason)",
    );
    expect(BACKFILL_ACTIVE_SQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.product_1_1_cancel_copy\(UUID, UUID, TEXT, INTEGER, UUID, JSONB\)[\s\S]*?TO service_role;/,
    );
    // Gate por desfecho + repasse do payload de recuperação preservados.
    expect(BACKFILL_ACTIVE_SQL).toContain("IF v_outcome IN ('applied','idempotent') THEN");
    expect(BACKFILL_ACTIVE_SQL).toContain("p_copy_payload");
  });
});

describe("B2.1 — Plano 06: cliente de aquisição (envelope FECHADO, RPC simulada)", () => {
  function acquisitionClient(
    responder: (params: Record<string, unknown>) => unknown,
  ): { client: ProductOneToOneCopyAcquisitionClient; events: RecordedEvent[] } {
    const events: RecordedEvent[] = [];
    const raw = {
      rpc(name: string, params: Record<string, unknown>) {
        events.push({ name, params });
        return Promise.resolve({ data: responder(params), error: null });
      },
    } as unknown as SupabaseClient;
    return { client: new ProductOneToOneCopyAcquisitionClient(raw), events };
  }

  const base = { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID } as const;

  it("exporta a constante da RPC e envia p_request_token (null quando ausente)", async () => {
    expect(ACQUIRE_COPY_ATTEMPT_RPC).toBe("product_1_1_acquire_copy_attempt");
    const { client, events } = acquisitionClient(() => ({
      acquired: true,
      reason: null,
      attempt_seq: 1,
      attempt_token: TOKEN_A,
      mode: "auto",
    }));
    await client.acquire({ ...base, mode: "auto" });
    expect(events[0].name).toBe(ACQUIRE_COPY_ATTEMPT_RPC);
    expect(events[0].params).toMatchObject({
      p_campaign_id: CAMPAIGN_ID,
      p_operation_id: OPERATION_ID,
      p_mode: "auto",
      p_request_token: null,
    });
  });

  it("VENCEDOR: acquired:true + attempt_seq/token server-side (+ expiredClosed)", async () => {
    const { client } = acquisitionClient(() => ({
      acquired: true,
      reason: null,
      attempt_seq: 2,
      attempt_token: TOKEN_B,
      mode: "auto",
      expired_closed: true,
    }));
    await expect(client.acquire({ ...base, mode: "auto" })).resolves.toEqual({
      acquired: true,
      attemptSeq: 2,
      attemptToken: TOKEN_B,
      mode: "auto",
      expiredClosed: true,
    });

    // expiredClosed ausente ⇒ false; reenvio envia o request_token.
    const withToken = acquisitionClient(() => ({
      acquired: true,
      reason: null,
      attempt_seq: 1,
      attempt_token: TOKEN_A,
      mode: "manual",
    }));
    await expect(
      withToken.client.acquire({ ...base, mode: "manual", requestToken: TOKEN_A }),
    ).resolves.toEqual({
      acquired: true,
      attemptSeq: 1,
      attemptToken: TOKEN_A,
      mode: "manual",
      expiredClosed: false,
    });
    expect(withToken.events[0].params.p_request_token).toBe(TOKEN_A);
  });

  it("resposta VAZIA/contraditória NUNCA é vencedor (lança)", async () => {
    await expect(
      acquisitionClient(() => null).client.acquire({ ...base, mode: "auto" }),
    ).rejects.toThrow(/empty_rpc_response/);
    await expect(
      acquisitionClient(() => ({
        acquired: true,
        attempt_seq: 9,
        attempt_token: TOKEN_A,
      })).client.acquire({ ...base, mode: "auto" }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    await expect(
      acquisitionClient(() => ({
        acquired: true,
        attempt_seq: 1,
        attempt_token: "",
      })).client.acquire({ ...base, mode: "auto" }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    await expect(
      acquisitionClient(() => ({ acquired: true })).client.acquire({
        ...base,
        mode: "auto",
      }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
  });

  it("cada motivo de PERDA apenas acompanha (sem iniciar chamada)", async () => {
    const losers: Array<{ payload: Record<string, unknown>; expected: CopyAcquisitionResult }> = [
      {
        payload: { acquired: false, reason: "attempt_in_progress" },
        expected: { acquired: false, reason: "attempt_in_progress" },
      },
      {
        payload: { acquired: false, reason: "attempt_already_completed" },
        expected: { acquired: false, reason: "attempt_already_completed" },
      },
      {
        payload: { acquired: false, reason: "attempt_limit_reached" },
        expected: { acquired: false, reason: "attempt_limit_reached" },
      },
      {
        payload: { acquired: false, reason: "automatic_closed" },
        expected: { acquired: false, reason: "automatic_closed" },
      },
    ];
    for (const { payload, expected } of losers) {
      await expect(
        acquisitionClient(() => payload).client.acquire({ ...base, mode: "auto" }),
      ).resolves.toEqual(expected);
    }
  });

  it("already_acquired devolve a identidade EXISTENTE (reenvio atrasado, sem novo slot)", async () => {
    const { client } = acquisitionClient(() => ({
      acquired: false,
      reason: "already_acquired",
      attempt_seq: 2,
      attempt_token: TOKEN_B,
    }));
    await expect(
      client.acquire({ ...base, mode: "auto", requestToken: TOKEN_B }),
    ).resolves.toEqual({
      acquired: false,
      reason: "already_acquired",
      attemptSeq: 2,
      attemptToken: TOKEN_B,
    });
  });

  it("wait_not_elapsed expõe waitRemainingMs (espera server-side)", async () => {
    const { client } = acquisitionClient(() => ({
      acquired: false,
      reason: "wait_not_elapsed",
      wait_remaining_ms: 4200,
    }));
    await expect(client.acquire({ ...base, mode: "auto" })).resolves.toEqual({
      acquired: false,
      reason: "wait_not_elapsed",
      waitRemainingMs: 4200,
    });
  });

  it("VENCEDOR contraditório: reason não-nulo OU mode ausente/divergente ⇒ lança", async () => {
    // vencedor com `reason` NÃO-nulo (contradiz um vencedor) ⇒ lança.
    await expect(
      acquisitionClient(() => ({
        acquired: true,
        reason: "attempt_limit_reached",
        attempt_seq: 1,
        attempt_token: TOKEN_A,
        mode: "auto",
      })).client.acquire({ ...base, mode: "auto" }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    // vencedor SEM `mode` ⇒ lança (não há mais sucesso implícito por omissão).
    await expect(
      acquisitionClient(() => ({
        acquired: true,
        reason: null,
        attempt_seq: 1,
        attempt_token: TOKEN_A,
      })).client.acquire({ ...base, mode: "auto" }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    // vencedor com `mode` DIVERGENTE do solicitado ⇒ lança.
    await expect(
      acquisitionClient(() => ({
        acquired: true,
        reason: null,
        attempt_seq: 1,
        attempt_token: TOKEN_A,
        mode: "manual",
      })).client.acquire({ ...base, mode: "auto" }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
  });

  it("perdedor com campo OBRIGATÓRIO ausente/inválido ⇒ lança (envelope fechado)", async () => {
    // `already_acquired` SEM `attempt_seq` ⇒ lança.
    await expect(
      acquisitionClient(() => ({
        acquired: false,
        reason: "already_acquired",
        attempt_token: TOKEN_B,
      })).client.acquire({ ...base, mode: "auto" }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    // `already_acquired` SEM `attempt_token` ⇒ lança.
    await expect(
      acquisitionClient(() => ({
        acquired: false,
        reason: "already_acquired",
        attempt_seq: 2,
      })).client.acquire({ ...base, mode: "auto" }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    // `wait_not_elapsed` SEM `wait_remaining_ms` ⇒ lança.
    await expect(
      acquisitionClient(() => ({
        acquired: false,
        reason: "wait_not_elapsed",
      })).client.acquire({ ...base, mode: "auto" }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
  });

  // Revisão 3ª rodada — TIPO ESTRITO: `Number(...)` coagiria `null`/booleans a
  // 0/1 (e aceitaria strings numéricas). O envelope fechado exige o TIPO
  // NUMÉRICO CRU antes de validar inteiro/faixa.
  it("tipo NÃO-numérico em attempt_seq (vencedor) ⇒ lança (sem coerção)", async () => {
    for (const bad of [null, true, false, "1"] as const) {
      await expect(
        acquisitionClient(() => ({
          acquired: true,
          reason: null,
          attempt_seq: bad,
          attempt_token: TOKEN_A,
          mode: "auto",
        })).client.acquire({ ...base, mode: "auto" }),
      ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    }
  });

  it("`already_acquired` com attempt_seq NÃO-numérico ⇒ lança (sem coerção)", async () => {
    for (const bad of [null, true, "1"] as const) {
      await expect(
        acquisitionClient(() => ({
          acquired: false,
          reason: "already_acquired",
          attempt_seq: bad,
          attempt_token: TOKEN_B,
        })).client.acquire({ ...base, mode: "auto" }),
      ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    }
  });

  it("`wait_not_elapsed` com wait_remaining_ms NÃO-numérico ⇒ lança (sem coerção)", async () => {
    for (const bad of [null, false, true, "5"] as const) {
      await expect(
        acquisitionClient(() => ({
          acquired: false,
          reason: "wait_not_elapsed",
          wait_remaining_ms: bad,
        })).client.acquire({ ...base, mode: "auto" }),
      ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    }
  });

  it("motivo DESCONHECIDO/ausente (incl. operation_terminal) NUNCA é aceito", async () => {
    await expect(
      acquisitionClient(() => ({
        acquired: false,
        reason: "operation_terminal",
      })).client.acquire({ ...base, mode: "auto" }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    await expect(
      acquisitionClient(() => ({ acquired: false, reason: "bogus" })).client.acquire({
        ...base,
        mode: "auto",
      }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
    await expect(
      acquisitionClient(() => ({ acquired: false })).client.acquire({
        ...base,
        mode: "auto",
      }),
    ).rejects.toThrow(/copy_acquisition_invalid_envelope/);
  });
});

// ---------------------------------------------------------------------------
// (d) F56.2b2a — B2.1 / Plano 02: schema ESTRITO da ação explícita
//     (`requestToken` OBRIGATÓRIO; campos desconhecidos rejeitados).
// ---------------------------------------------------------------------------

describe("B2.1 — Plano 02: recovery schema (Zod .strict() com requestToken obrigatório)", () => {
  const REQUEST_TOKEN = "5e8d2b1a-0c4f-4a1b-9c3f-3b0f6c1a7d2e";

  const valid = {
    operationId: OPERATION_ID,
    mode: "auto_retry" as const,
    attemptSeq: 2,
    attemptToken: TOKEN_A,
    requestToken: REQUEST_TOKEN,
  };

  it("ACEITA o corpo válido (operationId/mode/attemptSeq/attemptToken/requestToken)", () => {
    expect(CopyRecoveryRequestSchema.safeParse(valid).success).toBe(true);
    expect(
      CopyRecoveryRequestSchema.safeParse({ ...valid, mode: "manual" }).success,
    ).toBe(true);
  });

  it("REJEITA a AUSÊNCIA de requestToken (OBRIGATÓRIO — sem .optional())", () => {
    const { requestToken: _omit, ...withoutToken } = valid;
    void _omit;
    const result = CopyRecoveryRequestSchema.safeParse(withoutToken);
    expect(result.success).toBe(false);
    expect(CopyRecoveryRequestSchema.safeParse({ ...valid, requestToken: undefined }).success).toBe(
      false,
    );
  });

  it("REJEITA campo DESCONHECIDO (.strict())", () => {
    expect(
      CopyRecoveryRequestSchema.safeParse({ ...valid, extra: "nope" }).success,
    ).toBe(false);
  });

  it("REJEITA mode fora de auto_retry/manual", () => {
    expect(CopyRecoveryRequestSchema.safeParse({ ...valid, mode: "auto" }).success).toBe(false);
    expect(CopyRecoveryRequestSchema.safeParse({ ...valid, mode: "manual_x" }).success).toBe(false);
  });

  it("REJEITA attemptSeq fora de 1..6", () => {
    expect(CopyRecoveryRequestSchema.safeParse({ ...valid, attemptSeq: 0 }).success).toBe(false);
    expect(CopyRecoveryRequestSchema.safeParse({ ...valid, attemptSeq: 7 }).success).toBe(false);
    expect(CopyRecoveryRequestSchema.safeParse({ ...valid, attemptSeq: 1.5 }).success).toBe(false);
  });

  it("REJEITA requestToken NÃO-uuid", () => {
    expect(
      CopyRecoveryRequestSchema.safeParse({ ...valid, requestToken: "not-a-uuid" }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (e) F56.2b2a — B2.1 / Plano 02/03: POLÍTICA pura (limites/esperas/classificação)
//     + SERVIÇO (UMA chamada por tentativa; fallback = TENTATIVA SEGUINTE;
//     tentativa inicial identificada) — provider SIMULADO (nenhuma chamada paga).
// ---------------------------------------------------------------------------

const REQUEST_TOKEN = "3b0f6c1a-7d2e-4a1b-9c3f-5e8d2b1a0c4f";
const STORE_ID = "33333333-3333-4333-8333-333333333333";

const runnerInput: DefaultProductOneToOneCopyRunnerInput = {
  campaignId: CAMPAIGN_ID,
  operationId: OPERATION_ID,
  storeId: STORE_ID,
  briefing: {
    product: { name: "Produto Teste", description: null },
    commercial: { intent: "offer", discountedPriceText: "R$ 19,90" },
  },
  copyContext: { storeName: "Loja Teste", segment: "outros", discountedPriceCents: 1990 },
  copyDirectorEnabled: true,
};

function recoveryFailureClass(row: AttemptRow | undefined): unknown {
  return (row?.copy_payload?.recovery as Record<string, unknown> | undefined)?.failureClass;
}
function recoveryKind(row: AttemptRow | undefined): unknown {
  return (row?.copy_payload?.recovery as Record<string, unknown> | undefined)?.kind;
}
function recoveryWait(row: AttemptRow | undefined): unknown {
  return (row?.copy_payload?.recovery as Record<string, unknown> | undefined)?.nextWaitMs;
}

interface CopyProviderSim {
  readonly invoker: AiInvoker;
  readonly targets: Array<string | undefined>;
  readonly calls: () => number;
  setSequence(seq: Array<"ok" | Error>): void;
}

function makeCopyProviderSim(hasFallback = true): CopyProviderSim {
  let seq: Array<"ok" | Error> = [];
  let index = 0;
  const targets: Array<string | undefined> = [];
  let calls = 0;
  const invoker: AiInvoker = {
    async invoke(_capability, _request, _telemetry, target) {
      calls += 1;
      targets.push(target);
      const next = seq[index] ?? "ok";
      index += 1;
      if (next instanceof Error) throw next;
      return {
        content: JSON.stringify({
          title: "Oferta Especial",
          caption: "Legenda simulada",
          hashtags: [],
          cta_post: "Aproveite!",
        }),
        model: "gpt-4o",
      };
    },
    async hasFallback() {
      return hasFallback;
    },
  };
  return {
    invoker,
    targets,
    calls: () => calls,
    setSequence(s) {
      seq = s;
      index = 0;
    },
  };
}

const winner = (seq: number, token: string) => ({
  acquired: true,
  reason: null,
  attempt_seq: seq,
  attempt_token: token,
  mode: "auto",
});

async function runRecover(params: {
  db: CopyAttemptDb;
  provider: CopyProviderSim;
  acquireResponder: (p: Record<string, unknown>) => unknown;
  requestToken?: string;
  mode?: "auto" | "manual";
}) {
  const { client, events } = makeRecordingClient(params.db, params.acquireResponder);
  const recovery = new ProductOneToOneCopyRecoveryClient(client);
  const result = await recovery.recoverCopyAttempt({
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    mode: params.mode ?? "auto",
    requestToken: params.requestToken ?? REQUEST_TOKEN,
    runner: runnerInput,
    runnerDeps: { invoker: params.provider.invoker },
  });
  return { result, events };
}

describe("B2.1 — Plano 02: política pura (limites separados, esperas, classificação)", () => {
  it("limites: 3 automáticas + 3 manuais = teto 6 (independentes)", () => {
    expect(COPY_RECOVERY_AUTO_LIMIT).toBe(3);
    expect(COPY_RECOVERY_MANUAL_LIMIT).toBe(3);
    expect(COPY_RECOVERY_TOTAL_LIMIT).toBe(6);
  });

  it("esperas: 5s após a 1ª, 10s após a 2ª (FONTE ÚNICA); manuais/≥3ª sem espera", () => {
    expect(copyRecoveryWaitMs("auto", 1)).toBe(COPY_RECOVERY_WAITS_MS.after1);
    expect(copyRecoveryWaitMs("auto", 2)).toBe(COPY_RECOVERY_WAITS_MS.after2);
    expect(copyRecoveryWaitMs("auto", 3)).toBeNull();
    expect(copyRecoveryWaitMs("manual", 1)).toBeNull();
  });

  it("transitória avança para a próxima automática com a espera; 3ª esgotada ⇒ manual+suporte", () => {
    const d1 = classifyCopyRecoveryFailure({ retryable: true, attemptSeq: 1, kind: "auto" });
    expect(d1).toMatchObject({
      failureClass: "transient",
      action: "next_auto",
      nextAttemptSeq: 2,
      nextWaitMs: COPY_RECOVERY_WAITS_MS.after1,
    });
    const d2 = classifyCopyRecoveryFailure({ retryable: true, attemptSeq: 2, kind: "auto" });
    expect(d2).toMatchObject({ action: "next_auto", nextAttemptSeq: 3, nextWaitMs: COPY_RECOVERY_WAITS_MS.after2 });
    const d3 = classifyCopyRecoveryFailure({ retryable: true, attemptSeq: 3, kind: "auto" });
    expect(d3).toMatchObject({ action: "manual_with_support", nextWaitMs: null });
  });

  it("DEFINITIVA ⇒ saída antecipada (sem esperas/nova automática); MANUAL não reinicia o ciclo", () => {
    const definitive = classifyCopyRecoveryFailure({ retryable: false, attemptSeq: 1, kind: "auto" });
    expect(definitive).toMatchObject({ failureClass: "definitive", action: "definitive_exit", nextWaitMs: null, nextAttemptSeq: null });
    const manual = classifyCopyRecoveryFailure({ retryable: true, attemptSeq: 4, kind: "manual" });
    expect(manual).toMatchObject({ action: "manual_with_support", nextKind: null, nextWaitMs: null });
  });

  it("gatekeepers: recusam por entregue/ativa/espera/limites; clique manual independente", () => {
    const base = { copyDelivered: false, attemptActive: false, waitElapsed: true, autoAttempts: 0, manualAttempts: 0 };
    expect(nextCopyRecoveryAttempt(base)).toBeNull();
    expect(nextCopyRecoveryAttempt({ ...base, copyDelivered: true })).toBe("already_delivered");
    expect(nextCopyRecoveryAttempt({ ...base, attemptActive: true })).toBe("attempt_active");
    expect(nextCopyRecoveryAttempt({ ...base, waitElapsed: false })).toBe("wait_not_elapsed");
    expect(nextCopyRecoveryAttempt({ ...base, autoAttempts: 3 })).toBe("attempt_limit_reached");
    expect(nextCopyRecoveryAttempt({ ...base, autoAttempts: 3, manualAttempts: 3 })).toBe("attempt_limit_reached");
    expect(canRequestManualCopyRecovery(base)).toBe(true);
    expect(canRequestManualCopyRecovery({ ...base, manualAttempts: 3 })).toBe(false);
    expect(canRequestManualCopyRecovery({ ...base, autoAttempts: 3, manualAttempts: 3 })).toBe(false);
    expect(canRequestManualCopyRecovery({ ...base, copyDelivered: true })).toBe(false);
  });

  it("FONTE ÚNICA: a política importa/re-exporta COPY_RECOVERY_WAITS_MS de copy-state.ts (sem literais/sem ciclo)", () => {
    const policySource = readFileSync(
      path.resolve(process.cwd(), "src/lib/product-1-1/copy/copy-recovery-policy.ts"),
      "utf8",
    );
    expect(policySource).toMatch(/COPY_RECOVERY_WAITS_MS/);
    expect(policySource).toMatch(/from\s+["']\.\/copy-state["']/);
    expect(policySource).not.toMatch(/after1:\s*5_000/);
    expect(policySource).not.toMatch(/after2:\s*10_000/);
    // copy-state.ts é a FONTE ÚNICA e NÃO importa a política (sem ciclo).
    expect(copyStateSource).toMatch(/COPY_RECOVERY_WAITS_MS\s*=\s*Object\.freeze\(/);
    expect(copyStateSource).not.toMatch(/from\s+["'][^"']*copy-recovery-policy["']/);
  });
});

describe("B2.1 — Plano 03: UMA chamada por tentativa + fallback = TENTATIVA SEGUINTE", () => {
  it("cada tentativa adquirida dispara EXATAMENTE UMA chamada ao provider; fallback é a tentativa seguinte", async () => {
    const db = new CopyAttemptDb();
    const provider = makeCopyProviderSim();
    provider.setSequence([new NetworkError(), "ok"]);

    // 1ª tentativa (primária, transitória).
    const first = await runRecover({
      db,
      provider,
      acquireResponder: () => winner(1, TOKEN_A),
    });
    expect(first.result.outcome).toBe("acquired_failed");
    expect(provider.calls()).toBe(1);
    expect(provider.targets).toEqual(["primary"]);
    const row1 = db.rowsArray().find((r) => r.attempt_seq === 1);
    expect(row1?.state).toBe("failed");
    expect(recoveryFailureClass(row1)).toBe("transient");
    expect(recoveryWait(row1)).toBe(COPY_RECOVERY_WAITS_MS.after1);

    // 2ª tentativa (fallback) — NOVA aquisição/identidade, UMA chamada.
    const second = await runRecover({
      db,
      provider,
      acquireResponder: () => winner(2, TOKEN_B),
      requestToken: TOKEN_B,
    });
    expect(second.result.outcome).toBe("acquired_completed");
    expect(provider.calls()).toBe(2); // UMA por tentativa — sem fallback interno
    expect(provider.targets).toEqual(["primary", "fallback"]);
    expect(db.rowsArray().map((r) => r.attempt_seq).sort()).toEqual([1, 2]);
    expect(db.rowsArray().find((r) => r.attempt_seq === 2)?.state).toBe("completed");
  });

  it("tentativa inicial: VENCEDOR persiste identidade + recovery.kind auto; PERDEDOR ⇒ ZERO chamadas/estado", async () => {
    // VENCEDOR.
    const db = new CopyAttemptDb();
    const provider = makeCopyProviderSim();
    provider.setSequence([new NetworkError()]);
    const won = await runRecover({ db, provider, acquireResponder: () => winner(1, TOKEN_A) });
    expect(won.result.acquired).toBe(true);
    const row = db.rowsArray().find((r) => r.attempt_seq === 1);
    expect(row?.attempt_token).toBe(TOKEN_A);
    expect(recoveryKind(row)).toBe("auto");
    for (const ev of won.events) {
      if (ev.name === "product_1_1_apply_copy_state") {
        expect(ev.params.p_attempt_seq).toBe(1);
        expect(ev.params.p_attempt_token).toBe(TOKEN_A);
      }
    }

    // PERDEDOR — apenas acompanha.
    const db2 = new CopyAttemptDb();
    const provider2 = makeCopyProviderSim();
    const lost = await runRecover({
      db: db2,
      provider: provider2,
      acquireResponder: () => ({ acquired: false, reason: "attempt_in_progress" }),
    });
    expect(lost.result.acquired).toBe(false);
    expect(lost.result.reason).toBe("attempt_in_progress");
    expect(provider2.calls()).toBe(0);
    expect(db2.rowsArray()).toHaveLength(0);
    expect(lost.events.filter((e) => e.name === "product_1_1_apply_copy_state")).toHaveLength(0);
  });

  it("fechamento determinístico: falha ⇒ `failed` (sem pending órfão); conclusão atrasada ⇒ stale_attempt", async () => {
    const db = new CopyAttemptDb();
    const provider = makeCopyProviderSim();
    provider.setSequence([new NetworkError()]);
    await runRecover({ db, provider, acquireResponder: () => winner(1, TOKEN_A) });
    expect(db.rowsArray().every((r) => r.state !== "pending")).toBe(true);

    // Tentativa 2 concluída; a tentativa 1 (superada) tenta concluir depois.
    await runRecover({ db, provider: makeCopyProviderSim(), acquireResponder: () => winner(2, TOKEN_B), requestToken: TOKEN_B });
    const late = await recordCopyState(makeRecordingClient(db).client, {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      attemptSeq: 1,
      attemptToken: TOKEN_A,
      state: "completed",
      copyText: "tarde demais",
    });
    expect(late.outcome).toBe("stale_attempt");
    expect(db.rowsArray().find((r) => r.attempt_seq === 2)?.state).toBe("completed");
  });

  it("aquisição fail-closed: ausência de requestToken ⇒ missing_request_token; envelope vazio ⇒ erro (nunca vencedor)", async () => {
    const provider = makeCopyProviderSim();
    const { client } = makeRecordingClient(new CopyAttemptDb(), () => winner(1, TOKEN_A));
    const recovery = new ProductOneToOneCopyRecoveryClient(client);
    await expect(
      recovery.recoverCopyAttempt({
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        mode: "auto",
        requestToken: undefined,
        runner: runnerInput,
        runnerDeps: { invoker: provider.invoker },
      }),
    ).rejects.toMatchObject({ code: "missing_request_token" });
    expect(provider.calls()).toBe(0);

    const provider2 = makeCopyProviderSim();
    const { client: client2 } = makeRecordingClient(new CopyAttemptDb(), () => null);
    const recovery2 = new ProductOneToOneCopyRecoveryClient(client2);
    await expect(
      recovery2.recoverCopyAttempt({
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        mode: "auto",
        requestToken: REQUEST_TOKEN,
        runner: runnerInput,
        runnerDeps: { invoker: provider2.invoker },
      }),
    ).rejects.toBeInstanceOf(ProductOneToOneCopyRecoveryError);
    expect(provider2.calls()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (f) F56.2b2a — correção pós-revisão (2026-10-14): classificador do erro
//     NORMALIZADO do gateway (`AiInvocationError.retryable`) + alvo fallback
//     SÓ quando disponível (`hasFallback("campaign_copy")`).
// ---------------------------------------------------------------------------

/** Telemetria mínima com sink no-op (nunca toca Supabase/persistência real). */
function noopTelemetry(): AiTelemetryContext {
  return {
    operationRunId: "run-1",
    operationRunType: "campaign_delivery",
    traceId: "trace-1",
    storeId: STORE_ID,
    sink: { emit: () => {} },
  };
}

/**
 * Gateway REAL (`AiGateway`) com resolver FAKE + adapter FAKE — espelha os
 * fixtures de `src/lib/ai/__tests__/gateway.test.ts`. O caminho VIVO serviço →
 * runner → `CopyDirectorService` → gateway → adapter é exercitado, provando que
 * a falha NORMALIZADA é classificada server-side.
 */
function makeRealCopyGateway(invoke: AiAdapter["invoke"]): AiGateway {
  const config: AiModelConfig = {
    capability: "campaign_copy",
    segment: "text",
    primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
    fallback: { provider: "gemini", model: "gemini-3.1-flash-lite", protocol: "gemini" },
  };
  const resolver: AiModelResolver = {
    resolve: async () => config,
    listCapabilities: () => [config.capability],
  };
  const primary: AiAdapter = { protocol: "chat-completions", invoke };
  const registry: AiAdapterRegistry = {
    get: (protocol: AiProtocol) => (protocol === "chat-completions" ? primary : undefined),
  };
  return new AiGateway(resolver, registry);
}

describe("B2.1 — pós-revisão: classifyCopyFailure (erro normalizado do gateway × domínio)", () => {
  it("AiInvocationError normalizado: retryable:true ⇒ transient; retryable:false ⇒ definitive", () => {
    expect(
      classifyCopyFailure(new AiInvocationError({ kind: "network", retryable: true, message: "x" })),
    ).toBe("transient");
    expect(
      classifyCopyFailure(new AiInvocationError({ kind: "timeout", retryable: true, message: "x" })),
    ).toBe("transient");
    expect(
      classifyCopyFailure(
        new AiInvocationError({ kind: "content_filter", retryable: false, message: "x" }),
      ),
    ).toBe("definitive");
    // Sem fallback configurado o gateway lança ANTES do provider (capability,
    // retryable:false) ⇒ definitivo (não consome o ciclo automático).
    expect(
      classifyCopyFailure(
        new AiInvocationError({ kind: "capability", retryable: false, message: "x" }),
      ),
    ).toBe("definitive");
  });

  it("fallback de DOMÍNIO preservado: NetworkError/ProviderRateLimitError ⇒ transient; Error genérico ⇒ definitive", () => {
    expect(classifyCopyFailure(new NetworkError())).toBe("transient");
    expect(classifyCopyFailure(new ProviderRateLimitError())).toBe("transient");
    expect(classifyCopyFailure(new Error("sem retryable"))).toBe("definitive");
    // Um `retryable` NÃO-boolean não sequestra a decisão (duck-type estrito).
    expect(classifyCopyFailure({ retryable: "yes" })).toBe("definitive");
  });
});

describe("B2.1 — pós-revisão: gateway REAL (adapter que lança) classifica via classificador", () => {
  async function driveGateway(db: CopyAttemptDb, gateway: AiGateway): Promise<void> {
    const { client } = makeRecordingClient(db, () => winner(1, TOKEN_A));
    const recovery = new ProductOneToOneCopyRecoveryClient(client);
    await recovery.recoverCopyAttempt({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      mode: "auto",
      requestToken: REQUEST_TOKEN,
      runner: runnerInput,
      runnerDeps: { invoker: gateway, createTelemetry: noopTelemetry },
    });
  }

  it("AiInvocationError retryable:true do gateway real ⇒ copy_payload.recovery.failureClass = transient", async () => {
    const db = new CopyAttemptDb();
    const gateway = makeRealCopyGateway(async () => {
      throw new AiInvocationError({ kind: "network", retryable: true, message: "transiente" });
    });
    await driveGateway(db, gateway);
    const row = db.rowsArray().find((r) => r.attempt_seq === 1);
    expect(row?.state).toBe("failed");
    expect(recoveryFailureClass(row)).toBe("transient");
    expect(recoveryWait(row)).toBe(COPY_RECOVERY_WAITS_MS.after1);
  });

  it("AiInvocationError retryable:false do gateway real ⇒ copy_payload.recovery.failureClass = definitive", async () => {
    const db = new CopyAttemptDb();
    const gateway = makeRealCopyGateway(async () => {
      throw new AiInvocationError({
        kind: "content_filter",
        retryable: false,
        message: "definitiva",
      });
    });
    await driveGateway(db, gateway);
    const row = db.rowsArray().find((r) => r.attempt_seq === 1);
    expect(row?.state).toBe("failed");
    expect(recoveryFailureClass(row)).toBe("definitive");
    expect(recoveryWait(row)).toBeNull();
  });
});

describe("B2.1 — pós-revisão: alvo fallback SÓ quando disponível (hasFallback campaign_copy)", () => {
  function seedTransientPrevious(db: CopyAttemptDb): void {
    db.seed({
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      attempt_seq: 1,
      attempt_token: TOKEN_A,
      state: "failed",
      copy_text: null,
      copy_payload: {
        recovery: {
          kind: "auto",
          failureClass: "transient",
          nextWaitMs: COPY_RECOVERY_WAITS_MS.after1,
        },
      },
      lease_at: null,
      request_token: null,
      updated_at: iso(NOW),
      created_at: iso(NOW),
    });
  }

  it("anterior TRANSIENT + hasFallback:true ⇒ alvo fallback (UMA chamada)", async () => {
    const db = new CopyAttemptDb();
    seedTransientPrevious(db);
    const provider = makeCopyProviderSim(true);
    const res = await runRecover({
      db,
      provider,
      acquireResponder: () => winner(2, TOKEN_B),
      requestToken: TOKEN_B,
    });
    expect(res.result.acquired).toBe(true);
    expect(provider.targets).toEqual(["fallback"]);
    expect(provider.calls()).toBe(1);
  });

  it("anterior TRANSIENT + hasFallback:false ⇒ REPETE no primary (UMA chamada; sem tentativa desperdiçada)", async () => {
    const db = new CopyAttemptDb();
    seedTransientPrevious(db);
    const provider = makeCopyProviderSim(false);
    const res = await runRecover({
      db,
      provider,
      acquireResponder: () => winner(2, TOKEN_B),
      requestToken: TOKEN_B,
    });
    expect(res.result.acquired).toBe(true);
    // Sem fallback o gateway REJEITARIA antes do provider: o resolver cai no
    // primary e AINDA invoca o provider (uma tentativa útil).
    expect(provider.targets).toEqual(["primary"]);
    expect(provider.calls()).toBe(1);
    expect(db.rowsArray().find((r) => r.attempt_seq === 2)?.state).toBe("completed");
  });

  it("anterior NÃO-transient ⇒ primary independentemente da disponibilidade (UMA chamada)", async () => {
    for (const hasFallback of [true, false] as const) {
      const db = new CopyAttemptDb();
      db.seed({
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        attempt_seq: 1,
        attempt_token: TOKEN_A,
        state: "failed",
        copy_text: null,
        copy_payload: { recovery: { kind: "auto", failureClass: "definitive", nextWaitMs: null } },
        lease_at: null,
        request_token: null,
        updated_at: iso(NOW),
        created_at: iso(NOW),
      });
      const provider = makeCopyProviderSim(hasFallback);
      await runRecover({
        db,
        provider,
        acquireResponder: () => winner(2, TOKEN_B),
        requestToken: TOKEN_B,
      });
      expect(provider.targets).toEqual(["primary"]);
      expect(provider.calls()).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// (g) F56.2b2a — B2.1 / Plano 03: CONTRATO DA ROTA AUTENTICADA
//     (`src/app/api/campaign/[id]/copy-recovery/route.ts`).
//     Dublês controlados de auth/ownership/getCampaign/não-ativação + provider
//     SIMULADO com contador; a lógica da recuperação permanece REAL. Nenhuma
//     chamada paga, nenhum crédito/artefato, nenhuma migration aplicada.
// ---------------------------------------------------------------------------

const ROUTE_FILE = "src/app/api/campaign/[id]/copy-recovery/route.ts";
const ROUTE_REQUEST_TOKEN = "5e8d2b1a-0c4f-4a1b-9c3f-3b0f6c1a7d2e";
const DIVERGENT_OPERATION_ID = "99999999-9999-4999-8999-999999999999";

const validRouteBody = () => ({
  operationId: OPERATION_ID,
  mode: "auto_retry" as const,
  attemptSeq: 1,
  attemptToken: TOKEN_A,
  requestToken: ROUTE_REQUEST_TOKEN,
});

function newFlowCampaign() {
  return {
    id: CAMPAIGN_ID,
    store_id: STORE_ID,
    product_name: "Produto Teste",
    input_snapshot: {
      frozenContentReferences: [],
      product: { name: "Produto Teste" },
      commercial: { intent: "offer", discountedPriceCents: 1990 },
    },
  };
}

function persistedOperation() {
  return {
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    status: "delivered",
    terminal: true,
    unknown: false,
  };
}

function resetRouteHarness(): void {
  const s = routeHarness.state;
  s.rows = [];
  s.acquireResponder = null;
  s.providerCalls = 0;
  s.providerSequence = [];
  s.providerIndex = 0;
  s.authUser = { userId: "user-1" };
  s.authError = null;
  s.ownershipError = null;
  s.campaign = newFlowCampaign();
  s.flow = "new_flow";
  s.authDecision = { allowed: true };
  s.authThrows = false;
  s.operation = persistedOperation();
  s.sameOriginThrows = false;
  s.creditOrArtifactCalls = 0;
}

function postRequest(id: string, body: unknown): NextRequest {
  return new NextRequest(
    new Request(`http://localhost/api/campaign/${id}/copy-recovery`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function getRequest(id: string): NextRequest {
  return new NextRequest(
    new Request(`http://localhost/api/campaign/${id}/copy-recovery`, { method: "GET" }),
  );
}

async function importRoute() {
  return import("@/app/api/campaign/[id]/copy-recovery/route");
}

async function callPost(id: string, body: unknown) {
  const { POST } = await importRoute();
  return POST(postRequest(id, body), { params: Promise.resolve({ id }) });
}

async function callGet(id: string) {
  const { GET } = await importRoute();
  return GET(getRequest(id), { params: Promise.resolve({ id }) });
}

describe("B2.1 — Plano 03: rota copy-recovery — auth/ownership SEM IA", () => {
  beforeEach(() => resetRouteHarness());

  it("SEM autenticação ⇒ negada (401) ANTES de qualquer IA", async () => {
    routeHarness.state.authError = new UnauthorizedError();
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(res.status).toBe(401);
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("SEM ownership ⇒ negada (403) e contador do provider == 0 (nenhuma chamada de IA)", async () => {
    routeHarness.state.ownershipError = new ForbiddenError();
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(res.status).toBe(403);
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("`id` não-UUID ⇒ 404; campanha ausente ⇒ 404 (sem IA)", async () => {
    const bad = await callPost("not-a-uuid", validRouteBody());
    expect(bad.status).toBe(404);
    routeHarness.state.campaign = null;
    const missing = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(missing.status).toBe(404);
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("CSRF: mesma origem exigida no POST (nega antes da IA)", async () => {
    routeHarness.state.sameOriginThrows = true;
    await expect(callPost(CAMPAIGN_ID, validRouteBody())).rejects.toThrow("cross_origin");
    expect(routeHarness.state.providerCalls).toBe(0);
  });
});

describe("B2.1 — Plano 03: rota copy-recovery — barreira de não-ativação/identidade", () => {
  beforeEach(() => resetRouteHarness());

  it("fluxo `legacy` ⇒ negado (403) SEM IA", async () => {
    routeHarness.state.flow = "legacy";
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(res.status).toBe(403);
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("fluxo `indeterminate` ⇒ negado (fail-closed) SEM IA", async () => {
    routeHarness.state.flow = "indeterminate";
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(res.status).toBe(409);
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("autorização `off`/`read_failure` ⇒ negado SEM IA (contador == 0)", async () => {
    routeHarness.state.authDecision = { allowed: false, code: "flag_not_applicable_off" };
    const off = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(off.status).toBe(403);

    resetRouteHarness();
    routeHarness.state.authThrows = true; // resolveProductFlowAuthorization lança (read_failure)
    const thrown = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(thrown.status).toBe(403);
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("`operationId` divergente da operação persistida ⇒ 409 SEM IA", async () => {
    const res = await callPost(CAMPAIGN_ID, {
      ...validRouteBody(),
      operationId: DIVERGENT_OPERATION_ID,
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("operation_identity_conflict");
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("operação persistida ausente ⇒ 409 (identidade não comprovada) SEM IA", async () => {
    routeHarness.state.operation = null;
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(res.status).toBe(409);
    expect(routeHarness.state.providerCalls).toBe(0);
  });
});

describe("B2.1 — Plano 03: rota copy-recovery — corpo inválido (.strict()) sem IA", () => {
  beforeEach(() => resetRouteHarness());

  it("campo desconhecido / mode inválido / attemptSeq fora de 1..6 / attemptToken vazio / requestToken ausente ⇒ 400 + fieldErrors e contador 0", async () => {
    const invalidBodies: unknown[] = [
      { ...validRouteBody(), extra: "nope" },
      { ...validRouteBody(), mode: "auto" },
      { ...validRouteBody(), attemptSeq: 0 },
      { ...validRouteBody(), attemptSeq: 7 },
      { ...validRouteBody(), attemptToken: "" },
      (() => {
        const { requestToken: _omit, ...without } = validRouteBody();
        void _omit;
        return without;
      })(),
    ];

    for (const body of invalidBodies) {
      const res = await callPost(CAMPAIGN_ID, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      const payload = (await res.json()) as {
        error?: { details?: Record<string, unknown> };
      };
      expect(payload.error?.details).toBeTruthy();
    }
    expect(routeHarness.state.providerCalls).toBe(0);
  });
});

describe("B2.1 — Plano 03: rota copy-recovery — GET query-only", () => {
  beforeEach(() => resetRouteHarness());

  it("devolve o estado persistido (sem linhas ⇒ estado vazio) e NÃO incrementa o provider", async () => {
    const res = await callGet(CAMPAIGN_ID);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      recovery: { attemptSeq: number; state: string | null };
    };
    expect(body.recovery.attemptSeq).toBe(0);
    expect(body.recovery.state).toBeNull();
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("tentativa `completed` persistida ⇒ GET devolve `completed` VERBATIM (nenhuma tentativa iniciada)", async () => {
    routeHarness.state.rows = [
      {
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        attempt_seq: 1,
        attempt_token: TOKEN_A,
        state: "completed",
        copy_text: "Legenda final",
        copy_payload: { caption: "Legenda final" },
        lease_at: null,
        request_token: null,
        updated_at: routeHarness.iso(routeHarness.NOW),
        created_at: routeHarness.iso(routeHarness.NOW),
      },
    ];
    const res = await callGet(CAMPAIGN_ID);
    const body = (await res.json()) as {
      recovery: { state: string | null; copyDelivery: { copyText: string } | null };
    };
    expect(body.recovery.state).toBe("completed");
    expect(body.recovery.copyDelivery?.copyText).toBe("Legenda final");
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("`pending` com lease VIGENTE ⇒ `attemptActive` true (ATIVA) — nunca inicia tentativa", async () => {
    const freshLease = new Date(Date.now() - 1000).toISOString();
    routeHarness.state.rows = [
      {
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        attempt_seq: 1,
        attempt_token: TOKEN_A,
        state: "pending",
        copy_text: null,
        copy_payload: null,
        lease_at: freshLease,
        request_token: null,
        updated_at: freshLease,
        created_at: freshLease,
      },
    ];
    const res = await callGet(CAMPAIGN_ID);
    const body = (await res.json()) as { recovery: { attemptActive: boolean } };
    expect(body.recovery.attemptActive).toBe(true);
    expect(routeHarness.state.providerCalls).toBe(0);
  });
});

describe("B2.1 — Plano 03: rota copy-recovery — POST UMA tentativa (anti-duplicação)", () => {
  beforeEach(() => resetRouteHarness());

  it("VENCEDOR: executa EXATAMENTE UMA tentativa (contador == 1) e devolve o estado resultante", async () => {
    routeHarness.state.acquireResponder = () => ({
      acquired: true,
      reason: null,
      attempt_seq: 1,
      attempt_token: TOKEN_A,
      mode: "auto",
    });
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      recovery: { outcome: string; acquired: boolean; state: { state: string | null } };
    };
    expect(body.recovery.acquired).toBe(true);
    expect(body.recovery.outcome).toBe("acquired_completed");
    expect(body.recovery.state.state).toBe("completed");
    expect(routeHarness.state.providerCalls).toBe(1);
  });

  it("tentativa JÁ ativa ⇒ ACOMPANHAMENTO e contador == 1 (nenhuma segunda chamada)", async () => {
    // Primeira tentativa falha TRANSITÓRIA ⇒ estado `failed` (não terminal para a entrega).
    routeHarness.state.acquireResponder = () => ({
      acquired: true,
      reason: null,
      attempt_seq: 1,
      attempt_token: TOKEN_A,
      mode: "auto",
    });
    routeHarness.state.providerSequence = [new NetworkError()];
    const first = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(first.status).toBe(200);
    expect(routeHarness.state.providerCalls).toBe(1);

    // Segunda chamada: a tentativa está ATIVA ⇒ perdedora apenas acompanha.
    routeHarness.state.acquireResponder = () => ({
      acquired: false,
      reason: "attempt_in_progress",
    });
    const second = await callPost(CAMPAIGN_ID, validRouteBody());
    const body = (await second.json()) as {
      recovery: { outcome: string; acquired: boolean; reason: string | null };
    };
    expect(body.recovery.outcome).toBe("accompanied");
    expect(body.recovery.acquired).toBe(false);
    expect(body.recovery.reason).toBe("attempt_in_progress");
    expect(routeHarness.state.providerCalls).toBe(1);
  });

  it("`wait_not_elapsed` ⇒ ACOMPANHAMENTO com waitRemainingMs e contador inalterado (0)", async () => {
    routeHarness.state.acquireResponder = () => ({
      acquired: false,
      reason: "wait_not_elapsed",
      wait_remaining_ms: 4200,
    });
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    const body = (await res.json()) as {
      recovery: { outcome: string; waitRemainingMs: number | null };
    };
    expect(body.recovery.outcome).toBe("accompanied");
    expect(body.recovery.waitRemainingMs).toBe(4200);
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("MESMO `requestToken` reenviado ⇒ `already_acquired` (identidade existente, sem nova chamada)", async () => {
    routeHarness.state.acquireResponder = () => ({
      acquired: false,
      reason: "already_acquired",
      attempt_seq: 2,
      attempt_token: TOKEN_B,
    });
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    const body = (await res.json()) as {
      recovery: { outcome: string; reason: string | null; attemptSeq: number | null };
    };
    expect(body.recovery.outcome).toBe("accompanied");
    expect(body.recovery.reason).toBe("already_acquired");
    expect(body.recovery.attemptSeq).toBe(2);
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("`auto_retry` após fechamento automático ⇒ `automatic_closed` (sem nova chamada)", async () => {
    routeHarness.state.acquireResponder = () => ({
      acquired: false,
      reason: "automatic_closed",
    });
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    const body = (await res.json()) as {
      recovery: { outcome: string; reason: string | null };
    };
    expect(body.recovery.outcome).toBe("accompanied");
    expect(body.recovery.reason).toBe("automatic_closed");
    expect(routeHarness.state.providerCalls).toBe(0);
  });

  it("copy `completed` com conteúdo ⇒ RECUSADA (encerrada), sem iniciar tentativa", async () => {
    routeHarness.state.rows = [
      {
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        attempt_seq: 1,
        attempt_token: TOKEN_A,
        state: "completed",
        copy_text: "Já entregue",
        copy_payload: { caption: "Já entregue" },
        lease_at: null,
        request_token: null,
        updated_at: routeHarness.iso(routeHarness.NOW),
        created_at: routeHarness.iso(routeHarness.NOW),
      },
    ];
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    const body = (await res.json()) as {
      recovery: { outcome: string; acquired: boolean; reason: string | null };
    };
    expect(body.recovery.acquired).toBe(false);
    expect(body.recovery.outcome).toBe("accompanied");
    expect(body.recovery.reason).toBe("attempt_already_completed");
    expect(routeHarness.state.providerCalls).toBe(0);
  });
});

describe("B2.1 — Plano 03: rota copy-recovery — escopo SOMENTE-textos (sem crédito/artefato)", () => {
  beforeEach(() => resetRouteHarness());

  it("nenhuma função de crédito/artefato é chamada durante uma tentativa bem-sucedida", async () => {
    routeHarness.state.acquireResponder = () => ({
      acquired: true,
      reason: null,
      attempt_seq: 1,
      attempt_token: TOKEN_A,
      mode: "auto",
    });
    const res = await callPost(CAMPAIGN_ID, validRouteBody());
    expect(res.status).toBe(200);
    expect(routeHarness.state.creditOrArtifactCalls).toBe(0);
  });

  it("a rota NÃO importa/chama crédito nem artefacto (operação financeira intocada)", () => {
    const source = readFileSync(path.resolve(process.cwd(), ROUTE_FILE), "utf8");
    expect(source).not.toMatch(/credit-operation|credit-service|artifact\//);
    expect(source).not.toMatch(/\.reserve\(|\.deliver\(|\.refund\(|reserveCredit/);
    // Somente textos: usa o serviço de recuperação (campaign_copy).
    expect(source).toContain("recoverCopyAttempt");
    expect(source).toContain("readCopyRecoveryState");
  });
});
