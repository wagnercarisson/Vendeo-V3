#!/usr/bin/env node
/**
 * F60 / Plano 60-01 — Harness determinístico da prova (SEM IA, SEM provider).
 *
 * Executa S01..S13 contra as RPCs reais do homolog autorizado. As etapas `base` e
 * `expansion` são simuladas por chamadas de controle; a "arte" é uma evidência
 * textual controlada (hash fixo) e a publicação usa o fence existente.
 *
 * Este script NÃO é executado no planejamento/preparação. Ele exige:
 *   F60_HOMOLOG_AUTHORIZED=1, F60_EXCLUSIVITY_WINDOW, TEST_DATABASE_URL e a
 *   autorização C do checkpoint de 60-01.
 */
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const ARTIFACT_EVIDENCE_REF = "sha256:f60-simulated-artifact-v1";
const ARTIFACT_HASH = createHash("sha256").update(ARTIFACT_EVIDENCE_REF).digest("hex");

const MANIFEST = {
  users: [],
  stores: [],
  campaigns: [],
  operations: [],
  legacyOperations: [],
  auditResolutionIds: [],
};

const RUN_ID = process.env.F60_RUN_ID;
if (!RUN_ID) throw new Error("F60_RUN_ID é obrigatório");

function assertAuthorized() {
  if (process.env.F60_HOMOLOG_AUTHORIZED !== "1") {
    throw new Error("F60_HOMOLOG_AUTHORIZED=1 é obrigatório");
  }
  if (!process.env.F60_EXCLUSIVITY_WINDOW) {
    throw new Error("F60_EXCLUSIVITY_WINDOW é obrigatório (início/fim/responsável)");
  }
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL é obrigatório");
  }
  const url = new URL(process.env.TEST_DATABASE_URL);
  const host = url.hostname;
  const port = url.port || "5432";
  const db = url.pathname.replace(/^\//, "");
  if (host !== "127.0.0.1" || port !== "57782" || db !== "postgres") {
    throw new Error(`alvo recusado: ${host}:${port}/${db}`);
  }
}

function newClient() {
  return new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
}

async function rpc(client, name, params) {
  const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await client.query(
    `select public.${name}(${placeholders}) as result`,
    params,
  );
  return rows[0]?.result ?? null;
}

async function rpcJson(client, name, params) {
  const result = await rpc(client, name, params);
  if (result === null || typeof result !== "object") {
    throw new Error(`${name}: envelope vazio`);
  }
  return result;
}

async function createFixture(client, label) {
  const userId = randomUUID();
  const storeId = randomUUID();
  const campaignId = randomUUID();
  const suffix = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  MANIFEST.users.push(userId);
  MANIFEST.stores.push(storeId);
  MANIFEST.campaigns.push(campaignId);

  await client.query(
    `insert into auth.users (id, aud, role, email, created_at, updated_at)
     values ($1, 'authenticated', 'authenticated', $2, now(), now())`,
    [userId, `p916test-${suffix}@f60.test`],
  );
  await client.query(
    `insert into public.stores (id, user_id, name, segment)
     values ($1, $2, $3, 'variedades-utilidades')`,
    [storeId, userId, `p916test-${label}`.slice(0, 60)],
  );
  await client.query(
    `insert into public.campaigns (id, store_id, status, product_name, storage_path)
     values ($1, $2, 'generating', $3, $4)`,
    [campaignId, storeId, `p916test-${label}`, `f60/${campaignId}`],
  );

  await client.query("select public.grant_credits($1, 20, 'f60-proof', $2, '{}'::jsonb)", [
    storeId,
    `f60-proof-grant-${storeId}`,
  ]);

  return { userId, storeId, campaignId, label };
}

async function openOperation(client, fixture, operationId, storeId = fixture.storeId, campaignId = fixture.campaignId) {
  const result = await rpcJson(client, "product_9_16_open_operation", [storeId, campaignId, operationId]);
  if (result.success === true) MANIFEST.operations.push({ campaignId, operationId });
  return result;
}

async function reserveLegacy(client, fixture, operationId) {
  await rpcJson(client, "product_1_1_reserve_credit_operation", [
    fixture.storeId,
    fixture.campaignId,
    operationId,
    1,
    "{}",
  ]);
  MANIFEST.legacyOperations.push({ campaignId: fixture.campaignId, operationId });
  return { campaignId: fixture.campaignId, operationId };
}

