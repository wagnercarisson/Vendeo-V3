#!/usr/bin/env node
/**
 * F56.2e (56.2.7) - harness das provas hospedadas 5.3 e 5.7.
 *
 * Uso:
 *   node scripts/f56-2e/hosted-proofs.mjs --check --kind=5.7 --campaign=<uuid> --operation=<uuid> --store=<uuid>
 *   node scripts/f56-2e/hosted-proofs.mjs --execute --confirm=EXECUTE --kind=5.7 ...
 *
 * - 5.7 exige operacao `delivered` ANTES do redeploy; `art_uploaded` nao e PASS.
 * - 5.3 exige loja de teste, operacao nao terminal, ausencia de arte e falha
 *   persistida; executa `close_failed_operation` com `absent`.
 * - NUNCA imprime DATABASE_URL, tokens ou segredos.
 * - `--check` e read-only. `--execute` exige `--confirm=EXECUTE`.
 */
import assert from "node:assert/strict";
import pg from "pg";

const { Client } = pg;

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const kind = arg("kind");
const campaign = arg("campaign");
const operation = arg("operation");
const store = arg("store");
const check = hasFlag("check");
const execute = hasFlag("execute");
const confirm = arg("confirm");

function requireUuid(label, value) {
  assert.match(value ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, `${label} invalido`);
}

async function main() {
  assert.ok(["5.3", "5.7"].includes(kind), "--kind deve ser 5.3 ou 5.7");
  requireUuid("--campaign", campaign);
  requireUuid("--operation", operation);
  requireUuid("--store", store);
  assert.ok(check || execute, "use --check ou --execute");
  assert.ok(!(check && execute), "use --check OU --execute");
  if (execute) assert.equal(confirm, "EXECUTE", "--execute exige --confirm=EXECUTE");

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
      `SELECT status, publication_state, publication_token::text AS token, state_epoch, store_id
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

    if (kind === "5.7") {
      assert.equal(row.status, "delivered", "5.7 exige operacao delivered ANTES do redeploy");
      if (check) {
        console.log(JSON.stringify({
          kind, mode: "check", status: row.status, publicationState: row.publication_state,
          artifactPath: artifact.rows[0]?.storage_path ?? null,
          note: "art_uploaded NAO e PASS para 5.7",
        }));
        return;
      }
      const before = await client.query(
        "SELECT count(*)::int AS n FROM public.product_1_1_campaign_credit_operations WHERE campaign_id = $1",
        [campaign],
      );
      const result = await client.query(
        "SELECT public.product_1_1_deliver_campaign_credit_operation($1::uuid, $2::uuid, $3::uuid) AS r",
        [campaign, operation, row.token],
      );
      const after = await client.query(
        "SELECT count(*)::int AS n FROM public.product_1_1_campaign_credit_operations WHERE campaign_id = $1",
        [campaign],
      );
      const r = result.rows[0].r;
      assert.equal(r.idempotent, true, "replay 5.7 deve ser idempotente");
      assert.equal(after.rows[0].n, before.rows[0].n, "replay nao cria nova operacao");
      console.log(JSON.stringify({ kind, mode: "execute", result: r, artifactPath: artifact.rows[0]?.storage_path ?? null }));
      return;
    }

    assert.ok(["reserved", "art_uploaded"].includes(row.status), "5.3 exige operacao nao terminal");
    assert.equal(artifact.rowCount, 0, "5.3 exige ausencia de arte persistida");
    if (check) {
      console.log(JSON.stringify({
        kind, mode: "check", status: row.status, publicationState: row.publication_state,
        artifactAbsent: true, note: "execucao exige --execute --confirm=EXECUTE",
      }));
      return;
    }
    const result = await client.query(
      "SELECT public.product_1_1_close_failed_operation($1::uuid, $2::uuid, $3, $4::int, $5) AS r",
      [campaign, operation, "absent", Number(row.state_epoch), "F56.2e hosted proof 5.3"],
    );
    const r = result.rows[0].r;
    assert.equal(r.success, true, "fechamento 5.3 deve ter sucesso");
    assert.equal(r.status, "refunded", "5.3 deve resultar em refunded");
    console.log(JSON.stringify({ kind, mode: "execute", result: r, artifactAbsent: true }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("FAIL f56-2e hosted proof:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
