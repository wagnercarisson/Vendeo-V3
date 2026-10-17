// F56.2b2c (B2.3) — PROVAS da AUTORIZAÇÃO ESTREITA (execução real na vendeo-homolog).
// Concessão estreita / recusas / replay / conflito / revogação; revogação garantida no
// fim (inclusive em falha). Flags permanecem false; geração pausada; sem provider.
// Segurança: valida destino LOCAL + identidade via env; NUNCA imprime credenciais.

import { randomUUID } from "node:crypto";
import { Client } from "pg";

const CONN =
  process.env.PILOT_PROOF_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:57782/postgres";
const INSTANCE = process.env.PILOT_PROOF_INSTANCE_IDENTITY ?? "127.0.0.1:57781";

function assertLocal(conn) {
  if (process.env.PILOT_PROOF_IDENTITY !== "vendeo-homolog")
    throw new Error('defina PILOT_PROOF_IDENTITY="vendeo-homolog"');
  const url = new URL(conn);
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname))
    throw new Error(`destino NÃO-LOCAL recusado (${url.hostname})`);
  const port = url.port ? Number(url.port) : 5432;
  if (port !== Number(process.env.PILOT_PROOF_PORT ?? "57782"))
    throw new Error(`porta ${port} ≠ 57782`);
}

let failures = 0;
const check = (cond, label) => {
  if (cond) console.log(`  ok  ${label}`);
  else { failures += 1; console.error(`  FAIL ${label}`); }
};

async function grant(client, p) {
  try {
    const { rows } = await client.query(
      "select public.admin_grant_product_flow_stage_authorization($1,$2,$3,$4,$5,$6) as r",
      [p.actor, p.stage, p.scope, INSTANCE, p.reason, p.operationId],
    );
    return { ok: true, r: rows[0].r };
  } catch (e) { return { ok: false, message: String(e.message ?? e) }; }
}
async function revoke(client, p) {
  const { rows } = await client.query(
    "select public.admin_revoke_product_flow_stage_authorization($1,$2,$3,$4,$5) as r",
    [p.actor, p.scope, INSTANCE, p.reason, p.operationId],
  );
  return rows[0].r;
}

async function main() {
  assertLocal(CONN);
  const c = new Client({ connectionString: CONN });
  await c.connect();
  const revokeOps = [];
  try {
    // Ator ADMINISTRATIVO legítimo.
    const admin = (await c.query("select user_id from public.admin_users limit 1")).rows[0];
    if (!admin) throw new Error("sem admin_users");
    const actor = admin.user_id;

    const opGrant = randomUUID();
    const opRefuseStage = randomUUID();
    const opRefuseAll = randomUUID();
    const opRefuseMixed = randomUUID();
    const reason = "prova autorizacao estreita B2.3";

    // (1) Concessão estreita
    const g1 = await grant(c, { actor, stage: "isolated_pilot", scope: "test_stores", reason, operationId: opGrant });
    check(g1.ok && g1.r.granted === true && g1.r.stage === "isolated_pilot" && g1.r.scope === "test_stores", "concede isolated_pilot + test_stores (granted)");

    // (2) Recusa de estágio test_stores
    const g2 = await grant(c, { actor, stage: "test_stores", scope: "test_stores", reason, operationId: opRefuseStage });
    check(g2.ok && g2.r.refused === true && g2.r.reason === "operational_activation_blocked_in_b1a", "recusa estágio test_stores");

    // (3) Recusa de all_stores (estágio)
    const g3 = await grant(c, { actor, stage: "all_stores", scope: "all_stores", reason, operationId: opRefuseAll });
    check(g3.ok && g3.r.refused === true, "recusa all_stores");

    // (4) Recusa isolated_pilot + escopo all_stores
    const g4 = await grant(c, { actor, stage: "isolated_pilot", scope: "all_stores", reason, operationId: opRefuseMixed });
    check(g4.ok && g4.r.refused === true, "recusa isolated_pilot + all_stores (barreira geral)");

    // (5) Replay do MESMO operation_id + mesmo conteúdo ⇒ idempotent
    const g5 = await grant(c, { actor, stage: "isolated_pilot", scope: "test_stores", reason, operationId: opGrant });
    check(g5.ok && g5.r.idempotent === true && g5.r.granted === true, "replay da concessão ⇒ idempotent");

    // (6) Conflito: mesmo operation_id, conteúdo divergente
    const g6 = await grant(c, { actor, stage: "isolated_pilot", scope: "test_stores", reason: "divergente", operationId: opGrant });
    check(g6.ok && g6.r.conflict === true && g6.r.reason === "operation_id_conflict", "operation_id divergente ⇒ conflito");

    // (7) Revogação encerra
    const opRevoke = randomUUID();
    revokeOps.push(opRevoke);
    const rv = await revoke(c, { actor, scope: "test_stores", reason: "encerrar prova", operationId: opRevoke });
    check(rv.revoked === true && rv.stage === "off", "revogação ⇒ revoked/off");

    // (8) Estado OPERACIONAL final nega habilitação (nenhum evento 'granted' não-off VIGENTE:
    //     o último evento do escopo/instância é 'revoked').
    const last = (await c.query(
      "select event_type, stage from public.product_flow_stage_authorizations where scope='test_stores' and instance_identity=$1 order by seq desc limit 1",
      [INSTANCE],
    )).rows[0];
    check(last && last.event_type === "revoked", "decisão final: último evento = revoked (nega habilitação)");
  } finally {
    // Revogação GARANTIDA (mesmo em falha) — idempotente por operation_id próprio.
    try {
      const admin = (await c.query("select user_id from public.admin_users limit 1")).rows[0];
      const op = randomUUID();
      await revoke(c, { actor: admin?.user_id, scope: "test_stores", reason: "garantia de off (finally)", operationId: op });
    } catch (e) { console.error("aviso: revogação de garantia falhou", String(e?.message ?? e)); }
    await c.end().catch(() => undefined);
  }
  console.log(failures === 0 ? "\nAUTH_PROOFS: PASS" : `\nAUTH_PROOFS: ${failures} FAIL`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => { console.error("AUTH_PROOFS: ERROR", e); process.exitCode = 1; });
