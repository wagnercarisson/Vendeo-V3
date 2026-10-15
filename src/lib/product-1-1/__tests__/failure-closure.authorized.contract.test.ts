// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolvePendingOperation,
  type PendingResolutionAction,
} from "../pending/resolve-pending-operation";
import type {
  PendingOperationState,
  PendingOperationsRepository,
} from "../pending/pending-operations-repository";
import type { ArtifactProbe } from "../artifact/types";

// ---------------------------------------------------------------------------
// F56.2b2b — Plano 04 / Task 3: contrato do ENCERRAMENTO AUTORIZADO e auditado
// (B2B-D4). Asserções ESTÁTICAS do SQL (`20261015000002`) + comportamento com
// store/RPC SIMULADOS (sem banco/provider). Camada 1 ≠ Camada 2.
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261015000002_f56_2b2b_pending_abandon.sql";
const migrationSql = readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE), "utf8");
const activeSql = migrationSql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const STORE_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "44444444-4444-4444-8444-444444444444";
const RESOLUTION_ID = "55555555-5555-4555-8555-555555555555";

const INTEGRAL_PROBE: ArtifactProbe = Object.freeze({
  kind: "integral" as const,
  ref: Object.freeze({
    storagePath: "store/campaign/product-1-1/op/art-1024.jpg",
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
  }),
  width: 1024,
  height: 1024,
  mimeType: "image/jpeg",
  storagePath: "store/campaign/product-1-1/op/art-1024.jpg",
});

describe("F56.2b2b — migration 20261015000002 pending_abandon (contrato estático, SEM comentários)", () => {
  it("é LOCAL-ONLY, recria a RPC preservando grants RPC-only e auditoria", () => {
    expect(activeSql.split(/\r?\n/).filter((l) => /db push/i.test(l))).toEqual([]);
    expect(migrationSql).toMatch(/LOCAL-ONLY/);
    expect(migrationSql).toMatch(/migration up --local/);
    expect(activeSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.admin_resolve_product_1_1_pending\(/,
    );
    expect(activeSql).toMatch(/SECURITY DEFINER/);
    expect(activeSql).toMatch(/SET search_path = ''/);
    expect(activeSql).toMatch(/'abandoned'/);
    expect(activeSql).toMatch(/product_1_1_pending_resolution/);
    expect(activeSql).toMatch(/FOR UPDATE/);
    expect(activeSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.admin_resolve_product_1_1_pending\([^)]*\) FROM PUBLIC, anon, authenticated/,
    );
    expect(activeSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.admin_resolve_product_1_1_pending\([^)]*\) TO service_role/,
    );
  });

  it("AMBOS os RAISE ficam condicionados à marca `authorized_abandon` (bypassar só um NÃO basta)", () => {
    // O gatilho do abandono é a MARCA explícita (nunca `execution_ended`).
    expect(activeSql).toMatch(/v_authorized_abandon\s*:=\s*COALESCE\(\(p_evidence->>'authorized_abandon'\) = 'true', false\)/);
    // (1) operation_in_progress condicionado à marca.
    expect(activeSql).toMatch(/IF v_in_progress AND NOT v_authorized_abandon THEN\s*RAISE EXCEPTION 'operation_in_progress'/);
    // (2) execution_not_ended condicionado à marca.
    expect(activeSql).toMatch(/IF NOT v_execution_ended AND NOT v_authorized_abandon THEN\s*RAISE EXCEPTION 'execution_not_ended'/);
    // `execution_ended` da evidência é apenas FORMA-validado.
    expect(activeSql).toMatch(/jsonb_typeof\(p_evidence->'execution_ended'\) <> 'boolean'/);
    // `invalid`/`indeterminate` continuam bloqueando.
    expect(activeSql).toMatch(/v_art_kind IN \('invalid','indeterminate'\)/);
    // O residual `abandoned` é finalizado sob a trava na mesma transação.
    expect(activeSql).toMatch(
      /UPDATE public\.product_1_1_generation_attempt_claims[\s\S]*?SET status = 'abandoned'/,
    );
    expect(activeSql).not.toMatch(/\bCOMMIT\b/);
  });
});

// ── Store SIMULADO que espelha a semântica da RPC estendida ──────────────────
type CreditStatus = "reserved" | "art_uploaded" | "delivered" | "refunded";
type ClaimStatus = "in_progress" | "done" | "failed" | "abandoned";

interface AuditRow {
  action: string;
  campaign_id: string;
  operation_id: string;
  actor_id: string;
  reason: string;
  art_kind: string;
  result: Record<string, unknown>;
}

class AuthorizedStore {
  readonly credit = { status: "reserved" as CreditStatus };
  claim: ClaimStatus = "in_progress";
  readonly audits = new Map<string, AuditRow>();
  abandoned = 0;