async function acquire(client, fixture, operationId, stage, requestId, target, campaignId = fixture.campaignId) {
  return rpcJson(client, "product_9_16_acquire_step", [
    campaignId,
    operationId,
    stage,
    requestId,
    target,
  ]);
}

async function finish(client, campaignId, operationId, token, status, failureClass = null) {
  return rpcJson(client, "product_9_16_finish_step", [
    campaignId,
    operationId,
    token,
    "in_progress",
    status,
    failureClass,
  ]);
}

async function outcome(client, campaignId, operationId, stage, outcome, reference = null) {
  return rpcJson(client, "product_9_16_record_outcome", [
    campaignId,
    operationId,
    stage,
    outcome,
    reference,
  ]);
}

async function creditState(client, campaignId, operationId) {
  const { rows } = await client.query(
    `select status, publication_state, state_epoch, credit_tx_id, refund_tx_id
       from public.product_1_1_campaign_credit_operations
      where campaign_id = $1 and operation_id = $2`,
    [campaignId, operationId],
  );
  return rows[0] ?? null;
}

async function ledgerCounts(client, storeId, campaignId) {
  const { rows } = await client.query(
    `select
       count(*) filter (where type = 'deduction' and campaign_id = $2)::int as deductions,
       count(*) filter (where type = 'refund')::int as refunds,
       coalesce(sum(amount) filter (where type in ('deduction','refund')), 0)::int as net
     from public.credit_transactions
     where store_id = $1`,
    [storeId, campaignId],
  );
  return rows[0];
}

async function deliverSimulated(client, campaignId, operationId) {
  const begin = await rpcJson(client, "product_1_1_begin_publication", [campaignId, operationId]);
  if (begin.acquired !== true) throw new Error("publication_not_acquired");
  const token = begin.token;
  await rpcJson(client, "product_1_1_mark_campaign_credit_art_uploaded", [
    campaignId,
    operationId,
    token,
  ]);
  return rpcJson(client, "product_1_1_deliver_campaign_credit_operation", [
    campaignId,
    operationId,
    token,
  ]);
}

