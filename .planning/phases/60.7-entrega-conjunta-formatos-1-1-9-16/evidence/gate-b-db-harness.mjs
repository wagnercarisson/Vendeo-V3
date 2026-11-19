#!/usr/bin/env node
/**
 * F60.7 Gate de banco — harness de cenários (SOMENTE homolog local autorizado).
 *
 * Regras aplicadas:
 * - alvo fixo 127.0.0.1:57782/postgres (container supabase_db_vendeo-homolog);
 * - IDs sintéticos com prefixo f607..., nomes "[F60.7 Gate B] ...";
 * - cenários sem concorrência entre sessões: transação + ROLLBACK (sem fixture persistida);
 * - cenários concorrentes: fixtures commitadas, PRESERVADAS e inventariadas;
 * - nenhum DELETE/TRUNCATE, nenhum trigger desabilitado, nenhum provider/Storage;
 * - não acessa produção.
 *
 * Uso:
 *   F607_ONLY=S01,S03 node .planning/.../evidence/gate-b-db-harness.mjs
 *   node .../gate-b-db-harness.mjs            (todos os cenários, na ordem)
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const requireFromRepo = createRequire("C:/Projetos/Vendeo V3/package.json");
const pg = requireFromRepo("pg");

const DATABASE_URL =
  process.env.F607_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:57782/postgres";
const REPO_ROOT = process.env.F607_REPO_ROOT ?? "C:/Projetos/Vendeo V3";
const EVIDENCE_DIR =
  process.env.F607_EVIDENCE_DIR ??
  resolve(
    REPO_ROOT,
    ".planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/evidence",
  );
const RUN_ID = process.env.F607_RUN_ID ?? "f607-gate-b-20261119";
const ONLY = (process.env.F607_ONLY ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const SKIP_SCENARIOS = process.env.F607_SKIP_SCENARIOS === "1";

const MODEL = "gpt-image-2.5-flare";
const MODEL_ALT = "gpt-image-2.5-sunburst";
const QUALITY = "low";
const CONFIG_ID = "f6070008-0000-4000-8000-000000000001";

const SNAPSHOT = {
  campaignFormat: "1:1+9:16",
  formatContractVersion: "f60.7-two-format-v1",
  generationOrigin: "two_format_two_stage",
  generationContractVersion: "f60.7-two-format-v1",
};

function ids(code) {
  if (!/^[0-9a-f]{4}$/.test(code)) throw new Error(`code inválido: ${code}`);
  const suffix = (n) => `f607${code}-0000-4000-8000-${String(n).padStart(12, "0")}`;
  return {
    user: suffix(1),
    store: suffix(2),
    campaign: suffix(3),
    shared: suffix(4),
    square: suffix(5),
    artifact: suffix(6),
    resolution: suffix(7),
    extra: suffix(8),
    extra2: suffix(9),
    extra3: suffix(10),
    code,
  };
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

function assert(condition, message, details) {
  if (!condition) {
    const suffix = details === undefined ? "" : ` :: ${JSON.stringify(details)}`;
    throw new Error(`${message}${suffix}`);
  }
}

function newClient() {
  return new pg.Client({ connectionString: DATABASE_URL });
}

async function q(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

async function one(client, sql, params = []) {
  const rows = await q(client, sql, params);
  return rows[0] ?? null;
}

function sqlArgs(count) {
  return Array.from({ length: count }, (_, index) => `$${index + 1}`).join(", ");
}

async function call(client, fn, params) {
  const rows = await q(
    client,
    `select public.${fn}(${sqlArgs(params.length)}) as result`,
    params,
  );
  return rows[0]?.result ?? null;
}

async function capture(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function attempt(client, fn) {
  await client.query("SAVEPOINT f607_attempt");
  try {
    const value = await fn();
    await client.query("RELEASE SAVEPOINT f607_attempt");
    return { ok: true, value };
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT f607_attempt");
    await client.query("RELEASE SAVEPOINT f607_attempt");
    return { ok: false, error: error.message };
  }
}

async function createFixture(client, code, label, options = {}) {
  const fixture = {
    ...ids(code),
    label,
    configId: CONFIG_ID,
    model: options.model ?? MODEL,
    quality: options.quality ?? QUALITY,
  };
  const name = `[F60.7 Gate B] ${label}`.slice(0, 60);
  await q(
    client,
    `insert into auth.users (id, aud, role, email, created_at, updated_at)
     values ($1, 'authenticated', 'authenticated', $2, now(), now())`,
    [fixture.user, `f607-gate-b-${code}@f607.test`],
  );
  await q(
    client,
    `insert into public.stores (id, user_id, name, segment, is_test_store)
     values ($1, $2, $3, 'variedades-utilidades', true)`,
    [fixture.store, fixture.user, name],
  );
  await q(
    client,
    `insert into public.campaigns
       (id, store_id, status, product_name, input_snapshot, storage_path)
     values ($1, $2, 'generating', $3, $4::jsonb, $5)`,
    [
      fixture.campaign,
      fixture.store,
      `[F60.7 Gate B] ${label}`,
      JSON.stringify(SNAPSHOT),
      `f607/${fixture.campaign}`,
    ],
  );
  await q(
    client,
    `select public.grant_credits($1, $2, '[F60.7 Gate B] grant', $3, '{}'::jsonb)`,
    [fixture.store, options.grant ?? 10, `f607-grant-${fixture.store}`],
  );
  return fixture;
}

async function openJoint(client, fixture, overrides = {}) {
  return call(client, "product_two_format_open_delivery", [
    fixture.store,
    fixture.campaign,
    fixture.shared,
    fixture.square,
    overrides.model ?? fixture.model,
    overrides.quality ?? fixture.quality,
    overrides.configId ?? fixture.configId,
  ]);
}

async function balance(client, storeId) {
  return one(
    client,
    `select balance, bonus_balance, purchased_balance, demo_balance
       from public.credit_balances where store_id = $1`,
    [storeId],
  );
}

async function ledger(client, storeId, campaignId = null) {
  return one(
    client,
    `with scoped as (
       select t.*
         from public.credit_transactions t
        where t.store_id = $1
          and (
            $2::uuid is null
            or (t.type = 'deduction' and t.campaign_id = $2)
            or (t.type = 'refund' and exists (
                 select 1 from public.product_1_1_campaign_credit_operations o
                  where o.campaign_id = $2 and o.credit_tx_id::text = t.reference))
          )
     )
     select
       count(*) filter (where type = 'deduction')::int as deductions,
       count(*) filter (where type = 'refund')::int as refunds,
       coalesce(sum(amount), 0)::int as net
     from scoped`,
    [storeId, campaignId],
  );
}

async function creditState(client, campaignId, operationId) {
  return one(
    client,
    `select status, publication_state, state_epoch, credit_tx_id, refund_tx_id
       from public.product_1_1_campaign_credit_operations
      where campaign_id = $1 and operation_id = $2`,
    [campaignId, operationId],
  );
}

async function campaignState(client, campaignId) {
  return one(
    client,
    `select status, storage_path, error_message
       from public.campaigns where id = $1`,
    [campaignId],
  );
}

async function deliveryLinks(client, campaignId) {
  return q(
    client,
    `select format, operation_id, delivery_operation_id, artifact_role
       from public.product_two_format_deliveries
      where campaign_id = $1 order by format`,
    [campaignId],
  );
}

async function outcomes916(client, campaignId) {
  return q(
    client,
    `select outcome, stage, support_reference
       from public.product_9_16_two_stage_outcomes
      where campaign_id = $1`,
    [campaignId],
  );
}

async function outcomes11(client, campaignId) {
  return q(
    client,
    `select outcome, support_reference
       from public.product_1_1_generation_outcomes
      where campaign_id = $1`,
    [campaignId],
  );
}

async function claims916(client, campaignId) {
  return q(
    client,
    `select stage, attempt_number, target, status, failure_class, attempt_token
       from public.product_9_16_two_stage_attempt_claims
      where campaign_id = $1 order by stage, attempt_number`,
    [campaignId],
  );
}

async function artifactCount(client, campaignId) {
  const row = await one(
    client,
    `select count(*)::int as n from public.campaign_composition_artifacts
      where campaign_id = $1`,
    [campaignId],
  );
  return row.n;
}

async function addArtifact(client, fixture, role, format, width, height, artifactId = fixture.artifact) {
  const path = [
    fixture.store.toLowerCase(),
    fixture.campaign.toLowerCase(),
    fixture.shared.toLowerCase(),
    `${role}.jpg`,
  ].join("/");
  await q(
    client,
    `insert into public.campaign_composition_artifacts
       (id, store_id, campaign_id, operation_id, role, format, origin,
        storage_bucket, storage_path, width, height, mime_type, byte_size,
        checksum_sha256, provenance)
     values ($1, $2, $3, $4, $5, $6, 'deterministic_preparation',
             'campaign-internal-artifacts', $7, $8, $9, 'image/jpeg', 2048,
             $10, '{"source":"f60.7-gate-b"}'::jsonb)`,
    [
      artifactId,
      fixture.store,
      fixture.campaign,
      fixture.shared,
      role,
      format,
      path,
      width,
      height,
      "a".repeat(64),
    ],
  );
  return path;
}

async function beginPublication(client, campaignId, operationId) {
  const result = await call(client, "product_1_1_begin_publication", [
    campaignId,
    operationId,
  ]);
  assert(result?.acquired === true, "publication_not_acquired", result);
  return result.token;
}

async function deliverFormat(client, fixture, format, token) {
  return call(client, "product_two_format_deliver_format", [
    fixture.store,
    fixture.campaign,
    fixture.shared,
    format,
    token,
  ]);
}

async function refundFormat(client, fixture, format, epoch, reason = "two_format_refund") {
  return call(client, "product_two_format_refund_format", [
    fixture.store,
    fixture.campaign,
    fixture.shared,
    format,
    "absent",
    epoch,
    reason,
  ]);
}

async function acquireWithRequest(client, campaignId, operationId, stage, target, requestId) {
  return call(client, "product_9_16_acquire_step", [
    campaignId,
    operationId,
    stage,
    requestId,
    target,
  ]);
}

function requestId(seed, n = 1) {
  const code = String(seed).replace(/^f607/, "").slice(0, 4);
  return `f607${code}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

async function finish(client, campaignId, operationId, token, status, failureClass = null) {
  return call(client, "product_9_16_finish_step", [
    campaignId,
    operationId,
    token,
    "in_progress",
    status,
    failureClass,
  ]);
}

async function recordJointOutcome(client, campaignId, operationId, stage, outcome) {
  return call(client, "product_9_16_record_outcome", [
    campaignId,
    operationId,
    stage,
    outcome,
    `[F60.7 Gate B] ${outcome}`,
  ]);
}

async function recordSquareOutcome(client, campaignId, operationId, outcome) {
  return call(client, "product_1_1_record_generation_outcome", [
    campaignId,
    operationId,
    outcome,
    `[F60.7 Gate B] square ${outcome}`,
  ]);
}

async function epoch(client, campaignId, operationId) {
  return call(client, "product_1_1_get_publication_epoch", [
    campaignId,
    operationId,
  ]);
}

// ---------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------

async function s01(client) {
  const f = await createFixture(client, "0101", "S01");
  const before = await balance(client, f.store);
  const open = await openJoint(client, f);
  assert(open?.success === true && open?.idempotent === false, "open_failed", open);
  assert(open.square_status === "reserved" && open.status === "reserved", "open_status", open);

  const links = await deliveryLinks(client, f.campaign);
  assert(links.length === 2, "links_not_two", links);
  const square = links.find((row) => row.format === "1:1");
  const vertical = links.find((row) => row.format === "9:16");
  assert(square?.delivery_operation_id.toLowerCase() === f.square, "square_link_id", square);
  assert(vertical?.delivery_operation_id.toLowerCase() === f.shared, "vertical_link_id", vertical);

  const squareCredit = await creditState(client, f.campaign, f.square);
  const verticalCredit = await creditState(client, f.campaign, f.shared);
  assert(squareCredit?.status === "reserved", "square_not_reserved", squareCredit);
  assert(verticalCredit?.status === "reserved", "vertical_not_reserved", verticalCredit);

  const after = await balance(client, f.store);
  const led = await ledger(client, f.store, f.campaign);
  assert(led.deductions === 2 && led.net === -2, "ledger_not_two_deductions", led);
  assert(before.balance - after.balance === 2, "balance_not_debited_two", { before, after });

  return { links: links.length, ledger: led, balanceBefore: before.balance, balanceAfter: after.balance };
}

async function s02(client) {
  const f = await createFixture(client, "0201", "S02", { grant: 1 });
  const before = await balance(client, f.store);
  const open = await attempt(client, () => openJoint(client, f));
  assert(open.ok === false, "insufficient_balance_allowed", open);
  assert(
    /credit_reservation_missing_tx|square_credit_reservation_failed/.test(open.error),
    "unexpected_error",
    open.error,
  );

  const links = await deliveryLinks(client, f.campaign);
  const ops = await q(
    client,
    `select operation_id from public.product_1_1_campaign_credit_operations
      where campaign_id = $1`,
    [f.campaign],
  );
  const control = await q(
    client,
    `select operation_id from public.product_9_16_two_stage_operations
      where campaign_id = $1`,
    [f.campaign],
  );
  const after = await balance(client, f.store);
  const led = await ledger(client, f.store, f.campaign);
  assert(links.length === 0 && ops.length === 0 && control.length === 0, "partial_state", {
    links,
    ops,
    control,
  });
  assert(after.balance === before.balance, "balance_changed", { before, after });
  assert(led.deductions === 0, "deduction_left", led);
  return { error: open.error, links: 0, operations: 0, balance: after.balance };
}

async function s03(client) {
  const f = await createFixture(client, "0301", "S03");
  const first = await openJoint(client, f);
  assert(first?.success === true && first.idempotent === false, "first_open_failed", first);
  const replay = await openJoint(client, f);
  assert(replay?.success === true && replay.idempotent === true, "replay_not_idempotent", replay);
  assert(replay.square_delivery_id.toLowerCase() === f.square, "replay_square_id", replay);
  assert(replay.vertical_delivery_operation_id.toLowerCase() === f.shared, "replay_vertical_id", replay);
  assert(replay.expansion_model === first.expansion_model, "replay_selection", replay);
  const led = await ledger(client, f.store, f.campaign);
  assert(led.deductions === 2, "replay_debited_again", led);
  const links = await deliveryLinks(client, f.campaign);
  assert(links.length === 2, "replay_links", links);
  return { idempotent: true, links: 2, ledger: led, model: replay.expansion_model };
}

async function s04(client) {
  const f = await createFixture(client, "0401", "S04");
  const first = await openJoint(client, f);
  assert(first?.success === true, "first_open_failed", first);
  const replay = await openJoint(client, f, { model: MODEL_ALT });
  assert(replay?.success === false, "divergent_replay_accepted", replay);
  assert(replay.reason === "operation_config_conflict", "unexpected_reason", replay);
  const led = await ledger(client, f.store, f.campaign);
  assert(led.deductions === 2, "divergent_replay_debited", led);
  const frozen = await one(
    client,
    `select expansion_model from public.product_9_16_two_stage_operations
      where campaign_id = $1 and operation_id = $2`,
    [f.campaign, f.shared],
  );
  assert(frozen.expansion_model === MODEL, "selection_overwritten", frozen);
  return { reason: replay.reason, frozenModel: frozen.expansion_model, ledger: led };
}

async function s05(a, b) {
  const setup = newClient();
  await setup.connect();
  let f;
  try {
    await setup.query("BEGIN");
    f = await createFixture(setup, "0501", "S05");
    const open = await openJoint(setup, f);
    assert(open?.success === true, "open_failed", open);
    const token = await beginPublication(setup, f.campaign, f.square);
    await addArtifact(setup, f, "square_original", "1:1", 1024, 1024);
    await setup.query("COMMIT");
    f.token = token;
  } catch (error) {
    await setup.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await setup.end();
  }

  await a.query("BEGIN");
  const delivered = await deliverFormat(a, f, "1:1", f.token);
  assert(delivered?.success === true, "delivery_failed", delivered);

  await b.query("BEGIN");
  await b.query("SET LOCAL lock_timeout = '5s'");
  let settled = false;
  const refundPromise = refundFormat(b, f, "1:1", 0, "f607-s05-concurrent-refund")
    .then((value) => ({ ok: true, value }))
    .catch((error) => ({ ok: false, error: error.message }))
    .finally(() => {
      settled = true;
    });
  await sleep(400);
  const overlapped = settled === false;
  await a.query("COMMIT");
  const refund = await refundPromise;
  if (refund.ok) await b.query("COMMIT");
  else await b.query("ROLLBACK").catch(() => {});
  assert(overlapped === true, "no_overlap_observed", refund);

  const state = await creditState(a, f.campaign, f.square);
  const led = await ledger(a, f.store, f.campaign);
  assert(state.status === "delivered", "square_not_delivered", state);
  assert(led.refunds === 0, "refund_happened", led);
  assert(refund.ok && refund.value?.success === false, "refund_not_refused", refund);
  assert(refund.value.reason === "delivered_not_refundable", "unexpected_refund_reason", refund.value);
  const artifacts = await artifactCount(a, f.campaign);
  assert(artifacts === 1, "artifact_lost", { artifacts });
  return {
    overlapObserved: overlapped,
    refundResult: refund.ok ? refund.value : refund.error,
    squareStatus: state.status,
    ledger: led,
  };
}

async function s06(a, b) {
  const setup = newClient();
  await setup.connect();
  let f;
  try {
    await setup.query("BEGIN");
    f = await createFixture(setup, "0601", "S06");
    const open = await openJoint(setup, f);
    assert(open?.success === true, "open_failed", open);
    const token = await beginPublication(setup, f.campaign, f.square);
    await addArtifact(setup, f, "square_original", "1:1", 1024, 1024);
    await setup.query("COMMIT");
    f.token = token;
  } catch (error) {
    await setup.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await setup.end();
  }

  await a.query("BEGIN");
  const first = await deliverFormat(a, f, "1:1", f.token);
  assert(first?.success === true && first.idempotent === false, "first_delivery", first);

  await b.query("BEGIN");
  await b.query("SET LOCAL lock_timeout = '5s'");
  let settled = false;
  const secondPromise = deliverFormat(b, f, "1:1", f.token)
    .then((value) => ({ ok: true, value }))
    .catch((error) => ({ ok: false, error: error.message }))
    .finally(() => {
      settled = true;
    });
  await sleep(400);
  const overlapped = settled === false;
  await a.query("COMMIT");
  const second = await secondPromise;
  if (second.ok) await b.query("COMMIT");
  else await b.query("ROLLBACK").catch(() => {});
  assert(overlapped === true, "no_overlap_observed", second);
  assert(second.ok && second.value?.success === true, "concurrent_delivery_failed", second);
  assert(second.value.idempotent === true, "second_not_idempotent", second.value);

  const repeat = await deliverFormat(a, f, "1:1", f.token);
  assert(repeat?.success === true && repeat.idempotent === true, "repeat_not_idempotent", repeat);

  const state = await creditState(a, f.campaign, f.square);
  const led = await ledger(a, f.store, f.campaign);
  assert(state.status === "delivered", "credit_not_delivered", state);
  assert(led.deductions === 2, "second_charge", led);
  assert(led.refunds === 0, "refund_appeared", led);
  return {
    overlapObserved: overlapped,
    secondIdempotent: second.value.idempotent,
    repeatIdempotent: repeat.idempotent,
    ledger: led,
  };
}

async function s07(client) {
  const f = await createFixture(client, "0701", "S07");
  const open = await openJoint(client, f);
  assert(open?.success === true, "open_failed", open);

  const beforeFinality = await attempt(client, () =>
    refundFormat(client, f, "9:16", 0, "f607-s07-no-finality"),
  );
  assert(beforeFinality.ok === false && /shared_operation_not_final/.test(beforeFinality.error), "refund_without_finality", beforeFinality);
  let state = await creditState(client, f.campaign, f.shared);
  assert(state.status === "reserved", "vertical_mutated", state);

  const finality = await recordJointOutcome(client, f.campaign, f.shared, "base", "failed");
  assert(finality?.success === true, "finality_not_recorded", finality);
  const refund = await refundFormat(client, f, "9:16", 0, "f607-s07-refund");
  assert(refund?.success === true, "vertical_refund_failed", refund);
  const vertical = await creditState(client, f.campaign, f.shared);
  const square = await creditState(client, f.campaign, f.square);
  const led = await ledger(client, f.store, f.campaign);
  const campaign = await campaignState(client, f.campaign);
  assert(vertical.status === "refunded" && square.status === "reserved", "refund_state", { vertical, square });
  assert(led.refunds === 1, "refund_tx_count", led);
  assert(campaign.status === "generating", "campaign_projected_early", campaign);

  // Negativo: arte presente recusa o estorno.
  const arte = await createFixture(client, "0702", "S07b");
  const openArte = await openJoint(client, arte);
  assert(openArte?.success === true, "open_arte_failed", openArte);
  await recordJointOutcome(client, arte.campaign, arte.shared, "base", "failed");
  await addArtifact(client, arte, "vertical", "9:16", 1080, 1920);
  const refused = await refundFormat(client, arte, "9:16", 0, "f607-s07-artifact");
  assert(refused?.success === false && refused.reason === "artifact_present", "artifact_not_refused", refused);
  const arteVertical = await creditState(client, arte.campaign, arte.shared);
  const arteLed = await ledger(client, arte.store, arte.campaign);
  assert(arteVertical.status === "reserved" && arteLed.refunds === 0, "artifact_refund_mutated", {
    arteVertical,
    arteLed,
  });

  return { vertical: vertical.status, square: square.status, refunds: led.refunds, artifactRefusal: refused.reason };
}

async function s08(client) {
  const f = await createFixture(client, "0801", "S08");
  const open = await openJoint(client, f);
  assert(open?.success === true, "open_failed", open);
  await recordJointOutcome(client, f.campaign, f.shared, "base", "failed");

  const missingOwn = await attempt(client, () =>
    refundFormat(client, f, "1:1", 0, "f607-s08-no-own-finality"),
  );
  assert(missingOwn.ok === false && /finality_not_recorded/.test(missingOwn.error), "square_without_own_finality", missingOwn);

  const own = await recordSquareOutcome(client, f.campaign, f.square, "failed");
  assert(own?.success === true, "square_finality_failed", own);

  const stale = await attempt(client, () =>
    refundFormat(client, f, "1:1", 999, "f607-s08-stale"),
  );
  assert(stale.ok === false && /evidence_stale/.test(stale.error), "stale_epoch_allowed", stale);
  let square = await creditState(client, f.campaign, f.square);
  assert(square.status === "reserved", "square_refunded_on_stale", square);

  const refund = await refundFormat(client, f, "1:1", 0, "f607-s08-refund");
  assert(refund?.success === true, "square_refund_failed", refund);
  square = await creditState(client, f.campaign, f.square);
  const vertical = await creditState(client, f.campaign, f.shared);
  const led = await ledger(client, f.store, f.campaign);
  assert(square.status === "refunded" && vertical.status === "reserved", "refund_state", { square, vertical });
  assert(led.refunds === 1, "refund_count", led);
  return {
    missingOwnFinality: "finality_not_recorded",
    staleEpoch: "evidence_stale",
    square: square.status,
    vertical: vertical.status,
    refunds: led.refunds,
  };
}

async function s09(client) {
  const f = await createFixture(client, "0901", "S09");
  const open = await openJoint(client, f);
  assert(open?.success === true, "open_failed", open);

  const unknown = await recordJointOutcome(client, f.campaign, f.shared, "base", "unknown");
  assert(unknown?.success === true, "unknown_not_persisted", unknown);
  const divergent = await recordJointOutcome(client, f.campaign, f.shared, "base", "failed");
  assert(divergent?.success === false && divergent.reason === "operation_identity_conflict", "unknown_overwritten", divergent);

  const refund = await attempt(client, () =>
    refundFormat(client, f, "9:16", 0, "f607-s09-unknown"),
  );
  assert(refund.ok === false && /shared_operation_not_final/.test(refund.error), "refund_after_unknown", refund);

  const acquired = await acquireWithRequest(
    client,
    f.campaign,
    f.shared,
    "base",
    "primary",
    requestId(f.shared),
  );
  assert(acquired?.acquired === false && acquired.reason === "operation_unknown", "unknown_allowed_acquire", acquired);

  const rows = await outcomes916(client, f.campaign);
  const led = await ledger(client, f.store, f.campaign);
  assert(rows.length === 1 && rows[0].outcome === "unknown", "outcome_overwritten", rows);
  assert(led.refunds === 0, "refund_after_unknown_tx", led);
  return { outcome: rows[0].outcome, acquireReason: acquired.reason, refunds: led.refunds };
}

async function s10(client) {
  const f = await createFixture(client, "1001", "S10");
  const open = await openJoint(client, f);
  assert(open?.success === true, "open_failed", open);
  await recordJointOutcome(client, f.campaign, f.shared, "base", "failed");
  await recordSquareOutcome(client, f.campaign, f.square, "failed");

  const failedRefund = await attempt(client, () =>
    refundFormat(client, f, "1:1", 1, "f607-s10-fail-between"),
  );
  assert(failedRefund.ok === false && /evidence_stale/.test(failedRefund.error), "stale_refund_allowed", failedRefund);
  let square = await creditState(client, f.campaign, f.square);
  let led = await ledger(client, f.store, f.campaign);
  assert(square.status === "reserved" && led.refunds === 0, "partial_refund_on_failure", { square, led });

  const refund = await refundFormat(client, f, "1:1", 0, "f607-s10-retry");
  assert(refund?.success === true && refund.idempotent === false, "retry_refund_failed", refund);
  square = await creditState(client, f.campaign, f.square);
  led = await ledger(client, f.store, f.campaign);
  assert(square.status === "refunded" && led.refunds === 1, "retry_refund_state", { square, led });

  const replay = await refundFormat(client, f, "1:1", 0, "f607-s10-replay");
  assert(replay?.success === true && replay.idempotent === true, "replay_not_idempotent", replay);
  const ledAfter = await ledger(client, f.store, f.campaign);
  assert(ledAfter.refunds === 1, "replay_duplicated_refund", ledAfter);
  const jointOutcomes = await outcomes916(client, f.campaign);
  const squareOutcomes = await outcomes11(client, f.campaign);
  assert(jointOutcomes.length === 1 && squareOutcomes.length === 1, "outcome_rewritten", {
    jointOutcomes,
    squareOutcomes,
  });
  return {
    failedAttempt: "evidence_stale",
    refunds: ledAfter.refunds,
    idempotentReplay: replay.idempotent,
    outcomes: { joint: jointOutcomes.length, square: squareOutcomes.length },
  };
}

async function s11(client) {
  const f = await createFixture(client, "1101", "S11");
  const open = await openJoint(client, f);
  assert(open?.success === true, "open_failed", open);
  await recordJointOutcome(client, f.campaign, f.shared, "base", "failed");
  await recordSquareOutcome(client, f.campaign, f.square, "failed");

  const vertical = await refundFormat(client, f, "9:16", 0, "f607-s11-vertical");
  assert(vertical?.success === true, "vertical_refund_failed", vertical);

  const blocked = await attempt(client, () =>
    refundFormat(client, f, "1:1", 1, "f607-s11-square-stale"),
  );
  assert(blocked.ok === false && /evidence_stale/.test(blocked.error), "square_stale_allowed", blocked);
  const verticalState = await creditState(client, f.campaign, f.shared);
  let squareState = await creditState(client, f.campaign, f.square);
  let led = await ledger(client, f.store, f.campaign);
  assert(verticalState.status === "refunded", "vertical_progress_lost", verticalState);
  assert(squareState.status === "reserved" && led.refunds === 1, "partial_progress_state", { squareState, led });

  const square = await refundFormat(client, f, "1:1", 0, "f607-s11-square-retry");
  assert(square?.success === true, "square_retry_failed", square);
  squareState = await creditState(client, f.campaign, f.square);
  led = await ledger(client, f.store, f.campaign);
  assert(squareState.status === "refunded" && led.refunds === 2, "final_refund_state", { squareState, led });
  const campaign = await campaignState(client, f.campaign);
  assert(
    campaign.status === "error" && campaign.error_message === "two_format_delivery_failed",
    "campaign_not_error_after_both_refunds",
    campaign,
  );
  return {
    vertical: verticalState.status,
    square: squareState.status,
    refunds: led.refunds,
    campaign: campaign.status,
  };
}

function fixtureIds(code, label) {
  return {
    ...ids(code),
    label,
    configId: CONFIG_ID,
    model: MODEL,
    quality: QUALITY,
  };
}

async function s12(a, b) {
  const setup = newClient();
  await setup.connect();
  let f = fixtureIds("1201", "S12");
  let resumed = false;
  let vertical = null;
  let square = null;
  try {
    const exists = await one(setup, `select id from public.stores where id = $1`, [f.store]);
    if (exists) {
      resumed = true;
      const squareCredit = await creditState(setup, f.campaign, f.square);
      const verticalCredit = await creditState(setup, f.campaign, f.shared);
      const campaign = await campaignState(setup, f.campaign);
      const artifacts = await artifactCount(setup, f.campaign);
      assert(
        squareCredit?.status === "delivered" && verticalCredit?.status === "delivered",
        "resume_not_delivered",
        { squareCredit, verticalCredit },
      );
      assert(
        campaign.status === "ready" && /\/square_original\.jpg$/.test(campaign.storage_path),
        "resume_not_projected",
        campaign,
      );
      assert(artifacts === 2, "resume_artifacts", { artifacts });
      vertical = { status: verticalCredit.status };
      square = { status: squareCredit.status };
    } else {
      await setup.query("BEGIN");
      f = await createFixture(setup, "1201", "S12");
      const open = await openJoint(setup, f);
      assert(open?.success === true, "open_failed", open);
      await addArtifact(setup, f, "square_original", "1:1", 1024, 1024, f.artifact);
      await addArtifact(setup, f, "vertical", "9:16", 1080, 1920, f.extra2);
      await setup.query("COMMIT");

      const tokenVertical = await beginPublication(setup, f.campaign, f.shared);
      vertical = await deliverFormat(setup, f, "9:16", tokenVertical);
      assert(vertical?.success === true, "vertical_delivery_failed", vertical);
      let campaign = await campaignState(setup, f.campaign);
      assert(
        campaign.status === "ready" && /\/vertical\.jpg$/.test(campaign.storage_path),
        "vertical_projection",
        campaign,
      );

      const tokenSquare = await beginPublication(setup, f.campaign, f.square);
      square = await deliverFormat(setup, f, "1:1", tokenSquare);
      assert(square?.success === true, "square_delivery_failed", square);
      campaign = await campaignState(setup, f.campaign);
      assert(
        campaign.status === "ready" && /\/square_original\.jpg$/.test(campaign.storage_path),
        "square_projection",
        campaign,
      );
    }
  } catch (error) {
    await setup.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await setup.end();
  }

  await a.query("BEGIN");
  const projectionA = await call(a, "product_two_format_project_campaign", [f.campaign]);
  await b.query("BEGIN");
  await b.query("SET LOCAL lock_timeout = '5s'");
  let settled = false;
  const projectionBPromise = call(b, "product_two_format_project_campaign", [f.campaign])
    .then((value) => ({ ok: true, value }))
    .catch((error) => ({ ok: false, error: error.message }))
    .finally(() => {
      settled = true;
    });
  await sleep(400);
  const overlapped = settled === false;
  await a.query("COMMIT");
  const projectionB = await projectionBPromise;
  if (projectionB.ok) await b.query("COMMIT");
  else await b.query("ROLLBACK").catch(() => {});

  assert(overlapped === true, "projection_not_serialized", projectionB);
  assert(projectionA?.success === true && projectionB.ok && projectionB.value?.success === true, "projection_failed", {
    projectionA,
    projectionB,
  });
  const late = await call(a, "product_two_format_project_campaign", [f.campaign]);
  const finalCampaign = await campaignState(a, f.campaign);
  assert(late?.already_projected === true, "late_projection_mutated", late);
  assert(finalCampaign.status === "ready" && /\/square_original\.jpg$/.test(finalCampaign.storage_path), "projection_regressed", finalCampaign);
  return {
    resumed,
    deliveries: { vertical: vertical?.status ?? null, square: square?.status ?? null },
    overlapObserved: overlapped,
    projectionA,
    projectionB: projectionB.value,
    late,
    finalCampaign,
  };
}

async function s13(a, b) {
  const setup = newClient();
  await setup.connect();
  let f = fixtureIds("1301", "S13");
  let resumed = false;
  let reservedState = null;
  try {
    const exists = await one(setup, `select id from public.stores where id = $1`, [f.store]);
    if (exists) {
      resumed = true;
      reservedState = {
        square: await creditState(setup, f.campaign, f.square),
        vertical: await creditState(setup, f.campaign, f.shared),
      };
      assert(
        reservedState.square?.status === "reserved" && reservedState.vertical?.status === "reserved",
        "resume_not_reserved",
        reservedState,
      );
    } else {
      await setup.query("BEGIN");
      f = await createFixture(setup, "1301", "S13");
      const open = await openJoint(setup, f);
      assert(open?.success === true, "open_failed", open);
      await setup.query("COMMIT");
    }
  } catch (error) {
    await setup.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await setup.end();
  }

  const evidence = {
    origin: "server-derived",
    art_kind: "absent",
    execution_ended: false,
    state_epoch: "0",
    authorized_abandon: "true",
    authorized_publication_closure: "true",
  };
  const params = [
    f.user,
    f.campaign,
    f.square,
    "refund_once",
    "[F60.7 Gate B] S13 concurrent admin",
    f.resolution,
    evidence,
  ];

  const blocker = newClient();
  await blocker.connect();
  let first;
  let second;
  let overlapped = false;
  try {
    await blocker.query("BEGIN");
    await blocker.query("select pg_advisory_xact_lock(hashtext($1))", [
      `p1_1_pending_resolution:${f.resolution}`,
    ]);
    let firstSettled = false;
    let secondSettled = false;
    const firstPromise = capture(call(a, "admin_resolve_product_1_1_pending", params)).finally(() => {
      firstSettled = true;
    });
    const secondPromise = capture(call(b, "admin_resolve_product_1_1_pending", params)).finally(() => {
      secondSettled = true;
    });
    await sleep(400);
    overlapped = firstSettled === false && secondSettled === false;
    await blocker.query("COMMIT");
    [first, second] = await Promise.all([firstPromise, secondPromise]);
  } finally {
    await blocker.query("ROLLBACK").catch(() => {});
    await blocker.end();
  }
  assert(overlapped === true, "admin_not_serialized_under_barrier", { first, second });
  assert(first.ok && second.ok, "admin_resolution_failed", { first, second });
  assert(first.value?.success === true && second.value?.success === true, "admin_not_success", { first, second });

  const audits = await q(
    a,
    `select id from public.admin_audit_log where operation_id = $1`,
    [f.resolution],
  );
  assert(audits.length === 1, "audit_not_unique", audits);
  const state = await creditState(a, f.campaign, f.square);
  const led = await ledger(a, f.store, f.campaign);
  assert(state.status === "refunded" && led.refunds === 1, "admin_double_effect", { state, led });
  return {
    resumed,
    reservedState,
    overlapObserved: overlapped,
    first: first.value,
    second: second.value,
    audits: audits.length,
    square: state.status,
    refunds: led.refunds,
  };
}

async function s14(client) {
  const f = await createFixture(client, "1401", "S14");
  const open = await openJoint(client, f);
  assert(open?.success === true, "open_failed", open);

  const divergentResolution = ids("1401").resolution;
  await q(
    client,
    `insert into public.admin_audit_log
       (actor_id, action, target_type, target_id, reason, operation_id, metadata)
     values ($1, 'product_1_1_pending_resolution', 'campaign', $2,
             '[F60.7 Gate B] S14 pre-existing audit', $3, $4::jsonb)`,
    [
      f.user,
      f.campaign,
      divergentResolution,
      JSON.stringify({
        campaign_id: f.campaign,
        operation_id: f.square,
        action: "refund_once",
        art_kind: "absent",
      }),
    ],
  );

  const divergent = await capture(
    call(client, "admin_resolve_product_1_1_pending", [
      f.user,
      f.campaign,
      f.square,
      "deliver_existing_art",
      "[F60.7 Gate B] S14 divergent action",
      divergentResolution,
      {
        origin: "server-derived",
        art_kind: "integral",
        execution_ended: false,
        authorized_abandon: "true",
        authorized_publication_closure: "true",
      },
    ]),
  );
  assert(divergent.ok && divergent.value?.success === false, "divergent_audit_accepted", divergent);
  assert(divergent.value.reason === "operation_identity_conflict", "unexpected_audit_reason", divergent.value);

  const auditCount = await one(
    client,
    `select count(*)::int as n from public.admin_audit_log where operation_id = $1`,
    [divergentResolution],
  );
  const state = await creditState(client, f.campaign, f.square);
  const led = await ledger(client, f.store, f.campaign);
  assert(auditCount.n === 1, "audit_duplicated", auditCount);
  assert(state.status === "reserved" && led.refunds === 0, "divergent_audit_effect", { state, led });
  return {
    divergentReason: divergent.value.reason,
    audits: auditCount.n,
    square: state.status,
    refunds: led.refunds,
    auditUnavailable: "não simulável sem indispor o banco; coberto no contrato offline (S17)",
  };
}

async function s15(client) {
  const f = await createFixture(client, "1501", "S15");
  const open = await openJoint(client, f);
  assert(open?.success === true, "open_failed", open);
  const notFinal = await attempt(client, () =>
    refundFormat(client, f, "9:16", 0, "f607-s15-not-final"),
  );
  assert(notFinal.ok === false && /shared_operation_not_final/.test(notFinal.error), "not_final_changed", notFinal);
  let state = await creditState(client, f.campaign, f.shared);
  let led = await ledger(client, f.store, f.campaign);
  assert(state.status === "reserved" && led.refunds === 0, "not_final_mutated", { state, led });

  const inconsistent = await createFixture(client, "1502", "S15b");
  const openMain = await openJoint(client, inconsistent);
  assert(openMain?.success === true, "open_inconsistent_failed", openMain);
  const second = await call(client, "product_9_16_open_operation_v2", [
    inconsistent.store,
    inconsistent.campaign,
    inconsistent.extra,
    MODEL,
    QUALITY,
    CONFIG_ID,
  ]);
  assert(second?.success === true, "second_operation_failed", second);
  await q(
    client,
    `insert into public.product_two_format_deliveries
       (campaign_id, operation_id, store_id, format, delivery_operation_id, artifact_role)
     values ($1, $2, $3, '9:16', $2, 'vertical')`,
    [inconsistent.campaign, inconsistent.extra, inconsistent.store],
  );
  const beforeCampaign = await campaignState(client, inconsistent.campaign);
  const projection = await attempt(client, () =>
    call(client, "product_two_format_project_campaign", [inconsistent.campaign]),
  );
  assert(projection.ok === false && /delivery_links_inconsistent/.test(projection.error), "inconsistent_links_projected", projection);
  const afterCampaign = await campaignState(client, inconsistent.campaign);
  const links = await deliveryLinks(client, inconsistent.campaign);
  assert(
    beforeCampaign.status === afterCampaign.status &&
      beforeCampaign.storage_path === afterCampaign.storage_path &&
      beforeCampaign.error_message === afterCampaign.error_message,
    "inconsistent_projection_mutated",
    { beforeCampaign, afterCampaign },
  );
  assert(links.length === 3, "inconsistent_fixture_links", links);
  return {
    notFinal: "shared_operation_not_final",
    inconsistent: "delivery_links_inconsistent",
    links: links.length,
  };
}

async function s16() {
  const client = newClient();
  await client.connect();
  try {
    const table = "public.product_two_format_deliveries";
    const fn = "public.product_two_format_open_delivery(uuid,uuid,uuid,uuid,text,text,uuid)";
    const privileges = await one(
      client,
      `select
         has_table_privilege('anon', $1, 'SELECT') as anon_select,
         has_table_privilege('anon', $1, 'INSERT') as anon_insert,
         has_table_privilege('authenticated', $1, 'SELECT') as auth_select,
         has_table_privilege('authenticated', $1, 'INSERT') as auth_insert,
         has_table_privilege('service_role', $1, 'SELECT') as service_select,
         has_table_privilege('service_role', $1, 'INSERT') as service_insert,
         has_table_privilege('service_role', $1, 'UPDATE') as service_update,
         has_table_privilege('service_role', $1, 'DELETE') as service_delete,
         has_function_privilege('anon', $2, 'EXECUTE') as anon_exec,
         has_function_privilege('authenticated', $2, 'EXECUTE') as auth_exec,
         has_function_privilege('service_role', $2, 'EXECUTE') as service_exec`,
      [table, fn],
    );
    assert(privileges.anon_select === false && privileges.anon_insert === false, "anon_table_privilege", privileges);
    assert(privileges.auth_select === false && privileges.auth_insert === false, "authenticated_table_privilege", privileges);
    assert(privileges.service_select === true, "service_select_missing", privileges);
    assert(privileges.service_insert === false && privileges.service_update === false && privileges.service_delete === false, "service_write_privilege", privileges);
    assert(privileges.anon_exec === false && privileges.auth_exec === false, "anon_exec_privilege", privileges);
    assert(privileges.service_exec === true, "service_exec_missing", privileges);

    await client.query("SET ROLE anon");
    const deniedSelect = await capture(
      client.query(`select count(*) from ${table}`),
    );
    await client.query("RESET ROLE");
    assert(deniedSelect.ok === false && /permission denied/i.test(deniedSelect.error), "anon_select_allowed", deniedSelect);

    const rls = await one(
      client,
      `select relrowsecurity from pg_class where oid = $1::regclass`,
      [table],
    );
    assert(rls.relrowsecurity === true, "rls_disabled", rls);

    await client.query("SET ROLE service_role");
    const serviceSelect = await capture(client.query(`select count(*)::int as n from ${table}`));
    await client.query("RESET ROLE");
    assert(serviceSelect.ok === true, "service_select_failed", serviceSelect);
    return { privileges, rls: rls.relrowsecurity, anonSelect: deniedSelect.error };
  } finally {
    await client.end();
  }
}

function s17() {
  const testFile = "src/lib/product-two-format/__tests__/joint-financial-client.contract.test.ts";
  let stdout = "";
  let failed = false;
  try {
    stdout = execSync(
      `npx vitest run ${testFile} --reporter=dot`,
      { cwd: REPO_ROOT, encoding: "utf8", timeout: 300000, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    failed = true;
    stdout = `${error.stdout ?? ""}\n${error.stderr ?? ""}\n${error.message ?? ""}`;
  }
  const tail = stdout.split(/\r?\n/).filter(Boolean).slice(-12);
  assert(failed === false, "client contract test failed", tail);
  return { testFile, exitCode: 0, tail };
}

async function s18(client) {
  const f11 = await createFixture(client, "1801", "S18 1:1");
  const reserve11 = await call(client, "product_1_1_reserve_credit_operation", [
    f11.store,
    f11.campaign,
    f11.shared,
    1,
    {},
  ]);
  assert(reserve11?.success === true, "legacy_1_1_reserve_failed", reserve11);
  const token11 = await beginPublication(client, f11.campaign, f11.shared);
  await call(client, "product_1_1_mark_campaign_credit_art_uploaded", [
    f11.campaign,
    f11.shared,
    token11,
  ]);
  const delivered11 = await call(client, "product_1_1_deliver_campaign_credit_operation", [
    f11.campaign,
    f11.shared,
    token11,
  ]);
  assert(delivered11?.status === "delivered", "legacy_1_1_not_delivered", delivered11);

  const f916 = await createFixture(client, "1802", "S18 9:16");
  const reserve916 = await call(client, "product_1_1_reserve_credit_operation", [
    f916.store,
    f916.campaign,
    f916.shared,
    1,
    {},
  ]);
  assert(reserve916?.success === true, "legacy_9_16_reserve_failed", reserve916);
  const token916 = await beginPublication(client, f916.campaign, f916.shared);
  await call(client, "product_1_1_mark_campaign_credit_art_uploaded", [
    f916.campaign,
    f916.shared,
    token916,
  ]);
  const delivered916 = await call(client, "product_1_1_deliver_campaign_credit_operation", [
    f916.campaign,
    f916.shared,
    token916,
  ]);
  assert(delivered916?.status === "delivered", "legacy_9_16_not_delivered", delivered916);

  const fclose = await createFixture(client, "1803", "S18 close");
  await call(client, "product_1_1_reserve_credit_operation", [
    fclose.store,
    fclose.campaign,
    fclose.shared,
    1,
    {},
  ]);
  await recordSquareOutcome(client, fclose.campaign, fclose.shared, "failed");
  const closeEpoch = await epoch(client, fclose.campaign, fclose.shared);
  const closed = await call(client, "product_1_1_close_failed_operation", [
    fclose.campaign,
    fclose.shared,
    "absent",
    closeEpoch,
    "[F60.7 Gate B] S18 close",
  ]);
  assert(closed?.status === "refunded", "legacy_close_failed", closed);

  const read = await call(client, "product_1_1_get_campaign_operation_by_campaign", [
    f11.campaign,
  ]);
  assert(read && read.operation_id?.toLowerCase() === f11.shared, "legacy_read_failed", read);

  const functions = await q(
    client,
    `select proname, pg_get_function_identity_arguments(oid) as args,
            prosecdef, proconfig
       from pg_proc
      where proname like 'product_two_format_%'
      order by proname`,
  );
  assert(functions.length === 4, "new_function_count", functions);
  assert(functions.every((row) => row.prosecdef === true), "new_function_not_security_definer", functions);
  assert(
    functions.every((row) => (row.proconfig ?? []).some((value) => /search_path=/.test(value))),
    "new_function_search_path",
    functions,
  );
  const centralFunctions = await q(
    client,
    `select to_regprocedure($1) is not null as reserve,
            to_regprocedure($2) is not null as close,
            to_regprocedure($3) is not null as acquire,
            to_regprocedure($4) is not null as open_v2`,
    [
      "public.product_1_1_reserve_credit_operation(uuid,uuid,uuid,integer,jsonb)",
      "public.product_1_1_close_failed_operation(uuid,uuid,text,integer,text)",
      "public.product_9_16_acquire_step(uuid,uuid,text,uuid,text)",
      "public.product_9_16_open_operation_v2(uuid,uuid,uuid,text,text,uuid)",
    ],
  );
  assert(
    centralFunctions[0].reserve && centralFunctions[0].close && centralFunctions[0].acquire && centralFunctions[0].open_v2,
    "central_function_missing",
    centralFunctions[0],
  );
  return {
    legacy11: delivered11.status,
    legacy916: delivered916.status,
    close: closed.status,
    read: read.operation_id,
    newFunctions: functions.length,
  };
}

async function s19(a, b) {
  const code = "1902";
  const setup = newClient();
  await setup.connect();
  let f = fixtureIds(code, "S19");
  let resumed = false;
  let claimToken = null;
  let acquiredEvidence = null;
  try {
    const exists = await one(setup, `select id from public.stores where id = $1`, [f.store]);
    if (exists) {
      resumed = true;
      const claims = await claims916(setup, f.campaign);
      assert(
        claims.length === 1 && claims[0].status === "in_progress",
        "resume_claim_not_in_progress",
        claims,
      );
      claimToken = claims[0].attempt_token;
      acquiredEvidence = {
        acquired: true,
        authorization: "execute",
        stage: claims[0].stage,
        attempt_number: claims[0].attempt_number,
        resumed_from_persisted_claim: true,
      };
    } else {
      await setup.query("BEGIN");
      f = await createFixture(setup, code, "S19");
      const open = await openJoint(setup, f);
      assert(open?.success === true, "open_failed", open);
      await setup.query("COMMIT");
    }
  } catch (error) {
    await setup.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await setup.end();
  }

  if (resumed) {
    // Reproduz a mesma trava da aquisição já persistida: a linha financeira
    // compartilhada é travada por A enquanto B tenta o estorno.
    await a.query("BEGIN");
    await a.query(
      `select 1 from public.product_1_1_campaign_credit_operations
        where campaign_id = $1 and operation_id = $2 for update`,
      [f.campaign, f.shared],
    );
  } else {
    const rid = requestId(f.shared);
    await a.query("BEGIN");
    const acquired = await acquireWithRequest(a, f.campaign, f.shared, "base", "primary", rid);
    assert(acquired?.acquired === true && acquired.authorization === "execute", "base_not_acquired", acquired);
    claimToken = acquired.attempt_token;
    acquiredEvidence = acquired;
  }

  await b.query("BEGIN");
  await b.query("SET LOCAL lock_timeout = '10s'");
  let settled = false;
  const refundWhileActive = refundFormat(b, f, "1:1", 0, "f607-s19-during-acquire")
    .then((value) => ({ ok: true, value }))
    .catch((error) => ({ ok: false, error: error.message }))
    .finally(() => {
      settled = true;
    });
  await sleep(400);
  const overlapped = settled === false;
  await a.query("COMMIT");
  const during = await refundWhileActive;
  if (during.ok) await b.query("COMMIT");
  else await b.query("ROLLBACK").catch(() => {});
  assert(overlapped === true, "no_overlap", during);
  assert(during.ok === false && /operation_in_progress/.test(during.error), "refund_during_acquire", during);

  let square = await creditState(a, f.campaign, f.square);
  let led = await ledger(a, f.store, f.campaign);
  let outcomes = await outcomes916(a, f.campaign);
  assert(square.status === "reserved" && led.refunds === 0 && outcomes.length === 0, "mutation_during_block", {
    square,
    led,
    outcomes,
  });

  const finished = await finish(a, f.campaign, f.shared, claimToken, "failed", "definitive");
  assert(finished?.success === true, "finish_failed", finished);

  const beforeFinality = await capture(
    refundFormat(a, f, "1:1", 0, "f607-s19-before-finality"),
  );
  assert(beforeFinality.ok === false && /shared_operation_not_final/.test(beforeFinality.error), "refund_before_finality", beforeFinality);

  await recordJointOutcome(a, f.campaign, f.shared, "base", "failed");
  await recordSquareOutcome(a, f.campaign, f.square, "failed");
  const refund = await refundFormat(a, f, "1:1", 0, "f607-s19-after-release");
  assert(refund?.success === true, "refund_after_release_failed", refund);

  square = await creditState(a, f.campaign, f.square);
  const vertical = await creditState(a, f.campaign, f.shared);
  led = await ledger(a, f.store, f.campaign);
  outcomes = await outcomes916(a, f.campaign);
  const claimRows = await claims916(a, f.campaign);
  assert(square.status === "refunded" && vertical.status === "reserved", "final_s19_state", { square, vertical });
  assert(led.refunds === 1, "final_s19_refunds", led);
  assert(outcomes.length === 1 && outcomes[0].outcome === "failed", "final_s19_outcomes", outcomes);
  assert(claimRows.length === 1 && claimRows[0].status === "failed" && claimRows[0].failure_class === "definitive", "final_s19_claim", claimRows);
  return {
    resumed,
    acquired: acquiredEvidence,
    overlapObserved: overlapped,
    duringAcquire: during.ok ? during.value : during.error,
    beforeFinality: "shared_operation_not_final",
    finalRefund: refund,
    square: square.status,
    vertical: vertical.status,
    refunds: led.refunds,
    claim: claimRows[0],
  };
}

async function s20(client) {
  // 20a: finalidade failed vence nova aquisição.
  const failed = await createFixture(client, "2001", "S20a");
  const openFailed = await openJoint(client, failed);
  assert(openFailed?.success === true, "open_failed_a", openFailed);
  const finality = await recordJointOutcome(client, failed.campaign, failed.shared, "base", "failed");
  assert(finality?.success === true, "finality_failed_a", finality);

  const beforeA = await claims916(client, failed.campaign);
  const blockedA = await acquireWithRequest(
    client,
    failed.campaign,
    failed.shared,
    "base",
    "primary",
    requestId(failed.shared),
  );
  assert(blockedA?.acquired === false && blockedA.reason === "operation_terminal", "acquire_after_failed", blockedA);
  const afterA = await claims916(client, failed.campaign);
  const ledA = await ledger(client, failed.store, failed.campaign);
  assert(beforeA.length === 0 && afterA.length === 0, "claim_after_failed", { beforeA, afterA });
  assert(ledA.deductions === 2 && ledA.refunds === 0, "credit_after_failed", ledA);

  // 20b: finalidade refunded (estorno compartilhado) vence nova aquisição.
  const refunded = await createFixture(client, "2002", "S20b");
  const openRefunded = await openJoint(client, refunded);
  assert(openRefunded?.success === true, "open_failed_b", openRefunded);
  await recordJointOutcome(client, refunded.campaign, refunded.shared, "base", "failed");
  const refund = await refundFormat(client, refunded, "9:16", 0, "f607-s20-shared-refund");
  assert(refund?.success === true, "shared_refund_failed", refund);

  const beforeB = await claims916(client, refunded.campaign);
  const blockedB = await acquireWithRequest(
    client,
    refunded.campaign,
    refunded.shared,
    "base",
    "primary",
    requestId(refunded.shared),
  );
  assert(blockedB?.acquired === false && blockedB.reason === "operation_terminal", "acquire_after_refunded", blockedB);
  const secondAttempt = await acquireWithRequest(
    client,
    refunded.campaign,
    refunded.shared,
    "base",
    "primary",
    ids("2002").extra,
  );
  assert(secondAttempt?.acquired === false && secondAttempt.reason === "operation_terminal", "second_acquire_after_refunded", secondAttempt);
  const afterB = await claims916(client, refunded.campaign);
  const ledB = await ledger(client, refunded.store, refunded.campaign);
  const stateB = await creditState(client, refunded.campaign, refunded.shared);
  assert(beforeB.length === 0 && afterB.length === 0, "claim_after_refunded", { beforeB, afterB });
  assert(stateB.status === "refunded" && ledB.refunds === 1, "refund_state_b", { stateB, ledB });

  return {
    failedOutcome: { reason: blockedA.reason, claims: afterA.length, ledger: ledA },
    sharedRefunded: { reason: blockedB.reason, secondReason: secondAttempt.reason, claims: afterB.length, ledger: ledB },
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const COMMITTED_CODES = ["0501", "0601", "1201", "1301", "1901", "1902", "2001", "2002"];

const SCENARIOS = [
  { id: "S01", name: "Abertura nova com saldo suficiente", mode: "rollback", run: s01 },
  { id: "S02", name: "Abertura com saldo insuficiente", mode: "rollback", run: s02 },
  { id: "S03", name: "Replay de abertura equivalente", mode: "rollback", run: s03 },
  { id: "S04", name: "Replay de abertura divergente", mode: "rollback", run: s04 },
  { id: "S05", name: "Entrega 1:1 concorrente com estorno do quadrado", mode: "concurrent", run: s05 },
  { id: "S06", name: "Entrega por formato concorrente/repetida", mode: "concurrent", run: s06 },
  { id: "S07", name: "Estorno vertical com arte ausente/finalidade", mode: "rollback", run: s07 },
  { id: "S08", name: "Estorno do quadrado com handoff failed", mode: "rollback", run: s08 },
  { id: "S09", name: "Unknown persistido bloqueia sem sobrescrever", mode: "rollback", run: s09 },
  { id: "S10", name: "Falha entre outcome e refund", mode: "rollback", run: s10 },
  { id: "S11", name: "Falha entre os dois estornos", mode: "rollback", run: s11 },
  { id: "S12", name: "Projeção concorrente/tardia", mode: "concurrent", run: s12 },
  { id: "S13", name: "Resolução administrativa concorrente", mode: "concurrent", run: s13 },
  { id: "S14", name: "Auditoria divergente/falha", mode: "rollback", run: s14 },
  { id: "S15", name: "Disputa shared_operation_not_final/delivery_links_inconsistent", mode: "rollback", run: s15 },
  { id: "S16", name: "RLS/grants", mode: "standalone", run: s16 },
  { id: "S17", name: "Erros PostgREST mapeados no cliente", mode: "offline", run: s17 },
  { id: "S18", name: "Regressão 1:1/9:16/histórico", mode: "rollback", run: s18 },
  { id: "S19", name: "Aquisição da base vence × estorno do quadrado", mode: "concurrent", run: s19 },
  { id: "S20", name: "Finalidade compartilhada vence × nova aquisição", mode: "concurrent", run: s20 },
];

async function runRollback(scenario, client) {
  await client.query("BEGIN");
  try {
    const result = await scenario.run(client);
    await client.query("ROLLBACK");
    return { status: "PASS", result };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return { status: "FAIL", error: error.message, details: error.details ?? null };
  }
}

async function runConcurrent(scenario) {
  const a = newClient();
  const b = newClient();
  await a.connect();
  await b.connect();
  try {
    const result = await scenario.run(a, b);
    return { status: "PASS", result };
  } catch (error) {
    return { status: "FAIL", error: error.message, details: error.details ?? null };
  } finally {
    await a.end();
    await b.end();
  }
}

async function runStandalone(scenario) {
  try {
    const result = await scenario.run();
    return { status: "PASS", result };
  } catch (error) {
    return { status: "FAIL", error: error.message, details: error.details ?? null };
  }
}

function runOffline(scenario) {
  try {
    const result = scenario.run();
    return { status: "PASS", result };
  } catch (error) {
    return { status: "FAIL", error: error.message, details: error.details ?? null };
  }
}

async function main() {
  const health = newClient();
  await health.connect();
  const identity = await one(
    health,
    `select current_database() as database, version() as version,
            (select count(*) from supabase_migrations.schema_migrations)::int as ledger,
            (select count(*) from supabase_migrations.schema_migrations
              where version = '20261118002139')::int as f607_ledger,
            (select count(*) from supabase_migrations.schema_migrations
              where version = '20261030185658')::int as legal_ledger,
            to_regclass('public.product_two_format_deliveries')::text as table_name`,
  );
  assert(identity.database === "postgres", "target_database", identity);
  assert(identity.ledger === 157 && identity.f607_ledger === 1, "ledger_not_applied", identity);
  assert(identity.legal_ledger === 0, "legal_migration_applied", identity);
  assert(identity.table_name === "product_two_format_deliveries", "table_missing", identity);

  const existing = await one(
    health,
    `select
       (select count(*) from public.stores where id::text like 'f607%')::int as stores,
       (select count(*) from public.campaigns where id::text like 'f607%')::int as campaigns,
       (select count(*) from public.campaign_composition_artifacts where id::text like 'f607%')::int as artifacts`,
  );
  if (existing.stores > 0 || existing.campaigns > 0 || existing.artifacts > 0) {
    const storeCodes = await q(
      health,
      `select substr(id::text, 5, 4) as code from public.stores where id::text like 'f607%'`,
    );
    const campaignCodes = await q(
      health,
      `select substr(id::text, 5, 4) as code from public.campaigns where id::text like 'f607%'`,
    );
    const artifactCodes = await q(
      health,
      `select substr(id::text, 5, 4) as code from public.campaign_composition_artifacts where id::text like 'f607%'`,
    );
    const allowed = new Set(COMMITTED_CODES);
    const unexpected = [...storeCodes, ...campaignCodes, ...artifactCodes]
      .map((row) => row.code)
      .filter((code) => !allowed.has(code));
    assert(unexpected.length === 0, "fixtures_outside_committed_codes", {
      existing,
      unexpected,
    });
  }
  await health.end();

  const scenarios = [];
  let stopped = false;
  for (const scenario of SKIP_SCENARIOS ? [] : SCENARIOS) {
    if (ONLY.length > 0 && !ONLY.includes(scenario.id)) continue;
    if (stopped) {
      scenarios.push({ id: scenario.id, name: scenario.name, status: "BLOCKED", error: "execução interrompida após FAIL" });
      continue;
    }
    const startedAt = new Date().toISOString();
    let outcome;
    if (scenario.mode === "rollback") {
      const client = newClient();
      await client.connect();
      try {
        outcome = await runRollback(scenario, client);
      } finally {
        await client.end();
      }
    } else if (scenario.mode === "concurrent") {
      outcome = await runConcurrent(scenario);
    } else if (scenario.mode === "standalone") {
      outcome = await runStandalone(scenario);
    } else {
      outcome = runOffline(scenario);
    }
    scenarios.push({
      id: scenario.id,
      name: scenario.name,
      mode: scenario.mode,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ...outcome,
    });
    if (outcome.status === "FAIL") stopped = true;
  }

  const inventory = await buildInventory();
  const structure = await collectStructure();
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const evidencePath = resolve(EVIDENCE_DIR, "gate-b-evidence.json");
  let previousScenarios = [];
  if (existsSync(evidencePath)) {
    try {
      previousScenarios = JSON.parse(readFileSync(evidencePath, "utf8")).scenarios ?? [];
    } catch {
      previousScenarios = [];
    }
  }
  const merged = new Map(previousScenarios.map((item) => [item.id, item]));
  for (const item of scenarios) merged.set(item.id, item);
  const finalScenarios = SCENARIOS.filter((item) => merged.has(item.id)).map((item) =>
    merged.get(item.id),
  );
  const evidence = {
    kind: "f60.7-gate-b-db",
    run_id: RUN_ID,
    generated_at: new Date().toISOString(),
    execution_mode: "incremental-merged-by-scenario",
    target: {
      database: identity.database,
      version: identity.version,
      connection: DATABASE_URL.replace(/:\/\/[^@]+@/, "://<redacted>@"),
      container: "supabase_db_vendeo-homolog",
      ledger: identity.ledger,
      f607Ledger: identity.f607_ledger,
      legalLedger: identity.legal_ledger,
      table: identity.table_name,
    },
    scenarios: finalScenarios,
    passed: finalScenarios.filter((item) => item.status === "PASS").length,
    failed: finalScenarios.filter((item) => item.status === "FAIL").length,
    blocked: finalScenarios.filter((item) => item.status === "BLOCKED").length,
    inventory,
    structure,
  };

  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  writeFileSync(
    resolve(EVIDENCE_DIR, "gate-b-fixtures.json"),
    `${JSON.stringify(inventory, null, 2)}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify({
      evidence: evidencePath,
      fixtures: resolve(EVIDENCE_DIR, "gate-b-fixtures.json"),
      passed: evidence.passed,
      failed: evidence.failed,
      blocked: evidence.blocked,
      ran: scenarios.map((item) => item.id),
    }),
  );
  if (scenarios.some((item) => item.status === "FAIL")) process.exitCode = 1;
}

async function collectStructure() {
  const client = newClient();
  await client.connect();
  try {
    const columns = await q(
      client,
      `select column_name, data_type, is_nullable, column_default
         from information_schema.columns
        where table_schema = 'public' and table_name = 'product_two_format_deliveries'
        order by ordinal_position`,
    );
    const constraints = await q(
      client,
      `select conname, contype, pg_get_constraintdef(oid) as definition
         from pg_constraint
        where conrelid = 'public.product_two_format_deliveries'::regclass
        order by conname`,
    );
    const indexes = await q(
      client,
      `select indexname, indexdef from pg_indexes
        where schemaname = 'public' and tablename = 'product_two_format_deliveries'
        order by indexname`,
    );
    const policies = await q(
      client,
      `select policyname, roles, cmd, qual, with_check
         from pg_policies
        where schemaname = 'public' and tablename = 'product_two_format_deliveries'
        order by policyname`,
    );
    const tableGrants = await q(
      client,
      `select grantee, privilege_type
         from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'product_two_format_deliveries'
        order by grantee, privilege_type`,
    );
    const tableAcl = await one(
      client,
      `select relrowsecurity, relacl::text as acl
         from pg_class where oid = 'public.product_two_format_deliveries'::regclass`,
    );
    const functions = await q(
      client,
      `select p.proname,
              pg_get_function_identity_arguments(p.oid) as args,
              p.prosecdef,
              p.proconfig,
              p.proacl::text as acl
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'product_two_format_%'
        order by p.proname`,
    );
    const functionPrivileges = await q(
      client,
      `select p.proname,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
              has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_exec
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'product_two_format_%'
        order by p.proname`,
    );
    const immutabilityTriggers = await q(
      client,
      `select tgrelid::regclass::text as table_name, tgname, pg_get_triggerdef(oid) as definition
         from pg_trigger
        where not tgisinternal
          and tgrelid in ('public.campaign_composition_artifacts'::regclass,
                          'public.product_1_1_generation_outcomes'::regclass,
                          'public.product_9_16_two_stage_outcomes'::regclass,
                          'public.credit_transactions'::regclass)
        order by 1, 2`,
    );
    const auditCheck = await one(
      client,
      `select pg_get_constraintdef(oid) as definition
         from pg_constraint
        where conrelid = 'public.admin_audit_log'::regclass
          and conname = 'admin_audit_log_action_check'`,
    );
    const ledger = await one(
      client,
      `select
         (select count(*) from supabase_migrations.schema_migrations)::int as total,
         (select count(*) from supabase_migrations.schema_migrations
           where version = '20261118002139')::int as f607,
         (select count(*) from supabase_migrations.schema_migrations
           where version = '20261030185658')::int as legal,
         (select name from supabase_migrations.schema_migrations
           where version = '20261118002139') as f607_name`,
    );
    const ledgerVersions = await q(
      client,
      `select version from supabase_migrations.schema_migrations order by version`,
    );
    const applied = new Set(ledgerVersions.map((row) => row.version));
    const migrationDir = resolve(REPO_ROOT, "supabase/migrations");
    const localMigrations = readdirSync(migrationDir)
      .filter((file) => /^\d{14}_.*\.sql$/.test(file))
      .map((file) => ({
        version: file.slice(0, 14),
        file,
      }));
    const pending = localMigrations.filter((item) => !applied.has(item.version));

    const migrationFile = resolve(
      migrationDir,
      "20261118002139_f60_7_two_format_foundation.sql",
    );
    const localMigrationHash = createHash("sha256")
      .update(readFileSync(migrationFile))
      .digest("hex")
      .toUpperCase();

    const backupPath =
      "G:/Vendeo-Homolog/recovery/pre-f60.7-20261119T152106Z.dump";
    const backupStat = statSync(backupPath);
    const backupHash = createHash("sha256")
      .update(readFileSync(backupPath))
      .digest("hex")
      .toUpperCase();

    return {
      table: {
        columns,
        constraints,
        indexes,
        policies,
        grants: tableGrants,
        acl: tableAcl,
      },
      functions,
      functionPrivileges,
      immutabilityTriggers,
      adminAuditCheck: auditCheck,
      ledger,
      pendingMigrations: pending,
      migration: {
        file: "supabase/migrations/20261118002139_f60_7_two_format_foundation.sql",
        localSha256: localMigrationHash,
        containerSha256BeforeApply:
          "6342EA442A5B9F23197902B316809A59563F8604CEAEE9121019EAC0836F8C78",
        hashMatches: localMigrationHash ===
          "6342EA442A5B9F23197902B316809A59563F8604CEAEE9121019EAC0836F8C78",
        lines: 949,
      },
      backup: {
        path: backupPath,
        bytes: backupStat.size,
        sha256: backupHash,
        sha256Matches:
          backupHash ===
          "2ED7D51B15BC7FD14FEDEAAB9A5C27E87F11C571161A89105F0AFC5BB21F164E",
        restoreListExitCode: 0,
        restoreListFile:
          "G:/Vendeo-Homolog/recovery/pre-f60.7-20261119T152106Z.dump.restore-list.txt",
      },
    };
  } finally {
    await client.end();
  }
}

async function buildInventory() {
  const client = newClient();
  await client.connect();
  try {
    const stores = await q(
      client,
      `select id from public.stores where id::text like 'f607%' order by id`,
    );
    const storeIds = stores.map((row) => row.id);
    const campaigns = await q(
      client,
      `select id, store_id from public.campaigns where id::text like 'f607%' order by id`,
    );
    const campaignIds = campaigns.map((row) => row.id);
    const users = await q(
      client,
      `select id from auth.users where id::text like 'f607%' order by id`,
    );
    const userIds = users.map((row) => row.id);

    const byStore = async (sql) => (storeIds.length ? q(client, sql, [storeIds]) : []);
    const byCampaign = async (sql) => (campaignIds.length ? q(client, sql, [campaignIds]) : []);

    const tables = {
      "auth.users": userIds,
      "public.stores": storeIds,
      "public.campaigns": campaignIds,
      "public.credit_balances": (await byStore(
        `select store_id as id from public.credit_balances where store_id = any($1::uuid[]) order by store_id`,
      )).map((row) => row.id),
      "public.credit_transactions": (await byStore(
        `select id from public.credit_transactions where store_id = any($1::uuid[]) order by id`,
      )).map((row) => row.id),
      "public.product_1_1_campaign_credit_operations": (await byCampaign(
        `select id from public.product_1_1_campaign_credit_operations where campaign_id = any($1::uuid[]) order by id`,
      )).map((row) => row.id),
      "public.product_1_1_generation_attempt_claims": (await byCampaign(
        `select id from public.product_1_1_generation_attempt_claims where campaign_id = any($1::uuid[]) order by id`,
      )).map((row) => row.id),
      "public.product_1_1_generation_outcomes": (await byCampaign(
        `select id from public.product_1_1_generation_outcomes where campaign_id = any($1::uuid[]) order by id`,
      )).map((row) => row.id),
      "public.product_9_16_two_stage_operations": (await byCampaign(
        `select id from public.product_9_16_two_stage_operations where campaign_id = any($1::uuid[]) order by id`,
      )).map((row) => row.id),
      "public.product_9_16_two_stage_steps": (await byCampaign(
        `select id from public.product_9_16_two_stage_steps where campaign_id = any($1::uuid[]) order by id`,
      )).map((row) => row.id),
      "public.product_9_16_two_stage_attempt_claims": (await byCampaign(
        `select id from public.product_9_16_two_stage_attempt_claims where campaign_id = any($1::uuid[]) order by id`,
      )).map((row) => row.id),
      "public.product_9_16_two_stage_outcomes": (await byCampaign(
        `select id from public.product_9_16_two_stage_outcomes where campaign_id = any($1::uuid[]) order by id`,
      )).map((row) => row.id),
      "public.product_two_format_deliveries": (await byCampaign(
        `select id from public.product_two_format_deliveries where campaign_id = any($1::uuid[]) order by id`,
      )).map((row) => row.id),
      "public.campaign_composition_artifacts": (await byCampaign(
        `select id from public.campaign_composition_artifacts where campaign_id = any($1::uuid[]) order by id`,
      )).map((row) => row.id),
    };

    const auditRows = await q(
      client,
      `select id from public.admin_audit_log
        where operation_id::text like 'f607%'
           or target_id = any($1::uuid[])
           or actor_id = any($2::uuid[])
        order by id`,
      [campaignIds, userIds],
    );
    tables["public.admin_audit_log"] = auditRows.map((row) => row.id);

    const counts = await one(
      client,
      `select
         (select count(*) from public.stores)::int as "public.stores",
         (select count(*) from public.campaigns)::int as "public.campaigns",
         (select count(*) from public.product_1_1_campaign_credit_operations)::int as "public.product_1_1_campaign_credit_operations",
         (select count(*) from public.credit_transactions)::int as "public.credit_transactions",
         (select count(*) from public.credit_balances)::int as "public.credit_balances",
         (select count(*) from public.campaign_composition_artifacts)::int as "public.campaign_composition_artifacts",
         (select count(*) from public.product_1_1_generation_outcomes)::int as "public.product_1_1_generation_outcomes",
         (select count(*) from public.product_9_16_two_stage_outcomes)::int as "public.product_9_16_two_stage_outcomes",
         (select count(*) from public.admin_audit_log)::int as "public.admin_audit_log",
         (select count(*) from storage.objects)::int as "storage.objects"`,
    );

    const baseline = {
      "public.stores": 24,
      "public.campaigns": 118,
      "public.product_1_1_campaign_credit_operations": 57,
      "public.credit_transactions": 176,
      "public.credit_balances": 21,
      "public.campaign_composition_artifacts": 23,
      "public.product_1_1_generation_outcomes": 5,
      "public.product_9_16_two_stage_outcomes": 5,
      "public.admin_audit_log": 101,
      "storage.objects": 345,
    };
    const delta = {};
    const expected = {};
    let countsMatch = true;
    for (const [table, value] of Object.entries(baseline)) {
      const inventoryCount = (tables[table] ?? []).length;
      delta[table] = counts[table] - value;
      expected[table] = inventoryCount;
      if (delta[table] !== inventoryCount) countsMatch = false;
    }

    const outside = await one(
      client,
      `select
         (select count(*) from public.stores where not (id = any($1::uuid[])))::int as stores,
         (select count(*) from public.campaigns where not (id = any($2::uuid[])))::int as campaigns,
         (select count(*) from public.product_1_1_campaign_credit_operations where not (id = any($3::uuid[])))::int as credit_ops,
         (select count(*) from public.credit_transactions where not (id = any($4::uuid[])))::int as transactions,
         (select count(*) from public.credit_balances where not (store_id = any($1::uuid[])))::int as balances,
         (select count(*) from public.campaign_composition_artifacts where not (id = any($5::uuid[])))::int as artifacts,
         (select count(*) from public.product_1_1_generation_outcomes where not (id = any($6::uuid[])))::int as outcomes11,
         (select count(*) from public.product_9_16_two_stage_outcomes where not (id = any($7::uuid[])))::int as outcomes916,
         (select count(*) from public.admin_audit_log where not (id = any($8::uuid[])))::int as audit`,
      [
        storeIds,
        campaignIds,
        tables["public.product_1_1_campaign_credit_operations"],
        tables["public.credit_transactions"],
        tables["public.campaign_composition_artifacts"],
        tables["public.product_1_1_generation_outcomes"],
        tables["public.product_9_16_two_stage_outcomes"],
        tables["public.admin_audit_log"],
      ],
    );

    const storeSynthetic = stores.map((row) => row.id);
    const campaignSynthetic = campaigns.map((row) => row.id);

    return {
      run_id: RUN_ID,
      generated_at: new Date().toISOString(),
      policy:
        "Fixtures commitadas preservadas no homolog; proibido DELETE/TRUNCATE/desabilitar trigger/restore. Integridade = zero alteração fora do inventário.",
      config_version_id: CONFIG_ID,
      synthetic_prefix: "f607",
      committed_codes: COMMITTED_CODES,
      scenario_fixtures: {
        S05: "0501",
        S06: "0601",
        S12: "1201",
        S13: "1301",
        S19: "1902",
        S19_aborted_first_attempt: "1901",
        S20a: "2001",
        S20b: "2002",
      },
      notes: [
        "1901 é fixture preservada da primeira tentativa do S19, interrompida por bug do harness (SAVEPOINT fora de bloco de transação) depois da fase de aquisição; contém claim base failed/definitive, sem outcome e sem estorno. O S19 foi reexecutado do zero em 1902.",
        "S12 e S13 foram retomados sobre fixtures já commitadas após o processo do harness ser interrompido; o estado entregue/projetado do S12 foi verificado no banco e a resolução administrativa concorrente do S13 executou integralmente na retomada.",
        "Fixtures imutáveis (artefatos, transações, outcomes) não são removidas; a integridade é provada por zero alteração fora do inventário e por baseline + delta.",
      ],
      stores: storeSynthetic,
      campaigns: campaignSynthetic,
      tables,
      counts,
      baseline,
      delta,
      expected_delta: expected,
      counts_match_baseline_plus_inventory: countsMatch,
      outside_inventory: outside,
      outside_matches_baseline:
        outside.stores === baseline["public.stores"] &&
        outside.campaigns === baseline["public.campaigns"] &&
        outside.credit_ops === baseline["public.product_1_1_campaign_credit_operations"] &&
        outside.transactions === baseline["public.credit_transactions"] &&
        outside.balances === baseline["public.credit_balances"] &&
        outside.artifacts === baseline["public.campaign_composition_artifacts"] &&
        outside.outcomes11 === baseline["public.product_1_1_generation_outcomes"] &&
        outside.outcomes916 === baseline["public.product_9_16_two_stage_outcomes"] &&
        outside.audit === baseline["public.admin_audit_log"],
      preserved_in_homolog: true,
    };
  } finally {
    await client.end();
  }
}

const keepAlive = setInterval(() => {}, 1000);
main()
  .catch((error) => {
    console.error(`[f607-gate] ${error.message}`);
    console.error(error.stack);
    process.exitCode = 1;
  })
  .finally(() => {
    clearInterval(keepAlive);
  });
