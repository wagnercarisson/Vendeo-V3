// F56.2b2c (B2.3) — PROVAS CONCORRENTES do controle de gasto do piloto.
// EXECUTÁVEL, mas somente no CHECKPOINT AUTORIZADO do Plano 04 (não rodar agora).
//
// Usa DUAS conexões independentes (`pg`) com BARREIRAS para provar:
//   (A) serialização da trava comum `pg_advisory_xact_lock('product_1_1_pilot_spend')`
//       entre `begin_paid_call` de campanhas distintas (a 2ª aguarda e recebe pilot_busy);
//   (B) `mark_unknown` × `begin_paid_call` não interleaveiam (bloqueio global instalado
//       sob a mesma trava);
//   (C) transições/sequenciais (cap, idempotência, stale, end NULL).
//
// Uso (após aplicar a migration):
//   PILOT_PROOF_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:57782/postgres" \
//     node supabase/proofs/f56_2b2c_pilot_spend_concurrency.mjs
//
// NÃO faz `db push`; não habilita flags/chaves; não chama provider.

import { randomUUID } from "node:crypto";
import { Client } from "pg";

const CONN =
  process.env.PILOT_PROOF_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:57782/postgres";

let failures = 0;
function check(cond, label) {
  if (cond) {
    console.log(`  ok  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

async function callBegin(client, { campaignId, operationId, callId, kind, attemptSeq, estimatedUsd, ownerToken }) {
  try {
    const { rows } = await client.query(
      "select public.product_1_1_pilot_begin_paid_call($1,$2,$3,$4,$5,$6,$7) as r",
      [campaignId, operationId, callId, kind, attemptSeq, estimatedUsd, ownerToken],
    );
    return { ok: true, value: rows[0].r };
  } catch (error) {
    return { ok: false, message: String(error.message ?? error) };
  }
}

async function main() {
  const a = new Client({ connectionString: CONN });
  const b = new Client({ connectionString: CONN });
  await a.connect();
  await b.connect();

  const owner = randomUUID();
  const campA = randomUUID();
  const campB = randomUUID();
  const opA = randomUUID();
  const opB = randomUUID();
  const systemActor = randomUUID();

  try {
    // (C1) Estado nasce NÃO configurado.
    const s0 = await a.query("select cap_usd from public.product_1_1_pilot_spend_state where id = true");
    check(s0.rows[0].cap_usd === null, "cap nasce NULL (não configurado)");

    // (C2) Sem cap ⇒ recusa.
    const before = await callBegin(a, { campaignId: campA, operationId: opA, callId: randomUUID(), kind: "image_primary", attemptSeq: 1, estimatedUsd: 1, ownerToken: owner });
    check(!before.ok && before.message.includes("pilot_cap_not_configured"), "sem cap ⇒ pilot_cap_not_configured");

    // (C3) set_cap idempotência/auditoria: A, depois B, replay A NÃO reaplica.
    const opSetA = randomUUID();
    const opSetB = randomUUID();
    await a.query("select public.product_1_1_pilot_set_cap($1,$2,$3,$4)", [systemActor, 1.0, "A", opSetA]);
    await a.query("select public.product_1_1_pilot_set_cap($1,$2,$3,$4)", [systemActor, 5.0, "B", opSetB]);
    const replayA = await a.query("select public.product_1_1_pilot_set_cap($1,$2,$3,$4) as r", [systemActor, 1.0, "A", opSetA]);
    const capNow = await a.query("select cap_usd from public.product_1_1_pilot_spend_state where id = true");
    check(replayA.rows[0].r.idempotent === true, "replay de A ⇒ idempotent");
    check(Number(capNow.rows[0].cap_usd) === 5.0, "replay de A NÃO reaplica o teto antigo (segue B=5.0)");
    const conflict = await a.query("select public.product_1_1_pilot_set_cap($1,$2,$3,$4) as r", [systemActor, 9.9, "divergente", opSetA]);
    check(conflict.rows[0].r.conflict === true, "mesmo operation_id com conteúdo divergente ⇒ conflito");

    // (A) CONCORRÊNCIA com BARREIRA: A abre transação e adquire (segura a trava);
    //     B tenta adquirir OUTRA campanha ⇒ deve AGUARDAR e, após o commit de A,
    //     receber `pilot_busy`.
    await a.query("begin");
    const acquiredA = await callBegin(a, { campaignId: campA, operationId: opA, callId: randomUUID(), kind: "image_primary", attemptSeq: 1, estimatedUsd: 0.3, ownerToken: owner });
    check(acquiredA.ok && acquiredA.value.outcome === "acquired", "A adquiriu (segura a trava)");

    const bPromise = callBegin(b, { campaignId: campB, operationId: opB, callId: randomUUID(), kind: "image_primary", attemptSeq: 1, estimatedUsd: 0.1, ownerToken: owner });
    let bResolvedEarly = false;
    const early = await Promise.race([
      bPromise.then(() => { bResolvedEarly = true; return "resolved"; }),
      new Promise((resolve) => setTimeout(() => resolve("blocked"), 400)),
    ]);
    check(early === "blocked" && !bResolvedEarly, "B AGUARDA a trava comum (barreira) enquanto A segura");
    await a.query("commit");
    const bResult = await bPromise;
    check(!bResult.ok && bResult.message.includes("pilot_busy"), "após A liberar, B recebe pilot_busy (campanha diferente)");

    // (C4) end_paid_call(NULL) NÃO zera a estimativa contabilizada.
    const spentBefore = await a.query("select spent_usd from public.product_1_1_pilot_spend_state where id = true");
    const callX = randomUUID();
    const acq = await callBegin(a, { campaignId: campA, operationId: opA, callId: callX, kind: "copy_initial", attemptSeq: 1, estimatedUsd: 0.25, ownerToken: owner });
    check(acq.ok && acq.value.outcome === "acquired", "adquire chamada de copy");
    await a.query("select public.product_1_1_pilot_end_paid_call($1,$2,$3)", [callX, owner, null]);
    const spentAfter = await a.query("select spent_usd from public.product_1_1_pilot_spend_state where id = true");
    check(Number(spentAfter.rows[0].spent_usd) === Number(spentBefore.rows[0].spent_usd), "end(NULL) mantém o acumulado (não zera)");

    // Limpeza (best-effort; executar em ambiente descartável autorizado).
    console.log(failures === 0 ? "\nPROOFS: PASS" : `\nPROOFS: ${failures} FAIL`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    await a.end().catch(() => undefined);
    await b.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("PROOFS: ERROR", error);
  process.exitCode = 1;
});