async function completeBase(client, fixture, operationId) {
  const acquired = await acquire(client, fixture, operationId, "base", randomUUID(), "primary");
  if (acquired.authorization !== "execute") throw new Error("base_not_authorized");
  await finish(client, fixture.campaignId, operationId, acquired.attempt_token, "completed");
  return acquired;
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function scenario(id, name, fn) {
  const client = newClient();
  await client.connect();
  try {
    const result = await fn(client);
    return { id, name, status: "PASS", result };
  } catch (error) {
    return {
      id,
      name,
      status: "FAIL",
      error: error.message,
      details: error.details ?? null,
    };
  } finally {
    await client.end();
  }
}

async function s01(client) {
  const f = await createFixture(client, "s01");
  const op = randomUUID();
  const beforeLedger = await ledgerCounts(client, f.storeId, f.campaignId);
  const open = await openOperation(client, f, op);
  assert(open.success === true, "open_failed", open);
  await completeBase(client, f, op);
  const afterBase = await creditState(client, f.campaignId, op);
  assert(afterBase.status === "reserved", "base_confirmed_credit", afterBase);

  const expansion = await acquire(client, f, op, "expansion", randomUUID(), "initial");
  assert(expansion.authorization === "execute", "expansion_not_authorized", expansion);
  // Evidência de arte controlada: hash fixo; não há upload real nesta fatia.
  assert(ARTIFACT_HASH.length === 64, "artifact_evidence_hash_invalid");
  await finish(client, f.campaignId, op, expansion.attempt_token, "completed");
  const delivered = await deliverSimulated(client, f.campaignId, op);
  assert(delivered.status === "delivered", "delivery_not_confirmed", delivered);
  const after = await creditState(client, f.campaignId, op);
  const afterLedger = await ledgerCounts(client, f.storeId, f.campaignId);
  assert(afterLedger.deductions - beforeLedger.deductions === 1, "credit_not_consumed_once", { beforeLedger, afterLedger });
  assert(afterLedger.net - beforeLedger.net === -1, "credit_net_not_minus_one", { beforeLedger, afterLedger });
  return { operationId: op, campaignId: f.campaignId, status: after.status, artifactEvidenceRef: ARTIFACT_EVIDENCE_REF, ledger: afterLedger };
}

async function s02(client) {
  const f = await createFixture(client, "s02");
  const op = randomUUID();
  await openOperation(client, f, op);
  await completeBase(client, f, op);
  const expansion = await acquire(client, f, op, "expansion", randomUUID(), "initial");
  await finish(client, f.campaignId, op, expansion.attempt_token, "failed", "definitive");
  const earlyRetry = await acquire(client, f, op, "expansion", randomUUID(), "retry");
  assert(earlyRetry.reason === "invalid_transition", "definitive_retry_before_outcome_allowed", earlyRetry);
  const earlyBase = await acquire(client, f, op, "base", randomUUID(), "primary");
  assert(earlyBase.reason === "invalid_transition", "definitive_base_retry_allowed", earlyBase);
  const failed = await outcome(client, f.campaignId, op, "expansion", "failed", "f60-s02");
  assert(failed.success === true, "outcome_failed", failed);
  const epoch = await rpc(client, "product_1_1_get_publication_epoch", [f.campaignId, op]);
  const closed = await rpcJson(client, "product_1_1_close_failed_operation", [
    f.campaignId,
    op,
    "absent",
    epoch,
    "f60-s02-definitive",
  ]);
  assert(closed.status === "refunded", "refund_not_applied", closed);
  const retry = await acquire(client, f, op, "expansion", randomUUID(), "retry");
  assert(
    retry.reason === "operation_terminal" || retry.reason === "invalid_transition",
    "retry_after_definitive_allowed",
    retry,
  );
  const state = await creditState(client, f.campaignId, op);
  const ledger = await ledgerCounts(client, f.storeId, f.campaignId);
  assert(ledger.refunds === 1, "refund_not_exactly_once", ledger);
  return { operationId: op, campaignId: f.campaignId, status: state.status, refundTxId: state.refund_tx_id, ledger };
}

async function s03Impl(clientA, clientB) {
  const f = await createFixture(clientA, "s03");
  const op = randomUUID();
  await openOperation(clientA, f, op);
  const [a, b] = await Promise.all([
    acquire(clientA, f, op, "base", randomUUID(), "primary"),
    acquire(clientB, f, op, "base", randomUUID(), "primary"),
  ]);
  const executes = [a, b].filter((r) => r.authorization === "execute");
  assert(executes.length === 1, "concurrent_execute_count", { a, b });
  return { operationId: op, campaignId: f.campaignId, authorizations: [a.authorization, b.authorization] };
}

async function s04(client) {
  const f = await createFixture(client, "s04");
  const op = randomUUID();
  await openOperation(client, f, op);
  const requestId = randomUUID();
  const first = await acquire(client, f, op, "base", requestId, "primary");
  const replay = await acquire(client, f, op, "base", requestId, "primary");
  assert(first.authorization === "execute", "first_not_execute", first);
  assert(replay.authorization === "query_only", "replay_not_query_only", replay);
  assert(replay.attempt_token === first.attempt_token, "replay_token_differs", { first, replay });
  const { rows } = await client.query(
    `select count(*)::int as n from public.product_9_16_two_stage_attempt_claims
      where campaign_id = $1 and operation_id = $2`,
    [f.campaignId, op],
  );
  assert(rows[0].n === 1, "duplicate_claim_created", rows[0]);
  return { operationId: op, campaignId: f.campaignId, claims: rows[0].n };
}

async function s05Impl(clientA, clientB) {
  const f = await createFixture(clientA, "s05");
  const op = randomUUID();
  await openOperation(clientA, f, op);
  const requestId = randomUUID();
  const [a, b] = await Promise.all([
    acquire(clientA, f, op, "base", requestId, "primary"),
    acquire(clientB, f, op, "base", requestId, "primary"),
  ]);
  const executes = [a, b].filter((r) => r.authorization === "execute");
  assert(executes.length === 1, "same_request_execute_count", { a, b });
  return { operationId: op, campaignId: f.campaignId, authorizations: [a.authorization, b.authorization] };
}

async function s06(client) {
  const f = await createFixture(client, "s06");
  const op = randomUUID();
  await openOperation(client, f, op);
  await completeBase(client, f, op);
  const before = await rpcJson(client, "product_9_16_resume_operation", [f.campaignId, op]);
  assert(before.action === "acquire_expansion", "resume_not_expansion", before);
  const expansion = await acquire(client, f, op, "expansion", randomUUID(), "initial");
  assert(expansion.authorization === "execute", "expansion_not_authorized", expansion);
  const { rows } = await client.query(
    `select count(*)::int as n from public.product_9_16_two_stage_attempt_claims
      where campaign_id = $1 and operation_id = $2 and stage = 'base'`,
    [f.campaignId, op],
  );
  assert(rows[0].n === 1, "base_regenerated", rows[0]);
  return { operationId: op, campaignId: f.campaignId, baseAttempts: rows[0].n };
}

async function s07(client) {
  // Base: falha transitória permite retry/fallback; retomada e aquisição concordam.
  const baseFixture = await createFixture(client, "s07-base");
  const baseOp = randomUUID();
  await openOperation(client, baseFixture, baseOp);
  const baseFirst = await acquire(client, baseFixture, baseOp, "base", randomUUID(), "primary");
  await finish(client, baseFixture.campaignId, baseOp, baseFirst.attempt_token, "failed", "transient");
  const baseResume1 = await rpcJson(client, "product_9_16_resume_operation", [baseFixture.campaignId, baseOp]);
  assert(baseResume1.action === "retry_base" && baseResume1.next_target === "primary", "base_resume_not_primary", baseResume1);
  const baseSecond = await acquire(client, baseFixture, baseOp, "base", randomUUID(), "primary");
  await finish(client, baseFixture.campaignId, baseOp, baseSecond.attempt_token, "failed", "transient");
  const baseResume2 = await rpcJson(client, "product_9_16_resume_operation", [baseFixture.campaignId, baseOp]);
  assert(baseResume2.action === "retry_base" && baseResume2.next_target === "fallback", "base_resume_not_fallback", baseResume2);

  const f = await createFixture(client, "s07");
  const op = randomUUID();
  await openOperation(client, f, op);
  await completeBase(client, f, op);
  const first = await acquire(client, f, op, "expansion", randomUUID(), "initial");
  await finish(client, f.campaignId, op, first.attempt_token, "failed", "transient");
  const resume = await rpcJson(client, "product_9_16_resume_operation", [f.campaignId, op]);
  assert(resume.action === "retry_expansion", "resume_not_retry", resume);
  const retry = await acquire(client, f, op, "expansion", randomUUID(), "retry");
  assert(retry.authorization === "execute", "retry_not_authorized", retry);
  await finish(client, f.campaignId, op, retry.attempt_token, "failed", "transient");
  const third = await acquire(client, f, op, "expansion", randomUUID(), "retry");
  assert(third.reason === "attempt_limit_reached", "third_retry_allowed", third);
  return { operationId: op, campaignId: f.campaignId, thirdReason: third.reason };
}

async function s08(client) {
  const f = await createFixture(client, "s08");
  const op = randomUUID();
  await openOperation(client, f, op);
  await completeBase(client, f, op);
  const expansion = await acquire(client, f, op, "expansion", randomUUID(), "initial");
  await finish(client, f.campaignId, op, expansion.attempt_token, "failed", "unknown");
  const unknown = await outcome(client, f.campaignId, op, "expansion", "unknown", "f60-s08");
  assert(unknown.success === true, "unknown_not_persisted", unknown);
  const again = await acquire(client, f, op, "expansion", randomUUID(), "retry");
  assert(again.reason === "operation_unknown", "retry_after_unknown", again);
  const baseAgain = await acquire(client, f, op, "base", randomUUID(), "primary");
  assert(baseAgain.reason === "operation_unknown", "base_retry_after_unknown", baseAgain);
  const epoch = await rpc(client, "product_1_1_get_publication_epoch", [f.campaignId, op]);
  let refundBlocked = false;
  try {
    await rpcJson(client, "product_1_1_close_failed_operation", [
      f.campaignId,
      op,
      "absent",
      epoch,
      "f60-s08-no-blind-refund",
    ]);
  } catch (error) {
    refundBlocked = /finality_not_recorded|operation_in_progress/.test(error.message);
  }
  const state = await creditState(client, f.campaignId, op);
  assert(refundBlocked === true, "blind_refund_allowed", { state });
  assert(state.status === "reserved", "unknown_changed_credit", state);

  // Negativo: `abandoned` com classe unknown não pode contornar o bloqueio.
  const f2 = await createFixture(client, "s08-abandoned");
  const op2 = randomUUID();
  await openOperation(client, f2, op2);
  const baseClaim = await acquire(client, f2, op2, "base", randomUUID(), "primary");
  let abandonedRejected = false;
  try {
    await finish(client, f2.campaignId, op2, baseClaim.attempt_token, "abandoned", "unknown");
  } catch (error) {
    abandonedRejected = /invalid_failure_class/.test(error.message);
  }
  assert(abandonedRejected === true, "abandoned_unknown_accepted_by_finish");
  await client.query(
    `update public.product_9_16_two_stage_attempt_claims
        set status = 'abandoned', failure_class = 'unknown'
      where campaign_id = $1 and operation_id = $2 and attempt_token = $3`,
    [f2.campaignId, op2, baseClaim.attempt_token],
  );
  const abandonedRetry = await acquire(client, f2, op2, "base", randomUUID(), "primary");
  assert(abandonedRetry.reason === "operation_unknown", "abandoned_unknown_bypassed_bloqueio", abandonedRetry);

  return { operationId: op, campaignId: f.campaignId, status: state.status };
}

async function s09(client) {
  const f = await createFixture(client, "s09");
  const op = randomUUID();
  await openOperation(client, f, op);
  await completeBase(client, f, op);
  const expansion = await acquire(client, f, op, "expansion", randomUUID(), "initial");
  await finish(client, f.campaignId, op, expansion.attempt_token, "completed");
  await deliverSimulated(client, f.campaignId, op);
  const late = await finish(client, f.campaignId, op, expansion.attempt_token, "completed");
  assert(late.success === false && late.reason === "operation_terminal", "late_after_delivery_allowed", late);
  return { operationId: op, campaignId: f.campaignId, lateReason: late.reason };
}

async function s10(client) {
  const f = await createFixture(client, "s10");
  const op = randomUUID();
  await openOperation(client, f, op);
  await completeBase(client, f, op);
  const expansion = await acquire(client, f, op, "expansion", randomUUID(), "initial");
  const epoch = await rpc(client, "product_1_1_get_publication_epoch", [f.campaignId, op]);
  const resolutionId = randomUUID();
  MANIFEST.auditResolutionIds.push(resolutionId);
  const resolved = await rpcJson(client, "admin_resolve_product_1_1_pending", [
    f.userId,
    f.campaignId,
    op,
    "refund_once",
    "f60-s10-admin-refund",
    resolutionId,
    JSON.stringify({
      origin: "server-derived",
      art_kind: "absent",
      execution_ended: false,
      state_epoch: String(epoch),
      authorized_abandon: "true",
      authorized_publication_closure: "true",
    }),
  ]);
  assert(resolved.status === "refunded", "admin_refund_failed", resolved);
  const late = await finish(client, f.campaignId, op, expansion.attempt_token, "completed");
  assert(late.reason === "operation_terminal", "late_after_admin_allowed", late);
  const newAttempt = await acquire(client, f, op, "expansion", randomUUID(), "retry");
  assert(newAttempt.reason === "operation_terminal", "new_attempt_after_admin_allowed", newAttempt);
  return { operationId: op, campaignId: f.campaignId, resolvedStatus: resolved.status };
}

async function s11Impl(clientA, clientB) {
  const f = await createFixture(clientA, "s11");
  const op = randomUUID();
  await openOperation(clientA, f, op);
  await completeBase(clientA, f, op);
  const epoch = await rpc(clientA, "product_1_1_get_publication_epoch", [f.campaignId, op]);

  // A mantém a transação aberta com claim in_progress (trava C4).
  await clientA.query("BEGIN");
  const expansion = await acquire(clientA, f, op, "expansion", randomUUID(), "initial");
  assert(expansion.authorization === "execute", "s11_acquire_not_execute", expansion);
  await outcome(clientA, f.campaignId, op, "expansion", "failed", "f60-s11");

  await clientB.query("BEGIN");
  await clientB.query("SET LOCAL lock_timeout = '2s'");
  let settled = false;
  const closePromise = rpcJson(clientB, "product_1_1_close_failed_operation", [
    f.campaignId,
    op,
    "absent",
    epoch,
    "f60-s11-concurrent-close",
  ])
    .then((value) => ({ ok: true, value }))
    .catch((error) => ({ ok: false, error }))
    .finally(() => {
      settled = true;
    });

  await new Promise((resolve) => setTimeout(resolve, 300));
  const overlapped = settled === false;
  await clientA.query("COMMIT");
  const closeResult = await closePromise;

  if (closeResult.ok) {
    await clientB.query("ROLLBACK");
    throw new Error("close_while_active_allowed");
  }
  await clientB.query("ROLLBACK");

  assert(overlapped === true, "no_transactional_overlap_observed");
  assert(
    /operation_in_progress/.test(closeResult.error.message),
    "unexpected_close_error",
    closeResult.error.message,
  );
  const state = await creditState(clientA, f.campaignId, op);
  assert(state.status === "reserved", "concurrent_close_refunded", state);
  return {
    operationId: op,
    campaignId: f.campaignId,
    overlapObserved: overlapped,
    closeError: closeResult.error.message,
    status: state.status,
  };
}

async function s12(client) {
  const f = await createFixture(client, "s12");
  const legacyOp = randomUUID();
  await reserveLegacy(client, f, legacyOp);
  const legacyClaim = await rpcJson(client, "product_1_1_acquire_attempt_start", [
    f.campaignId,
    legacyOp,
    "primary",
    1,
  ]);
  assert(legacyClaim.acquired === true, "legacy_claim_not_acquired", legacyClaim);

  const blocked = await rpcJson(client, "product_9_16_open_operation", [
    f.storeId,
    f.campaignId,
    legacyOp,
  ]);
  assert(blocked.reason === "operation_origin_conflict", "legacy_adopted", blocked);
  const { rows: controlRows } = await client.query(
    `select count(*)::int as n from public.product_9_16_two_stage_operations
      where campaign_id = $1 and operation_id = $2`,
    [f.campaignId, legacyOp],
  );
  assert(controlRows[0].n === 0, "control_row_created_for_legacy", controlRows[0]);

  const { rows: activeLegacy } = await client.query(
    `select source from public.product_generation_active_claims_v
      where campaign_id = $1 and operation_id = $2`,
    [f.campaignId, legacyOp],
  );
  assert(activeLegacy.length === 1 && activeLegacy[0].source === "legacy", "legacy_claim_hidden", activeLegacy);

  const newOp = randomUUID();
  await openOperation(client, f, newOp);
  const newClaim = await acquire(client, f, newOp, "base", randomUUID(), "primary");
  assert(newClaim.authorization === "execute", "new_claim_not_authorized", newClaim);
  const { rows: activeNew } = await client.query(
    `select source from public.product_generation_claim_history_v
      where campaign_id = $1 and operation_id = $2`,
    [f.campaignId, newOp],
  );
  assert(activeNew.length === 1 && activeNew[0].source === "9_16_two_stage", "new_origin_missing", activeNew);

  return {
    campaignId: f.campaignId,
    legacyOperationId: legacyOp,
    newOperationId: newOp,
    legacyClaimVisible: activeLegacy[0].source,
  };
}

async function s13(client) {
  const results = [];

  // 1) Entrega legada 1:1 e 9:16 direto (mesmo contrato financeiro, sem controle novo).
  for (const format of ["1:1", "9:16"]) {
    const f = await createFixture(client, `s13-deliver-${format.replace(":", "")}`);
    const op = randomUUID();
    await reserveLegacy(client, f, op);
    await deliverSimulated(client, f.campaignId, op);
    const state = await creditState(client, f.campaignId, op);
    assert(state.status === "delivered", "compat_not_delivered", { format, state });
    const { rows } = await client.query(
      `select count(*)::int as n from public.product_9_16_two_stage_operations
        where campaign_id = $1 and operation_id = $2`,
      [f.campaignId, op],
    );
    assert(rows[0].n === 0, "compat_created_control", { format, rows: rows[0] });
    results.push({ format, operationId: op, status: state.status, path: "delivery" });
  }

  // 2) Encerramento por falha definitiva (RPC compartilhada adaptada).
  {
    const f = await createFixture(client, "s13-close");
    const op = randomUUID();
    await reserveLegacy(client, f, op);
    await rpcJson(client, "product_1_1_record_generation_outcome", [
      f.campaignId,
      op,
      "failed",
      "f60-s13-close",
    ]);
    const epoch = await rpc(client, "product_1_1_get_publication_epoch", [f.campaignId, op]);
    const closed = await rpcJson(client, "product_1_1_close_failed_operation", [
      f.campaignId,
      op,
      "absent",
      epoch,
      "f60-s13-close",
    ]);
    assert(closed.status === "refunded", "legacy_close_failed", closed);
    results.push({ operationId: op, status: closed.status, path: "close_failed_operation" });
  }

  // 3) Leitura de operação e resolução administrativa (RPCs compartilhadas adaptadas).
  {
    const f = await createFixture(client, "s13-admin");
    const op = randomUUID();
    await reserveLegacy(client, f, op);
    const claim = await rpcJson(client, "product_1_1_acquire_attempt_start", [
      f.campaignId,
      op,
      "primary",
      1,
    ]);
    assert(claim.acquired === true, "legacy_claim_not_acquired", claim);
    await rpcJson(client, "product_1_1_record_generation_outcome", [
      f.campaignId,
      op,
      "unknown",
      "f60-s13-unknown",
    ]);
    const read = await rpcJson(client, "product_1_1_get_campaign_operation_by_campaign", [
      f.campaignId,
    ]);
    assert(read.unknown === true, "legacy_unknown_not_read", read);

    const epoch = await rpc(client, "product_1_1_get_publication_epoch", [f.campaignId, op]);
    const resolutionId = randomUUID();
    MANIFEST.auditResolutionIds.push(resolutionId);
    const resolved = await rpcJson(client, "admin_resolve_product_1_1_pending", [
      f.userId,
      f.campaignId,
      op,
      "refund_once",
      "f60-s13-admin",
      resolutionId,
      JSON.stringify({
        origin: "server-derived",
        art_kind: "absent",
        execution_ended: false,
        state_epoch: String(epoch),
        authorized_abandon: "true",
        authorized_publication_closure: "true",
      }),
    ]);
    assert(resolved.status === "refunded", "legacy_admin_refund_failed", resolved);
    results.push({ operationId: op, status: resolved.status, path: "admin_resolve" });
  }

  return { results };
}

async function captureExpectedAdditions(client) {
  const pairs = [...MANIFEST.operations, ...MANIFEST.legacyOperations];
  const campaigns = pairs.map((p) => p.campaignId);
  const operations = pairs.map((p) => p.operationId);

  const pairsQuery = async (table) => {
    if (pairs.length === 0) return [];
    const { rows } = await client.query(
      `select id from ${table}
        where (campaign_id, operation_id) in (
          select * from unnest($1::uuid[], $2::uuid[])
        )`,
      [campaigns, operations],
    );
    return rows.map((r) => String(r.id));
  };

  const { rows: txRows } = MANIFEST.stores.length
    ? await client.query(
        `select id from public.credit_transactions where store_id = any($1::uuid[])`,
        [MANIFEST.stores],
      )
    : { rows: [] };
  const { rows: auditRows } = MANIFEST.auditResolutionIds.length
    ? await client.query(
        `select id from public.admin_audit_log where operation_id = any($1::uuid[])`,
        [MANIFEST.auditResolutionIds],
      )
    : { rows: [] };

  return {
    run_id: RUN_ID,
    additions: {
      "auth.users": [...new Set(MANIFEST.users)],
      "public.stores": [...new Set(MANIFEST.stores)],
      "public.campaigns": [...new Set(MANIFEST.campaigns)],
      "public.credit_balances": [...new Set(MANIFEST.stores)],
      "public.credit_transactions": txRows.map((r) => String(r.id)),
      "public.product_1_1_campaign_credit_operations": await pairsQuery(
        "public.product_1_1_campaign_credit_operations",
      ),
      "public.product_1_1_generation_attempt_claims": await pairsQuery(
        "public.product_1_1_generation_attempt_claims",
      ),
      "public.product_1_1_generation_outcomes": await pairsQuery(
        "public.product_1_1_generation_outcomes",
      ),
      "public.admin_audit_log": auditRows.map((r) => String(r.id)),
      "public.product_9_16_two_stage_operations": await pairsQuery(
        "public.product_9_16_two_stage_operations",
      ),
      "public.product_9_16_two_stage_steps": await pairsQuery(
        "public.product_9_16_two_stage_steps",
      ),
      "public.product_9_16_two_stage_attempt_claims": await pairsQuery(
        "public.product_9_16_two_stage_attempt_claims",
      ),
      "public.product_9_16_two_stage_outcomes": await pairsQuery(
        "public.product_9_16_two_stage_outcomes",
      ),
    },
  };
}

export async function runAll() {
  assertAuthorized();
  const scenarios = [];
  const run = async (id, name, fn) => scenarios.push(await scenario(id, name, fn));

  await run("S01", "abertura atômica + entrega com 1 crédito", s01);
  await run("S02", "falha definitiva + 1 estorno", s02);
  await run("S04", "repetição da mesma requisição", s04);
  await run("S06", "retomada após base sem regenerar", s06);
  await run("S07", "limite de expansão entre retomadas", s07);
  await run("S08", "resultado desconhecido sem retry/estorno", s08);
  await run("S09", "resposta tardia após entrega", s09);
  await run("S10", "admin encerra/estorna e bloqueia efeitos", s10);
  await run("S12", "origem canônica e recusa de adoção", s12);
  await run("S13", "compatibilidade 1:1 e 9:16 direto", s13);

  for (const [id, name, fn] of [
    ["S03", "concorrência distinta", s03Impl],
    ["S05", "mesmo request_id simultâneo", s05Impl],
    ["S11", "encerramento concorrente com etapa ativa", s11Impl],
  ]) {
    const a = newClient();
    const b = newClient();
    await a.connect();
    await b.connect();
    try {
      const result = await fn(a, b);
      scenarios.push({ id, name, status: "PASS", result });
    } catch (error) {
      scenarios.push({ id, name, status: "FAIL", error: error.message, details: error.details ?? null });
    } finally {
      await a.end();
      await b.end();
    }
  }

  return scenarios.sort((x, y) => x.id.localeCompare(y.id));
}

export function summarize(scenarios) {
  const passed = scenarios.filter((s) => s.status === "PASS").length;
  return {
    kind: "f60-two-stage-proof",
    run_id: RUN_ID,
    run_at: new Date().toISOString(),
    artifact_evidence_ref: ARTIFACT_EVIDENCE_REF,
    artifact_sha256: ARTIFACT_HASH,
    manifest: MANIFEST,
    scenarios,
    passed,
    failed: scenarios.length - passed,
    approved: passed === scenarios.length && scenarios.length === 13,
  };
}

async function main() {
  assertAuthorized();
  const scenarios = await runAll();
  const summary = summarize(scenarios);
  const dir = resolve(
    process.env.F60_EVIDENCE_DIR ??
      ".planning/phases/60-f60-controle-das-duas-etapas-9-16-e-integracao-financeira/evidence",
  );
  mkdirSync(dir, { recursive: true });
  const jsonPath = resolve(dir, "f60-proof-evidence.json");
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const client = newClient();
  await client.connect();
  let expectations;
  try {
    expectations = await captureExpectedAdditions(client);
  } finally {
    await client.end();
  }
  const expectPath = resolve(dir, "f60-expected-additions.json");
  writeFileSync(expectPath, `${JSON.stringify(expectations, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify({
      ok: summary.approved,
      jsonPath,
      expectPath,
      passed: summary.passed,
      failed: summary.failed,
    }),
  );
  if (!summary.approved) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[f60-harness] ${error.message}`);
    process.exitCode = 1;
  });
}

// Placeholder defensivo: nunca usar provider/IA nesta prova.
void ARTIFACT_EVIDENCE_REF;
