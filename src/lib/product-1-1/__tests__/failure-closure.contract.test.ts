// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

// ---------------------------------------------------------------------------
// F56.2b2b — Plano 01 (B2B-D3/D6 / REQ-56.2.4-05, REQ-56.2.4-06).
// Contract test ESTÁTICO (SQL da migration, SEM comentários) + SIMULADO (store
// fiel ao predicado PF e ao CAS de estorno). Sem banco, sem provider, sem
// crédito: a migration é apenas AUTORADA (LOCAL-ONLY; aplicação só no Plano 06).
//
// Este arquivo é referenciado pela Camada 1 (Plano 03) e pela Camada 2
// (Plano 06) — manter a estrutura e os helpers reutilizáveis.
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261015000001_f56_2b2b_failure_closure.sql";
const migrationSql = readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), "utf8");

// SQL ATIVO (sem linhas de comentário) — o cabeçalho/REVERT são comentados e
// NUNCA devem sustentar uma asserção de código.
const activeSql = migrationSql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

const countOccurrences = (needle: string): number => activeSql.split(needle).length - 1;

// ---------------------------------------------------------------------------
// (a) Asserções ESTÁTICAS do SQL (SEM comentários)
// ---------------------------------------------------------------------------

describe("F56.2b2b — migration 20261015000001 failure_closure (contrato estático, SEM comentários)", () => {
  it("é LOCAL-ONLY, com aviso de aplicação e bloco REVERT, sem comando mutável remoto", () => {
    // Nenhuma linha ATIVA executa `db push` (o aviso do cabeçalho é comentado e
    // quebrado entre linhas — não conta como código).
    expect(activeSql.split(/\r?\n/).filter((l) => /db push/i.test(l))).toEqual([]);
    expect(migrationSql).toMatch(/LOCAL-ONLY/);
    expect(migrationSql).toMatch(/migration up --local/);
    expect(migrationSql).toMatch(/Autorar aqui ≠ aplicar/);
    expect(migrationSql).toMatch(/REVERT/);
  });

  it("cria a RPC `product_1_1_close_failed_operation` com SECURITY DEFINER e `search_path = ''`", () => {
    expect(activeSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.product_1_1_close_failed_operation\(/,
    );
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
  });

  it("toma a trava C4 (`FOR UPDATE` na linha de crédito) ANTES do CAS e das verificações", () => {
    expect(activeSql).toMatch(
      /FROM public\.product_1_1_campaign_credit_operations[\s\S]*?FOR UPDATE/,
    );
    const lockIdx = activeSql.indexOf("FOR UPDATE");
    const casIdx = activeSql.indexOf("v_credit.status = 'refunded'");
    const terminalIdx = activeSql.indexOf("operation_terminal");
    expect(lockIdx).toBeGreaterThan(-1);
    expect(casIdx).toBeGreaterThan(lockIdx);
    expect(terminalIdx).toBeGreaterThan(casIdx);
  });

  it("C3/D6 — CAS de estorno ANTES do predicado PF: `refunded` idempotente; `delivered` nunca estornado", () => {
    const casIdx = activeSql.indexOf("v_credit.status = 'refunded'");
    const deliveredIdx = activeSql.indexOf("delivered_not_refundable");
    // `delivered_not_refundable` precede o item (1) do PF (`operation_terminal`).
    const terminalIdx = activeSql.indexOf("operation_terminal");
    expect(casIdx).toBeGreaterThan(-1);
    expect(deliveredIdx).toBeGreaterThan(casIdx);
    expect(terminalIdx).toBeGreaterThan(deliveredIdx);
  });

  it("PF (4a) — exige TODOS: não terminal + `absent` + nenhum `in_progress` + marcador `failed`", () => {
    // (1) não terminal
    expect(activeSql).toMatch(/v_credit\.status NOT IN \('reserved','art_uploaded'\)/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'operation_terminal'/);
    // (2) `absent` confirmada (nunca invalid/indeterminate/erro)
    expect(activeSql).toMatch(/p_art_kind IS DISTINCT FROM 'absent'/);
    expect(activeSql).toMatch(/RAISE EXCEPTION 'absent_not_confirmed'/);
    // (3) nenhum claim `in_progress`
    expect(activeSql).toMatch(
      /FROM public\.product_1_1_generation_attempt_claims[\s\S]*?status = 'in_progress'/,
    );
    expect(activeSql).toMatch(/RAISE EXCEPTION 'operation_in_progress'/);
    // (4) marcador `outcome='failed'` JÁ gravado
    expect(activeSql).toMatch(
      /FROM public\.product_1_1_generation_outcomes[\s\S]*?outcome = 'failed'/,
    );
    expect(activeSql).toMatch(/RAISE EXCEPTION 'finality_not_recorded'/);
  });

  it("NÃO grava nem sobrescreve o marcador — apenas EXIGE `outcome='failed'` existente", () => {
    expect(activeSql).not.toMatch(/INSERT INTO public\.product_1_1_generation_outcomes/);
    expect(activeSql).not.toMatch(/UPDATE public\.product_1_1_generation_outcomes/);
    expect(activeSql).toMatch(/FROM public\.product_1_1_generation_outcomes/);
  });

  it("o caminho AUTOMÁTICO NUNCA abandona claim (abandono é exclusivo do caminho autorizado)", () => {
    expect(activeSql).not.toMatch(/abandoned/);
    expect(activeSql).not.toMatch(/UPDATE public\.product_1_1_generation_attempt_claims/);
  });

  it("o estorno é aplicado UMA vez, DEPOIS do predicado PF completo, sob a trava", () => {
    const finalityIdx = activeSql.indexOf("finality_not_recorded");
    const refundIdx = activeSql.indexOf(
      "PERFORM public.product_1_1_refund_campaign_credit_operation",
    );
    expect(finalityIdx).toBeGreaterThan(-1);
    expect(refundIdx).toBeGreaterThan(finalityIdx);
    // Nenhum COMMIT intermediário: tudo na MESMA transação sob a trava.
    expect(activeSql).not.toMatch(/\bCOMMIT\b/);
  });

  it("C3 — envelope ÚNICO COM IDENTIDADE nos DOIS caminhos (idempotente e estorno aplicado)", () => {
    // As chaves de identidade aparecem em AMBOS os `RETURN jsonb_build_object`.
    expect(countOccurrences("'campaign_id'")).toBeGreaterThanOrEqual(2);
    expect(countOccurrences("'operation_id'")).toBeGreaterThanOrEqual(2);
    expect(countOccurrences("'action'")).toBeGreaterThanOrEqual(2);
    expect(countOccurrences("'close_failed_operation'")).toBeGreaterThanOrEqual(2);
    // Ambos os caminhos declaram `idempotent`.
    expect(activeSql).toMatch(/'idempotent', true/);
    expect(activeSql).toMatch(/'idempotent', false/);
  });

  it("privilégios RPC-only (A2): REVOKE de PUBLIC/anon/authenticated + GRANT EXECUTE a service_role", () => {
    expect(activeSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.product_1_1_close_failed_operation\([^)]*\) FROM PUBLIC, anon, authenticated/,
    );
    expect(activeSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.product_1_1_close_failed_operation\([^)]*\) TO service_role/,
    );
  });

  it("ausência de (4b): recusas isoladas NÃO são gatilho", () => {
    expect(activeSql).not.toMatch(/primary_after_fallback/);
    expect(activeSql).not.toMatch(/attempt_already_completed/);
    expect(activeSql).not.toMatch(/attempt_limit_reached/);
    expect(activeSql).not.toMatch(/attempt_number/);
  });
});

