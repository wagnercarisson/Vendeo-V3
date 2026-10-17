// F56.2b2c (B2.3) — PROVAS CONCORRENTES do controle de gasto do piloto.
// EXECUTÁVEL, mas somente no CHECKPOINT AUTORIZADO do Plano 04 (NÃO rodar agora).
//
// Exporta `runProofs({ makeClient })` (injetável) para teste com cliente `pg`
// SIMULADO. O estado ESPERADO é compartilhado entre `try` e `finally` (declarado
// fora do `try`) e acompanha teto/auditoria/gasto das fixtures EFETIVAMENTE
// confirmadas; o snapshot inicial é EXCLUSIVAMENTE o destino da restauração.

import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { classifyPreservation } from "./lib/preservation.mjs";

const CONN =
  process.env.PILOT_PROOF_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:57782/postgres";

function assertLocalDestination(conn) {
  const expectedPort = Number(process.env.PILOT_PROOF_PORT ?? "57782");
  if (process.env.PILOT_PROOF_IDENTITY !== "vendeo-homolog") {
    throw new Error('PROOFS: defina PILOT_PROOF_IDENTITY="vendeo-homolog" (homologação permanente).');
  }
  let url;
  try { url = new URL(conn); } catch { throw new Error(`DATABASE_URL inválida: ${conn}`); }
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error(`PROOFS: destino NÃO-LOCAL recusado (${url.hostname}).`);
  }
  const port = url.port ? Number(url.port) : 5432;
  if (port !== expectedPort) throw new Error(`PROOFS: porta ${port} ≠ ${expectedPort}. Recusado.`);
}

async function backendPid(client) {
  const { rows } = await client.query("select pg_backend_pid() as pid");
  return rows[0].pid;
}

async function waitForAdvisoryLockWait(pollClient, pid, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { rows } = await pollClient.query(
      "select wait_event_type, wait_event from pg_stat_activity where pid = $1",
      [pid],
    );
    const row = rows[0];
    if (row && row.wait_event_type === "Lock" && row.wait_event === "advisory") return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}

async function callBegin(client, p) {
  try {
    const { rows } = await client.query(
      "select public.product_1_1_pilot_begin_paid_call($1,$2,$3,$4,$5,$6,$7) as r",
      [p.campaignId, p.operationId, p.callId, p.kind, p.attemptSeq, p.estimatedUsd, p.ownerToken],
    );
    return { ok: true, value: rows[0].r };
  } catch (error) {
    return { ok: false, message: String(error.message ?? error) };
  }
}

/**
 * @param {object} opts
 * @param {() => {query:Function, end:Function, connect:Function}} opts.makeClient
 * @param {(msg:string)=>void} [opts.log]
 * @returns {Promise<{failures:number}>}
 */
