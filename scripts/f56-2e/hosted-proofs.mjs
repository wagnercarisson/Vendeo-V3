#!/usr/bin/env node
/**
 * F56.2e (56.2.7) - harness das provas hospedadas 5.3 e 5.7.
 *
 * - 5.3: sonda o Storage no caminho deterministico (nao apenas a tabela),
 *   captura epoch antes da sonda, exige PF completo, encerra e REPETE para
 *   comprovar estorno unico.
 * - 5.7: exige operacao `delivered` ANTES do redeploy; compara bytes/tamanho/
 *   hash antes/depois, eventos e transacoes, e repete o replay.
 * - `--check` e read-only. `--execute` exige `--confirm=EXECUTE`.
 * - NUNCA imprime segredos.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const { Client } = pg;
const BUCKET = "campaign-images";

export function artifactStoragePath(store, campaign, operation) {
  return `${store}/${campaign}/product-1-1/${operation}/art-1024.jpg`;
}

export function classifyObjectResponse(status, body) {
  const message = String(body?.message ?? "");
  const statusCode = String(body?.statusCode ?? "");
  if (status === 200) return { kind: "integral" };
  if (
    (status === 404 || statusCode === "404") &&
    !/bucket/i.test(message) &&
    (/object not found/i.test(message) || /object does not exist/i.test(message))
  ) {
    return { kind: "absent" };
  }
  return { kind: "indeterminate", status };
}

export function classifyExecutionError(error) {
  return error instanceof Error ? error.message : String(error);
}

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

function requireUuid(label, value) {
  assert.match(value ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, `${label} invalido`);
}

function httpBase() {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.ok(base, "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ausente");
  return base.replace(/\/$/, "");
}

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(key, "SUPABASE_SERVICE_ROLE_KEY ausente");
  return key;
}

async function storageObject(storagePath) {
  const url = `${httpBase()}/storage/v1/object/${BUCKET}/${storagePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const key = serviceKey();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (response.status === 200) {
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      kind: "integral",
      bytes,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  const body = await response.json().catch(() => null);
  const classified = classifyObjectResponse(response.status, body);
  return classified.kind === "integral" ? classified : { ...classified, bytes: null };
}

async function counts(client, campaign, operation) {
  const q = async (sql, params) => (await client.query(sql, params)).rows[0].n;
  return {
    generationEvents: await q("SELECT count(*)::int AS n FROM public.generation_events WHERE campaign_id = $1", [campaign]),
    creditTransactions: await q("SELECT count(*)::int AS n FROM public.credit_transactions WHERE campaign_id = $1", [campaign]),
    paidCalls: await q("SELECT count(*)::int AS n FROM public.product_1_1_pilot_paid_calls WHERE campaign_id = $1 AND operation_id = $2", [campaign, operation]),
  };
}

async function main() {
  const kind = arg("kind");
  const campaign = arg("campaign");
  const operation = arg("operation");
  const store = arg("store");
  const redeployAt = arg("redeploy-at");
  const check = hasFlag("check");
  const execute = hasFlag("execute");
  const confirm = arg("confirm");

  assert.ok(["5.3", "5.7"].includes(kind), "--kind deve ser 5.3 ou 5.7");
  requireUuid("--campaign", campaign);
  requireUuid("--operation", operation);
  requireUuid("--store", store);
  assert.ok(check || execute, "use --check ou --execute");
  assert.ok(!(check && execute), "use --check OU --execute");
  if (execute) assert.equal(confirm, "EXECUTE", "--execute exige --confirm=EXECUTE");
  if (kind === "5.7") assert.ok(redeployAt, "5.7 exige --redeploy-at=<ISO>");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  try {
    const storeRow = await client.query(
      "SELECT id, is_test_store FROM public.stores WHERE id = $1",
      [store],
    );
    assert.equal(storeRow.rowCount, 1, "loja nao encontrada");
    assert.equal(storeRow.rows[0].is_test_store, true, "loja nao e is_test_store=true");

    const op = await client.query(
      `SELECT status, publication_state, publication_token::text AS token, state_epoch,
              credit_tx_id, refund_tx_id, store_id, updated_at
         FROM public.product_1_1_campaign_credit_operations
        WHERE campaign_id = $1 AND operation_id = $2`,
      [campaign, operation],
    );
    assert.equal(op.rowCount, 1, "operacao nao encontrada");
    const row = op.rows[0];
    assert.equal(row.store_id, store, "operacao nao pertence a loja informada");

    const artifact = await client.query(
      "SELECT storage_path, created_at FROM public.product_1_1_campaign_artifacts WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operation],
    );
    const storagePath = artifact.rows[0]?.storage_path ?? artifactStoragePath(store, campaign, operation);

    if (kind === "5.7") {
      assert.equal(row.status, "delivered", "5.7 exige operacao delivered ANTES do redeploy");
      assert.ok(redeployAt, "redeploy-at ausente");
      assert.ok(artifact.rowCount === 1, "5.7 exige arte persistida");
      const deliveredAt = new Date(row.updated_at).getTime();
      const artifactAt = new Date(artifact.rows[0].created_at).getTime();
      const redeployMs = new Date(redeployAt).getTime();
      assert.ok(Number.isFinite(redeployMs), "redeploy-at invalido");
      assert.ok(deliveredAt < redeployMs, "operacao deve estar delivered ANTES do redeploy");
      assert.ok(artifactAt < redeployMs, "arte deve existir ANTES do redeploy");

      const beforeObject = await storageObject(storagePath);
      assert.equal(beforeObject.kind, "integral", "arte deve estar integral antes do replay");
      const beforeCounts = await counts(client, campaign, operation);

      if (check) {
        console.log(JSON.stringify({
          kind, mode: "check", status: row.status, storagePath,
          artifact: { size: beforeObject.size, sha256: beforeObject.sha256 },
          counts: beforeCounts,
          note: "art_uploaded NAO e PASS para 5.7",
        }));
        return;
      }

      const first = await client.query(
        "SELECT public.product_1_1_deliver_campaign_credit_operation($1::uuid, $2::uuid, $3::uuid) AS r",
        [campaign, operation, row.token],
      );
      const afterObject = await storageObject(storagePath);
      const afterCounts = await counts(client, campaign, operation);
      const second = await client.query(
        "SELECT public.product_1_1_deliver_campaign_credit_operation($1::uuid, $2::uuid, $3::uuid) AS r",
        [campaign, operation, row.token],
      );
      const afterSecondCounts = await counts(client, campaign, operation);

      assert.equal(first.rows[0].r.idempotent, true, "1o replay 5.7 deve ser idempotente");
      assert.equal(second.rows[0].r.idempotent, true, "2o replay 5.7 deve ser idempotente");
      assert.equal(afterObject.kind, "integral", "arte deve permanecer integral");
      assert.equal(afterObject.sha256, beforeObject.sha256, "hash da arte deve permanecer igual");
      assert.equal(afterObject.size, beforeObject.size, "tamanho da arte deve permanecer igual");
      assert.deepEqual(afterCounts, beforeCounts, "eventos/transacoes/paid calls nao podem mudar");
      assert.deepEqual(afterSecondCounts, beforeCounts, "segundo replay nao pode gerar efeitos");
      console.log(JSON.stringify({
        kind, mode: "execute", status: "delivered",
        artifact: { size: afterObject.size, sha256: afterObject.sha256 },
        counts: afterCounts, replays: 2,
      }));
      return;
    }

    assert.ok(["reserved", "art_uploaded"].includes(row.status), "5.3 exige operacao nao terminal");
    assert.ok(!["in_flight", "result_unknown", "published"].includes(row.publication_state), "5.3 exige publicacao nao ativa/publicada");
    assert.equal(row.refund_tx_id, null, "5.3 exige operacao ainda nao estornada");
    assert.equal(artifact.rowCount, 0, "5.3 exige ausencia de registro de arte (nao basta sozinho)");

    const claims = await client.query(
      "SELECT count(*)::int AS n FROM public.product_1_1_generation_attempt_claims WHERE campaign_id = $1 AND operation_id = $2 AND status = 'in_progress'",
      [campaign, operation],
    );
    assert.equal(claims.rows[0].n, 0, "5.3 exige nenhum claim in_progress (PF)");
    const outcome = await client.query(
      "SELECT 1 FROM public.product_1_1_generation_outcomes WHERE campaign_id = $1 AND operation_id = $2 AND outcome = 'failed'",
      [campaign, operation],
    );
    assert.equal(outcome.rowCount, 1, "5.3 exige outcome failed persistido (PF)");

    // Frescor: captura o epoch ANTES de sondar o Storage.
    const observedEpoch = Number(row.state_epoch);
    const probe = await storageObject(storagePath);
    assert.equal(probe.kind, "absent", `5.3 exige ausencia CONFIRMADA no Storage (recebido: ${probe.kind})`);

    const refundReference = `p1_1_refund_${campaign}_${operation}`;
    const refundBefore = await client.query(
      "SELECT count(*)::int AS n FROM public.credit_transactions WHERE reference = $1",
      [refundReference],
    );
    assert.equal(refundBefore.rows[0].n, 0, "5.3 exige zero estorno antes");

    if (check) {
      console.log(JSON.stringify({
        kind, mode: "check", status: row.status, storagePath,
        probe: probe.kind, observedEpoch, refunds: refundBefore.rows[0].n,
        note: "execucao exige --execute --confirm=EXECUTE",
      }));
      return;
    }

    const first = await client.query(
      "SELECT public.product_1_1_close_failed_operation($1::uuid, $2::uuid, $3, $4::int, $5) AS r",
      [campaign, operation, "absent", observedEpoch, "F56.2e hosted proof 5.3"],
    );
    assert.equal(first.rows[0].r.success, true);
    assert.equal(first.rows[0].r.status, "refunded");
    assert.equal(first.rows[0].r.idempotent, false, "1o encerramento deve aplicar o estorno");

    const refundAfter = await client.query(
      "SELECT count(*)::int AS n FROM public.credit_transactions WHERE reference = $1",
      [refundReference],
    );
    assert.equal(refundAfter.rows[0].n, 1, "5.3 exige exatamente um estorno");

    const replay = await client.query(
      "SELECT public.product_1_1_close_failed_operation($1::uuid, $2::uuid, $3, $4::int, $5) AS r",
      [campaign, operation, "absent", observedEpoch, "F56.2e hosted proof 5.3"],
    );
    assert.equal(replay.rows[0].r.idempotent, true, "replay 5.3 deve ser idempotente");
    assert.equal(replay.rows[0].r.status, "refunded");
    const refundAfterReplay = await client.query(
      "SELECT count(*)::int AS n FROM public.credit_transactions WHERE reference = $1",
      [refundReference],
    );
    assert.equal(refundAfterReplay.rows[0].n, 1, "replay nao pode criar segundo estorno");

    console.log(JSON.stringify({
      kind, mode: "execute", status: "refunded", storagePath,
      probe: probe.kind, observedEpoch, refunds: refundAfter.rows[0].n, replayIdempotent: true,
    }));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("FAIL f56-2e hosted proof:", classifyExecutionError(error));
    process.exit(1);
  });
}