// ---------------------------------------------------------------------------
// (b) Simulador FIEL do predicado PF + CAS de estorno (espelha a migration)
// ---------------------------------------------------------------------------

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";

type CreditStatus = "reserved" | "art_uploaded" | "delivered" | "refunded" | (string & {});

interface SimStore {
  credit: { status: CreditStatus } | null;
  claims: Array<{ status: string }>;
  outcomes: Array<{ outcome: string }>;
  refundEffects: number;
}

function makeStore(overrides: Partial<SimStore> = {}): SimStore {
  return {
    credit: { status: "reserved" },
    claims: [],
    outcomes: [{ outcome: "failed" }],
    refundEffects: 0,
    ...overrides,
  };
}

class CloseFailedOperationError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "CloseFailedOperationError";
    this.code = code;
  }
}

/**
 * Espelha `product_1_1_close_failed_operation`: trava → CAS (refunded/delivered)
 * → predicado PF (não terminal, absent, sem in_progress, marcador failed) →
 * estorno UMA vez. Devolve o envelope COM IDENTIDADE.
 */
function closeFailedOperation(
  store: SimStore,
  input: { artKind: string; reason?: string },
): Record<string, unknown> {
  if (!store.credit) throw new CloseFailedOperationError("operation_not_found");

  const status = store.credit.status;

  // CAS de estorno idempotente PRIMEIRO (após a trava, antes do PF).
  if (status === "refunded") {
    return {
      success: true,
      idempotent: true,
      status: "refunded",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      action: "close_failed_operation",
    };
  }
  if (status === "delivered") throw new CloseFailedOperationError("delivered_not_refundable");

  // Predicado PF (regra única 4a).
  if (status !== "reserved" && status !== "art_uploaded") {
    throw new CloseFailedOperationError("operation_terminal");
  }
  if (input.artKind !== "absent") throw new CloseFailedOperationError("absent_not_confirmed");
  if (store.claims.some((c) => c.status === "in_progress")) {
    throw new CloseFailedOperationError("operation_in_progress");
  }
  if (!store.outcomes.some((o) => o.outcome === "failed")) {
    throw new CloseFailedOperationError("finality_not_recorded");
  }

  // PF COMPLETO — devolução UMA única vez + transição para terminal.
  store.refundEffects += 1;
  store.credit = { status: "refunded" };
  return {
    success: true,
    idempotent: false,
    status: "refunded",
    campaign_id: CAMPAIGN_ID,
    operation_id: OPERATION_ID,
    action: "close_failed_operation",
  };
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CloseFailedOperationError);
    expect((error as CloseFailedOperationError).code).toBe(code);
    return;
  }
  throw new Error(`esperava lançar ${code}`);
}