export async function runProofs({ makeClient, log = () => {} }) {
  let failures = 0;
  const check = (cond, label) => {
    if (cond) log(`  ok  ${label}`);
    else { failures += 1; log(`  FAIL ${label}`); }
  };
  const a = makeClient();
  const b = makeClient();
  await a.connect();
  await b.connect();

  const owner = randomUUID();
  const actor = randomUUID();
  const campA = randomUUID();
  const campB = randomUUID();
  const opA = randomUUID();
  const opB = randomUUID();
  const createdCalls = [];
  const createdOps = [];

  // Estado ESPERADO compartilhado entre `try` e `finally`.
  let expectedSpent = 0;
  let expectedCap = null;

  let snapshot;
  try {
    snapshot = (await a.query("select * from public.product_1_1_pilot_spend_state where id = true")).rows[0];
    expectedSpent = Number(snapshot.spent_usd ?? 0);
    // Default dos campos de TETO = snapshot (caso uma falha intermediária ocorra
    // ANTES de qualquer set_cap confirmado); atualizado após cada set_cap.
    expectedCap = {
      cap_usd: snapshot.cap_usd,
      cap_set_by: snapshot.cap_set_by,
      cap_reason: snapshot.cap_reason,
      cap_operation_id: snapshot.cap_operation_id,
      cap_set_at: snapshot.cap_set_at,
    };

    // (C1) nasce não configurado
    check(snapshot.cap_usd === null || snapshot.cap_usd === undefined, "estado inicial capturado");

    // (C2) sem cap ⇒ recusa
    const c0 = randomUUID();
    createdCalls.push(c0);
    const r0 = await callBegin(a, { campaignId: campA, operationId: opA, callId: c0, kind: "image_primary", attemptSeq: 1, estimatedUsd: 1, ownerToken: owner });
    check(!r0.ok && r0.message.includes("pilot_cap_not_configured"), "sem cap ⇒ pilot_cap_not_configured");

    // (C3) set_cap: A, B, replay A (não reaplica), divergente ⇒ conflito
    const opA1 = randomUUID();
    const opB1 = randomUUID();
    createdOps.push(opA1, opB1);
    const readCap = async () =>
      (await a.query(
        "select cap_usd, cap_set_by, cap_reason, cap_operation_id, cap_set_at from public.product_1_1_pilot_spend_state where id = true",
      )).rows[0];
    // Estado esperado dos campos de TETO = atualizado IMEDIATAMENTE após CADA mutação
    // confirmada (se a 2ª falhar, o esperado reflete a 1ª).
    await a.query("select public.product_1_1_pilot_set_cap($1,$2,$3,$4)", [actor, 1.0, "A", opA1]);
    expectedCap = await readCap();
    await a.query("select public.product_1_1_pilot_set_cap($1,$2,$3,$4)", [actor, 5.0, "B", opB1]);
    expectedCap = await readCap();
    const replay = await a.query("select public.product_1_1_pilot_set_cap($1,$2,$3,$4) as r", [actor, 1.0, "A", opA1]);
    const capNow = await a.query("select cap_usd from public.product_1_1_pilot_spend_state where id = true");
    check(replay.rows[0].r.idempotent === true, "replay de A ⇒ idempotent");
    check(Number(capNow.rows[0].cap_usd) === 5.0, "replay de A NÃO reaplica teto antigo (segue 5.0)");
    const conflict = await a.query("select public.product_1_1_pilot_set_cap($1,$2,$3,$4) as r", [actor, 9.9, "x", opA1]);
    check(conflict.rows[0].r.conflict === true, "operation_id divergente ⇒ conflito");

    // (A) begin × begin com barreira
    const cA = randomUUID();
    createdCalls.push(cA);
    await a.query("begin");
    const acqA = await callBegin(a, { campaignId: campA, operationId: opA, callId: cA, kind: "image_primary", attemptSeq: 1, estimatedUsd: 0.3, ownerToken: owner });
    check(acqA.ok && acqA.value.outcome === "acquired", "A adquiriu (segura a trava)");
    if (acqA.ok && acqA.value.outcome === "acquired") expectedSpent += 0.3;
    const bPid = await backendPid(b);
    const bPromise = callBegin(b, { campaignId: campB, operationId: opB, callId: randomUUID(), kind: "image_primary", attemptSeq: 1, estimatedUsd: 0.1, ownerToken: owner });
    const waited = await waitForAdvisoryLockWait(a, bPid);
    check(waited, "B AGUARDA a trava advisory (pg_stat_activity)");
    await a.query("commit");
    const bResult = await bPromise;
    check(!bResult.ok && bResult.message.includes("pilot_busy"), "após liberar, B ⇒ pilot_busy");

    // (B) mark_unknown × begin
    const cU = randomUUID();
    createdCalls.push(cU);
    const acqU = await callBegin(a, { campaignId: campA, operationId: opA, callId: cU, kind: "copy_initial", attemptSeq: 1, estimatedUsd: 0.2, ownerToken: owner });
    check(acqU.ok && acqU.value.outcome === "acquired", "cU adquirida (verificada)");
    if (acqU.ok && acqU.value.outcome === "acquired") expectedSpent += 0.2;
    await a.query("begin");
    await a.query("select public.product_1_1_pilot_mark_unknown($1,$2,$3)", [cU, owner, "timeout"]);
    const bPid2 = await backendPid(b);
    const bPromise2 = callBegin(b, { campaignId: campB, operationId: opB, callId: randomUUID(), kind: "copy_manual", attemptSeq: 2, estimatedUsd: 0.2, ownerToken: owner });
    const waited2 = await waitForAdvisoryLockWait(a, bPid2);
    check(waited2, "B aguarda mark_unknown (trava comum)");
    await a.query("commit");
    const bResult2 = await bPromise2;
    check(!bResult2.ok && bResult2.message.includes("pilot_requires_reconciliation"), "begin após mark_unknown ⇒ requires_reconciliation");
    await a.query("select public.product_1_1_pilot_reconcile_unknown($1,$2,$3,$4,$5)", [actor, cU, "keep_accounted_release", "prova", randomUUID()]);

    // (C4) end(NULL) mantém o acumulado
    const cE = randomUUID();
    createdCalls.push(cE);
    const acqE = await callBegin(a, { campaignId: campA, operationId: opA, callId: cE, kind: "copy_manual", attemptSeq: 3, estimatedUsd: 0.25, ownerToken: owner });
    check(acqE.ok && acqE.value.outcome === "acquired", "cE adquirida (verificada)");
    if (acqE.ok && acqE.value.outcome === "acquired") expectedSpent += 0.25;
    const spentBefore = await a.query("select spent_usd from public.product_1_1_pilot_spend_state where id = true");
    await a.query("select public.product_1_1_pilot_end_paid_call($1,$2,$3)", [cE, owner, null]);
    const spentAfter = await a.query("select spent_usd from public.product_1_1_pilot_spend_state where id = true");
    check(Number(spentAfter.rows[0].spent_usd) === Number(spentBefore.rows[0].spent_usd), "end(NULL) mantém o acumulado (antes/depois)");
  } catch (error) {
    failures += 1;
    log(`  FAIL passo intermediario: ${String(error?.message ?? error)}`);
  } finally {
    // VERIFICAÇÃO + RESTAURAÇÃO ATÔMICA sob a trava comum (bloqueante se divergir).
    try {
      await a.query("rollback").catch(() => undefined);
      await b.query("rollback").catch(() => undefined);

      await a.query("begin");
      await a.query("select pg_advisory_xact_lock(hashtext('product_1_1_pilot_spend'))");
      const current = (await a.query("select * from public.product_1_1_pilot_spend_state where id = true")).rows[0];
      const expected = {
        cap_usd: expectedCap?.cap_usd ?? snapshot?.cap_usd ?? null,
        cap_set_by: expectedCap?.cap_set_by ?? snapshot?.cap_set_by ?? null,
        cap_reason: expectedCap?.cap_reason ?? snapshot?.cap_reason ?? null,
        cap_operation_id: expectedCap?.cap_operation_id ?? snapshot?.cap_operation_id ?? null,
        cap_set_at: expectedCap?.cap_set_at ?? snapshot?.cap_set_at ?? null,
        spent_usd: expectedSpent,
        blocked_reason: null,
        blocked_at: null,
      };
      const verdict = classifyPreservation({ current, expected });
      if (!verdict.ok) {
        await a.query("rollback");
        failures += 1;
        log(`PROOFS: divergência externa (${verdict.reason}) — NÃO restaurado; verifique manualmente`);
      } else {
        await a.query("delete from public.product_1_1_pilot_paid_calls where campaign_id = any($1::uuid[]) or call_id = any($2::uuid[])", [[campA, campB], createdCalls]);
        await a.query("delete from public.product_1_1_pilot_blocked_calls where call_id = any($1::uuid[])", [createdCalls]);
        if (createdOps.length) {
          await a.query("delete from public.product_1_1_pilot_cap_audit where operation_id = any($1::uuid[])", [createdOps]);
        }
        await a.query(
          "update public.product_1_1_pilot_spend_state set cap_usd=$1, spent_usd=$2, cap_set_by=$3, cap_reason=$4, cap_operation_id=$5, cap_set_at=$6, blocked_reason=$7, blocked_at=$8, updated_at=$9 where id=true",
          [snapshot.cap_usd, snapshot.spent_usd, snapshot.cap_set_by, snapshot.cap_reason, snapshot.cap_operation_id, snapshot.cap_set_at, snapshot.blocked_reason, snapshot.blocked_at, snapshot.updated_at],
        );
        await a.query("commit");
      }
    } catch (cleanupError) {
      await a.query("rollback").catch(() => undefined);
      failures += 1;
      log(`PROOFS: FALHA NA VERIFICAÇÃO/RESTAURAÇÃO (bloqueante): ${String(cleanupError?.message ?? cleanupError)}`);
    }
    await a.end().catch(() => undefined);
    await b.end().catch(() => undefined);
  }
  return { failures };
}

async function main() {
  assertLocalDestination(CONN);
  const result = await runProofs({ makeClient: () => new Client({ connectionString: CONN }), log: (m) => console.log(m) });
  console.log(result.failures === 0 ? "\nPROOFS: PASS" : `\nPROOFS: ${result.failures} FAIL`);
  process.exitCode = result.failures === 0 ? 0 : 1;
}

const isDirect =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  main().catch((error) => {
    console.error("PROOFS: ERROR", error);
    process.exitCode = 1;
  });
}