  resolveRpc(params: Record<string, unknown>): { data: unknown; error: unknown } {
    const resolutionId = String(params.p_resolution_operation_id);
    const action = params.p_action as PendingResolutionAction;
    const evidence = params.p_evidence as Record<string, unknown>;
    const artKind = String(evidence?.art_kind ?? "");
    const existing = this.audits.get(resolutionId);
    if (existing) {
      const eq =
        existing.action === "product_1_1_pending_resolution" &&
        existing.campaign_id === params.p_campaign_id &&
        existing.operation_id === params.p_operation_id &&
        existing.actor_id === params.p_actor_id &&
        existing.reason === params.p_reason &&
        existing.art_kind === artKind;
      if (eq) return { data: { ...existing.result, idempotent: true }, error: null };
      return { data: { success: false, reason: "operation_identity_conflict" }, error: null };
    }
    if (
      evidence.origin !== "server-derived" ||
      typeof evidence.execution_ended !== "boolean" ||
      !["integral", "absent", "invalid", "indeterminate"].includes(artKind)
    ) {
      return { data: { success: false, reason: "invalid_evidence" }, error: null };
    }
    if (artKind === "invalid" || artKind === "indeterminate") {
      return { data: { success: false, reason: "insufficient_evidence" }, error: null };
    }
    const authorized = evidence.authorized_abandon === true;
    const status = this.credit.status;

    if (status === "delivered" && action === "deliver_existing_art") {
      return { data: this.envelope("delivered", action, artKind, true), error: null };
    }
    if (status === "refunded" && action === "refund_once") {
      return { data: this.envelope("refunded", action, artKind, true), error: null };
    }
    if (status === "delivered" || status === "refunded") {
      return { data: { success: false, reason: "operation_terminal" }, error: null };
    }

    const inProgress = this.claim === "in_progress";
    if (inProgress && !authorized) {
      return { data: { success: false, reason: "operation_in_progress" }, error: null };
    }
    const executionEnded = !inProgress;

    if (action === "deliver_existing_art") {
      if (artKind !== "integral") {
        return { data: { success: false, reason: "insufficient_evidence" }, error: null };
      }
      this.credit.status = "delivered";
    } else {
      if (artKind !== "absent") {
        return { data: { success: false, reason: "insufficient_evidence" }, error: null };
      }
      if (!executionEnded && !authorized) {
        return { data: { success: false, reason: "execution_not_ended" }, error: null };
      }
      this.credit.status = "refunded";
    }
    if (inProgress) {
      this.claim = "abandoned";
      this.abandoned += 1;
    }
    const result = this.envelope(this.credit.status, action, artKind, false);
    this.audits.set(resolutionId, {
      action: "product_1_1_pending_resolution",
      campaign_id: String(params.p_campaign_id),
      operation_id: String(params.p_operation_id),
      actor_id: String(params.p_actor_id),
      reason: String(params.p_reason),
      art_kind: artKind,
      result,
    });
    return { data: result, error: null };
  }

  private envelope(
    status: string,
    action: PendingResolutionAction,
    artKind: string,
    idempotent: boolean,
  ): Record<string, unknown> {
    return {
      success: true,
      idempotent,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      action,
      status,
      art_kind: artKind,
    };
  }

  /** Resultado ATRASADO após o encerramento: `finish` recusa `invalid_transition`. */
  lateFinish(): "ok" | "invalid_transition" {
    return this.claim === "abandoned" ? "invalid_transition" : "ok";
  }

  /** Resultado ATRASADO após o encerramento: `deliver` recusado a partir de `refunded`. */
  lateDeliver(): "ok" | "refused" {
    return this.credit.status === "refunded" ? "refused" : "ok";
  }
}

function storeRepository(store: AuthorizedStore, probe: ArtifactProbe): PendingOperationsRepository {
  const state: PendingOperationState = Object.freeze({
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    storeId: STORE_ID,
    status: store.credit.status,
    amount: 1,
    terminal: store.credit.status === "delivered" || store.credit.status === "refunded",
    unknown: false,
    failed: false,
    processing: store.claim === "in_progress",
    supportReference: null,
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
    latestAttemptAt: null,
  });
  return {
    findPendingOperation: vi.fn(async () => state),
    probeArtifact: vi.fn(async () => probe),
    listPendingOperations: vi.fn(async () => []),
  };
}