/** Prova o envelope ÚNICO COM IDENTIDADE (C3). */
function expectIdentityEnvelope(result: Record<string, unknown>): void {
  expect(result).toMatchObject({
    success: true,
    status: "refunded",
    campaign_id: CAMPAIGN_ID,
    operation_id: OPERATION_ID,
    action: "close_failed_operation",
  });
  expect(typeof result.idempotent).toBe("boolean");
}

describe("F56.2b2b — predicado PF e estorno idempotente (simulado, espelha a migration)", () => {
  it("PF satisfeito ⇒ encerra e estorna UMA vez (`idempotent:false`), envelope COM IDENTIDADE", () => {
    const store = makeStore();
    const result = closeFailedOperation(store, { artKind: "absent", reason: "falha final" });
    expectIdentityEnvelope(result);
    expect(result.idempotent).toBe(false);
    expect(store.refundEffects).toBe(1);
    expect(store.credit?.status).toBe("refunded");
  });

  it("2ª chamada para a MESMA operação ⇒ `idempotent:true`, SEM segundo efeito de ledger", () => {
    const store = makeStore();
    const first = closeFailedOperation(store, { artKind: "absent", reason: "r1" });
    const second = closeFailedOperation(store, { artKind: "absent", reason: "r2" });
    expect(first.idempotent).toBe(false);
    expectIdentityEnvelope(second);
    expect(second.idempotent).toBe(true);
    // Nenhuma reabertura e nenhuma devolução duplicada.
    expect(store.refundEffects).toBe(1);
    expect(store.credit?.status).toBe("refunded");
  });

  it("`delivered` ⇒ `delivered_not_refundable` (nenhum estorno)", () => {
    const store = makeStore({ credit: { status: "delivered" } });
    expectCode(() => closeFailedOperation(store, { artKind: "absent" }), "delivered_not_refundable");
    expect(store.refundEffects).toBe(0);
    expect(store.credit?.status).toBe("delivered");
  });

  it("`refunded` ⇒ `idempotent:true` (nenhuma reabertura) mesmo com o PF indisponível", () => {
    // CAS roda ANTES do predicado PF: o estado `refunded` curto-circuita o PF.
    const store = makeStore({
      credit: { status: "refunded" },
      claims: [{ status: "in_progress" }],
      outcomes: [],
    });
    const result = closeFailedOperation(store, { artKind: "indeterminate" });
    expect(result.idempotent).toBe(true);
    expect(store.refundEffects).toBe(0);
  });

  it("estado não-terminal inválido/desconhecido ⇒ `operation_terminal` (ramo defensivo)", () => {
    const store = makeStore({ credit: { status: "weird_state" } });
    expectCode(() => closeFailedOperation(store, { artKind: "absent" }), "operation_terminal");
    expect(store.refundEffects).toBe(0);
  });

  it("`invalid`/`indeterminate`/erro de sonda NÃO são `absent` ⇒ `absent_not_confirmed`", () => {
    for (const artKind of ["invalid", "indeterminate", "error", ""]) {
      const store = makeStore();
      expectCode(
        () => closeFailedOperation(store, { artKind, reason: "sonda" }),
        "absent_not_confirmed",
      );
      expect(store.refundEffects).toBe(0);
      expect(store.credit?.status).toBe("reserved");
    }
  });

  it("claim `in_progress` presente ⇒ `operation_in_progress` (o automático NUNCA abandona claim)", () => {
    const store = makeStore({ claims: [{ status: "in_progress" }] });
    expectCode(
      () => closeFailedOperation(store, { artKind: "absent", reason: "r" }),
      "operation_in_progress",
    );
    // Nenhum estorno E o claim permanece intocado (nunca `abandoned`).
    expect(store.refundEffects).toBe(0);
    expect(store.claims).toEqual([{ status: "in_progress" }]);
    expect(store.credit?.status).toBe("reserved");
  });

  it("marcador `outcome='failed'` ausente ⇒ `finality_not_recorded` (PF não forçado)", () => {
    const store = makeStore({ outcomes: [] });
    expectCode(
      () => closeFailedOperation(store, { artKind: "absent", reason: "r" }),
      "finality_not_recorded",
    );
    expect(store.refundEffects).toBe(0);
    expect(store.credit?.status).toBe("reserved");
  });

  it("marcador `unknown` (imutável) NÃO é `failed` ⇒ `finality_not_recorded`", () => {
    const store = makeStore({ outcomes: [{ outcome: "unknown" }] });
    expectCode(
      () => closeFailedOperation(store, { artKind: "absent", reason: "r" }),
      "finality_not_recorded",
    );
    expect(store.refundEffects).toBe(0);
  });

  it("NENHUMA via (4b): recusa isolada SEM marcador `failed` NÃO fecha a operação", () => {
    for (const reason of [
      "primary_after_fallback",
      "attempt_already_completed",
      "attempt_limit_reached",
      "attempt_number_max",
    ]) {
      const store = makeStore({ outcomes: [] });
      expectCode(
        () => closeFailedOperation(store, { artKind: "absent", reason }),
        "finality_not_recorded",
      );
      expect(store.refundEffects).toBe(0);
    }
  });

  it("operação ausente ⇒ `operation_not_found` (nunca sucesso vazio)", () => {
    const store = makeStore({ credit: null });
    expectCode(() => closeFailedOperation(store, { artKind: "absent" }), "operation_not_found");
  });

  it("corrida entrega × estorno: com `delivered` persistido, o estorno é recusado (no máximo um efeito)", () => {
    const store = makeStore();
    // A entrega venceu a corrida antes do fechamento.
    store.credit = { status: "delivered" };
    expectCode(() => closeFailedOperation(store, { artKind: "absent" }), "delivered_not_refundable");
    expect(store.refundEffects).toBe(0);
  });
});