function makeClient(store: AuthorizedStore) {
  const rpc = vi.fn(async (_name: string, params: Record<string, unknown>) =>
    store.resolveRpc(params),
  );
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

function baseInput(over: Partial<Parameters<typeof resolvePendingOperation>[0]> = {}) {
  return {
    actorId: ACTOR_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    action: "refund_once" as PendingResolutionAction,
    reason: "resolução autorizada",
    resolutionOperationId: RESOLUTION_ID,
    ...over,
  };
}

describe("F56.2b2b — encerramento autorizado (store/RPC simulados)", () => {
  let store: AuthorizedStore;
  beforeEach(() => {
    store = new AuthorizedStore();
  });

  it("`invalid`/`indeterminate` CONTINUAM bloqueando a resolução (RPC não chamada)", async () => {
    for (const kind of ["invalid", "indeterminate"] as const) {
      const { client, rpc } = makeClient(store);
      await expect(
        resolvePendingOperation(baseInput(), {
          client,
          repository: storeRepository(store, { kind }),
        }),
      ).rejects.toMatchObject({ code: "insufficient_evidence" });
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it("`refund_once` exige `absent`; `deliver_existing_art` exige `integral`", async () => {
    store.claim = "done";
    const { client } = makeClient(store);
    await expect(
      resolvePendingOperation(baseInput({ action: "refund_once" }), {
        client,
        repository: storeRepository(store, INTEGRAL_PROBE),
      }),
    ).rejects.toMatchObject({ code: "insufficient_evidence" });
    await expect(
      resolvePendingOperation(baseInput({ action: "deliver_existing_art" }), {
        client,
        repository: storeRepository(store, { kind: "absent" }),
      }),
    ).rejects.toMatchObject({ code: "insufficient_evidence" });
  });

  it("claim `in_progress` SEM autorização ⇒ bloqueia (`operation_in_progress`, RPC não chamada); a marca NÃO é emitida", async () => {
    const { client, rpc } = makeClient(store);
    await expect(
      resolvePendingOperation(baseInput(), {
        client,
        repository: storeRepository(store, { kind: "absent" }),
      }),
    ).rejects.toMatchObject({ code: "operation_in_progress" });
    expect(rpc).not.toHaveBeenCalled();
    expect(store.abandoned).toBe(0);
  });

  it("claim `in_progress` COM autorização explícita ⇒ estorna e ABANDONA o residual sob a trava", async () => {
    const { client, rpc } = makeClient(store);
    const result = await resolvePendingOperation(
      baseInput({ authorizeAbandon: true }),
      { client, repository: storeRepository(store, { kind: "absent" }) },
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].p_evidence).toMatchObject({ authorized_abandon: true });
    expect(result.status).toBe("refunded");
    expect(store.credit.status).toBe("refunded");
    expect(store.claim).toBe("abandoned");
    expect(store.abandoned).toBe(1);
  });

  it("`deliver_existing_art` com arte íntegra ⇒ entrega (sem abandono quando não há residual autorizado)", async () => {
    store.claim = "done";
    const { client } = makeClient(store);
    const result = await resolvePendingOperation(
      baseInput({ action: "deliver_existing_art" }),
      { client, repository: storeRepository(store, INTEGRAL_PROBE) },
    );
    expect(result.status).toBe("delivered");
    expect(store.credit.status).toBe("delivered");
  });

  it("replay EQUIVALENTE ⇒ idempotente (uma auditoria/um efeito); DIVERGENTE ⇒ `operation_identity_conflict`", async () => {
    const { client } = makeClient(store);
    const first = await resolvePendingOperation(baseInput({ authorizeAbandon: true }), {
      client,
      repository: storeRepository(store, { kind: "absent" }),
    });
    expect(first.idempotent).toBe(false);
    // Replay equivalente (mesmo conteúdo): a RPC reusa idempotente (auditoria única).
    const second = await resolvePendingOperation(baseInput({ authorizeAbandon: true }), {
      client,
      repository: storeRepository(store, { kind: "absent" }),
    });
    expect(second.idempotent).toBe(true);
    expect(store.audits.size).toBe(1);
    // Replay DIVERGENTE (motivo diferente) ⇒ conflito.
    await expect(
      resolvePendingOperation(baseInput({ authorizeAbandon: true, reason: "motivo divergente" }), {
        client,
        repository: storeRepository(store, { kind: "absent" }),
      }),
    ).rejects.toMatchObject({ code: "operation_identity_conflict" });
  });

  it("terminal: `delivered`/`refunded` idempotente na ação correspondente; ação divergente ⇒ `operation_terminal`", async () => {
    store.claim = "done";
    store.credit.status = "delivered";
    const { client } = makeClient(store);
    const idem = await resolvePendingOperation(baseInput({ action: "deliver_existing_art" }), {
      client,
      repository: storeRepository(store, INTEGRAL_PROBE),
    });
    expect(idem.idempotent).toBe(true);
    expect(idem.status).toBe("delivered");
    await expect(
      resolvePendingOperation(baseInput({ action: "refund_once" }), {
        client,
        repository: storeRepository(store, { kind: "absent" }),
      }),
    ).rejects.toMatchObject({ code: "operation_terminal" });
  });

  it("RESULTADO ATRASADO após o encerramento ⇒ recusado (finish `invalid_transition`; deliver recusado)", async () => {
    const { client } = makeClient(store);
    await resolvePendingOperation(baseInput({ authorizeAbandon: true }), {
      client,
      repository: storeRepository(store, { kind: "absent" }),
    });
    expect(store.credit.status).toBe("refunded");
    expect(store.claim).toBe("abandoned");
    expect(store.lateFinish()).toBe("invalid_transition");
    expect(store.lateDeliver()).toBe("refused");
    // O estado terminal NÃO é sobrescrito.
    expect(store.credit.status).toBe("refunded");
  });
});
