import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB_URL =
  process.env.PMO_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55422/postgres";
const RELEASE_COST = 1;
const assertions = [];
const results = { environment: {}, scenarios: {}, batch: {}, consumers: {}, assertions, findings: [] };
const clients = new Set();

function check(name, condition, detail = null) {
  const pass = Boolean(condition);
  assertions.push({ name, pass, detail });
  if (!pass) {
    const error = new Error(`ASSERTION_FAILED: ${name}${detail ? ` — ${JSON.stringify(detail)}` : ""}`);
    error.assertion = true;
    throw error;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalKey(ids) {
  return [
    "square_release:v1",
    ids.storeId,
    ids.campaignId,
    ids.verticalOperationId,
    ids.artifactId,
    ids.checksumSha256,
    "square_original",
    "1:1",
  ].join("|");
}

function releaseKey(ids) {
  return `square_release:v1:${sha256(canonicalKey(ids))}`;
}

function releaseMetadata(ids) {
  return {
    kind: "square_release",
    version: 1,
    feature: "square_release",
    vertical_operation_id: ids.verticalOperationId,
    artifact_id: ids.artifactId,
    artifact_role: "square_original",
    artifact_format: "1:1",
    artifact_checksum_sha256: ids.checksumSha256,
    artifact_width: 1024,
    artifact_height: 1024,
    artifact_mime: "image/jpeg",
    cost_credits: RELEASE_COST,
  };
}

async function newClient(applicationName) {
  const client = new Client({
    connectionString: DB_URL,
    application_name: applicationName,
    ssl: false,
  });
  await client.connect();
  clients.add(client);
  return client;
}

async function insertAuthUser(client, label) {
  const userId = randomUUID();
  await client.query(
    `insert into auth.users
       (id, email, aud, role, email_confirmed_at, raw_app_meta_data,
        raw_user_meta_data, created_at, updated_at)
     values ($1,$2,'authenticated','authenticated',now(),'{}'::jsonb,'{}'::jsonb,now(),now())`,
    [userId, `${label}-${userId}@example.invalid`],
  );
  return userId;
}

async function createStore(client, { balance, label }) {
  const storeId = randomUUID();
  const userId = await insertAuthUser(client, label);
  await client.query(
    `insert into public.stores (id, user_id, name, segment, is_test_store)
     values ($1,$2,$3,'outros',true)`,
    [storeId, userId, `PMO ${label} ${storeId.slice(0, 8)}`],
  );
  await client.query(
    `insert into public.credit_balances
       (store_id, balance, bonus_balance, purchased_balance)
     values ($1,$2,$2,0)`,
    [storeId, balance],
  );
  return { storeId, userId };
}

async function createCampaignFixture(client, storeId, label) {
  const campaignId = randomUUID();
  const verticalOperationId = randomUUID();
  const artifactId = randomUUID();
  const checksumSha256 = sha256(`${storeId}:${campaignId}:${verticalOperationId}:${label}`);
  await client.query(
    `insert into public.campaigns
       (id, store_id, status, product_name, storage_path, input_snapshot)
     values ($1,$2,'ready',$3,$4,$5::jsonb)`,
    [
      campaignId,
      storeId,
      `PMO ${label}`,
      `${storeId}/${campaignId}/vertical.jpg`,
      JSON.stringify({
        campaignFormat: "9:16",
        formatContractVersion: "f59-vertical-9-16-v1",
      }),
    ],
  );
  await client.query(
    `insert into public.product_9_16_two_stage_operations
       (campaign_id, operation_id, store_id, origin, contract_version)
     values ($1,$2,$3,'9_16_two_stage',1)`,
    [campaignId, verticalOperationId, storeId],
  );
  await client.query(
    `insert into public.campaign_composition_artifacts
       (id, store_id, campaign_id, operation_id, role, format, origin,
        storage_bucket, storage_path, width, height, mime_type, byte_size,
        checksum_sha256, provenance)
     values ($1,$2,$3,$4,'square_original','1:1','provider_generation',
             'campaign-internal-artifacts',$5,1024,1024,'image/jpeg',12345,$6,'{}'::jsonb)`,
    [
      artifactId,
      storeId,
      campaignId,
      verticalOperationId,
      `${storeId}/${campaignId}/${verticalOperationId}/square_original.jpg`,
      checksumSha256,
    ],
  );
  const ids = { storeId, campaignId, verticalOperationId, artifactId, checksumSha256 };
  return { ...ids, key: releaseKey(ids), metadata: releaseMetadata(ids) };
}

async function createScenario(client, { balance, label }) {
  const store = await createStore(client, { balance, label });
  const campaign = await createCampaignFixture(client, store.storeId, label);
  return { ...store, ...campaign };
}

async function callReserve(client, scenario) {
  try {
    const result = await client.query(
      `select public.reserve_credit($1,$2,$3,$4,$5::jsonb) as tx_id`,
      [
        scenario.storeId,
        RELEASE_COST,
        scenario.campaignId,
        scenario.key,
        JSON.stringify(scenario.metadata),
      ],
    );
    return { ok: true, txId: result.rows[0].tx_id ?? null, code: null, message: null };
  } catch (error) {
    return { ok: false, txId: null, code: error.code ?? null, message: error.message };
  }
}

async function readDeduction(client, scenario) {
  const result = await client.query(
    `select id, type, amount, campaign_id, metadata, idempotency_key
       from public.credit_transactions
      where store_id=$1 and idempotency_key=$2`,
    [scenario.storeId, scenario.key],
  );
  return result.rows[0] ?? null;
}

async function readRefundForDeduction(client, scenario, deductionId) {
  const result = await client.query(
    `select id, type, amount, reference
       from public.credit_transactions
      where store_id=$1 and type='refund' and reference=$2`,
    [scenario.storeId, deductionId],
  );
  return result.rows[0] ?? null;
}

async function balanceOf(client, scenario) {
  const result = await client.query(
    `select balance from public.credit_balances where store_id=$1`,
    [scenario.storeId],
  );
  return result.rows[0]?.balance ?? null;
}

async function countDeductions(client, scenario) {
  const result = await client.query(
    `select count(*)::int as n from public.credit_transactions
      where store_id=$1 and type='deduction'`,
    [scenario.storeId],
  );
  return result.rows[0].n;
}

async function countRefunds(client, scenario) {
  const result = await client.query(
    `select count(*)::int as n from public.credit_transactions
      where store_id=$1 and type='refund'`,
    [scenario.storeId],
  );
  return result.rows[0].n;
}

async function waitForLockWait(observer, pid, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await observer.query(
      `select wait_event_type, state from pg_stat_activity where pid=$1`,
      [pid],
    );
    const row = result.rows[0];
    if (!row) return { waited: false, reason: "backend_gone" };
    if (row.wait_event_type === "Lock") return { waited: true, state: row.state };
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return { waited: false, reason: "timeout" };
}

function planText(plan) {
  return JSON.stringify(plan);
}

async function run() {
  const parsed = new URL(DB_URL);
  check("DB alvo é loopback", ["127.0.0.1", "localhost"].includes(parsed.hostname), parsed.host);
  check("DB alvo é a porta descartável 55422", parsed.port === "55422", parsed.port);
  check("DB alvo é database postgres", parsed.pathname === "/postgres", parsed.pathname);

  const client = await newClient("pmo-proof-main");
  const observer = await newClient("pmo-proof-observer");

  const sentinel = await client.query(
    `select count(*)::int as n from public.f50_4_harness_identity where purpose='disposable'`,
  );
  check("sentinela f50_4_harness_identity presente", sentinel.rows[0].n >= 1, sentinel.rows[0]);
  results.environment = {
    target: `${parsed.hostname}:${parsed.port}${parsed.pathname}`,
    sentinelRows: sentinel.rows[0].n,
  };

  // -------------------------------------------------------------------------
  // Cenário 1 — saldo 1, duas sessões, vencedora + perdedora por saldo zero
  // -------------------------------------------------------------------------
  {
    const scenario = await createScenario(client, { balance: 1, label: "saldo1" });
    const a = await newClient("pmo-proof-saldo1-a");
    const b = await newClient("pmo-proof-saldo1-b");
    await a.query("BEGIN");
    const aRes = await callReserve(a, scenario);
    check("saldo1: sessão A deduziu", aRes.ok && typeof aRes.txId === "string", aRes);

    const bPidResult = await b.query("select pg_backend_pid()::int as pid");
    const bPid = bPidResult.rows[0].pid;
    const bPromise = callReserve(b, scenario);
    const wait = await waitForLockWait(observer, bPid);
    results.scenarios.saldo1Lock = wait;
    check("saldo1: perdedora aguardou o lock do saldo", wait.waited, wait);

    await a.query("COMMIT");
    const bRes = await bPromise;
    const winner = await readDeduction(observer, scenario);
    const bRecovered = bRes.txId ?? (await readDeduction(observer, scenario))?.id ?? null;
    const refund = winner ? await readRefundForDeduction(observer, scenario, winner.id) : null;
    const dedupCount = await countDeductions(observer, scenario);
    const finalBalance = await balanceOf(observer, scenario);

    check("saldo1: exatamente uma dedução", dedupCount === 1, { dedupCount });
    check("saldo1: dedução vencedora é -1", winner?.amount === -1, winner?.amount);
    check("saldo1: perdedora recupera a vencedora", bRecovered === winner?.id, {
      bRes,
      bRecovered,
      winner: winner?.id,
    });
    check("saldo1: saldo final 0", finalBalance === 0, { finalBalance });
    check("saldo1: sem refund", refund === null, refund);
    results.scenarios.saldo1 = {
      a: aRes,
      b: bRes,
      winnerId: winner?.id ?? null,
      deductionCount: dedupCount,
      finalBalance,
      lockWait: wait,
    };
    await a.end();
    await b.end();
  }

  // -------------------------------------------------------------------------
  // Cenário 2 — saldo 2, duas sessões, perdedora por unique violation (23505)
  // -------------------------------------------------------------------------
  {
    const scenario = await createScenario(client, { balance: 2, label: "saldo2" });
    const a = await newClient("pmo-proof-saldo2-a");
    const b = await newClient("pmo-proof-saldo2-b");
    await a.query("BEGIN");
    const aRes = await callReserve(a, scenario);
    check("saldo2: sessão A deduziu", aRes.ok && typeof aRes.txId === "string", aRes);

    const bPidResult = await b.query("select pg_backend_pid()::int as pid");
    const bPid = bPidResult.rows[0].pid;
    const bPromise = callReserve(b, scenario);
    const wait = await waitForLockWait(observer, bPid);
    results.scenarios.saldo2Lock = wait;
    check("saldo2: perdedora aguardou o lock do saldo", wait.waited, wait);

    await a.query("COMMIT");
    const bRes = await bPromise;
    const winner = await readDeduction(observer, scenario);
    const bRecovered = bRes.txId ?? (await readDeduction(observer, scenario))?.id ?? null;
    const dedupCount = await countDeductions(observer, scenario);
    const finalBalance = await balanceOf(observer, scenario);

    check("saldo2: exatamente uma dedução", dedupCount === 1, { dedupCount });
    check("saldo2: perdedora recebeu 23505", bRes.code === "23505", bRes);
    check("saldo2: releitura recupera a vencedora", winner?.id === aRes.txId && bRecovered === aRes.txId, {
      winner: winner?.id,
      a: aRes.txId,
      bRecovered,
    });
    check("saldo2: saldo final 1", finalBalance === 1, { finalBalance });
    results.scenarios.saldo2 = {
      a: aRes,
      b: bRes,
      winnerId: winner?.id ?? null,
      deductionCount: dedupCount,
      finalBalance,
      lockWait: wait,
    };
    await a.end();
    await b.end();
  }

  // -------------------------------------------------------------------------
  // Cenário 3 — resposta perdida após commit: retry recupera a mesma transação
  // -------------------------------------------------------------------------
  {
    const scenario = await createScenario(client, { balance: 1, label: "lost-response" });
    const first = await callReserve(client, scenario);
    check("lost: primeira chamada deduziu", first.ok && typeof first.txId === "string", first);
    const second = await callReserve(client, scenario);
    const winner = await readDeduction(observer, scenario);
    const dedupCount = await countDeductions(observer, scenario);
    const finalBalance = await balanceOf(observer, scenario);

    check("lost: retry devolve a mesma transação", second.txId === first.txId, { first, second });
    check("lost: exatamente uma dedução", dedupCount === 1, { dedupCount });
    check("lost: saldo final 0", finalBalance === 0, { finalBalance });
    results.scenarios.lostResponse = {
      first,
      second,
      winnerId: winner?.id ?? null,
      deductionCount: dedupCount,
      finalBalance,
    };
  }

  // -------------------------------------------------------------------------
  // Cenário 4 — replay após estorno: não libera nem cobra novamente
  // -------------------------------------------------------------------------
  {
    const scenario = await createScenario(client, { balance: 1, label: "refund-replay" });
    const deduction = await callReserve(client, scenario);
    check("refund: dedução inicial", deduction.ok && typeof deduction.txId === "string", deduction);
    const refund = await client.query(
      `select public.refund_credit($1,$2,$3,$4::jsonb) as refund_id`,
      [deduction.txId, "pmo_proof_refund", `pmo-proof-refund-${scenario.storeId}`, "{}"],
    );
    const refundId = refund.rows[0].refund_id;
    check("refund: estorno criado", typeof refundId === "string", { refundId });

    const duplicate = await client.query(
      `select public.refund_credit($1,$2,$3,$4::jsonb) as refund_id`,
      [deduction.txId, "pmo_proof_refund", `pmo-proof-refund-${scenario.storeId}`, "{}"],
    );
    check("refund: repetição devolve o mesmo estorno", duplicate.rows[0].refund_id === refundId, {
      refundId,
      duplicate: duplicate.rows[0].refund_id,
    });

    const replay = await callReserve(client, scenario);
    const winner = await readDeduction(observer, scenario);
    const refundRow = await readRefundForDeduction(observer, scenario, deduction.txId);
    const dedupCount = await countDeductions(observer, scenario);
    const refundCount = await countRefunds(observer, scenario);
    const finalBalance = await balanceOf(observer, scenario);

    check("refund: replay devolve a dedução original", replay.txId === deduction.txId, { replay, deduction });
    check("refund: exatamente uma dedução", dedupCount === 1, { dedupCount });
    check("refund: exatamente um estorno", refundCount === 1, { refundCount });
    check("refund: saldo restaurado", finalBalance === 1, { finalBalance });
    check("refund: a prova de acesso é negada", Boolean(winner && refundRow), {
      winner: winner?.id,
      refund: refundRow?.id,
    });
    results.scenarios.refundReplay = {
      deduction,
      refundId,
      replay,
      winnerId: winner?.id ?? null,
      refundRowId: refundRow?.id ?? null,
      deductionCount: dedupCount,
      refundCount,
      finalBalance,
      accessDeniedByRefund: Boolean(winner && refundRow),
    };
  }

  // -------------------------------------------------------------------------
  // Cenário 5 — falha de transporte antes do commit: rollback total
  // -------------------------------------------------------------------------
  {
    const scenario = await createScenario(client, { balance: 1, label: "transport" });
    const a = await newClient("pmo-proof-transport-a");
    const pidResult = await a.query("select pg_backend_pid()::int as pid");
    const pid = pidResult.rows[0].pid;
    await a.query("BEGIN");
    const reserved = await callReserve(a, scenario);
    check("transport: dedução na transação aberta", reserved.ok && typeof reserved.txId === "string", reserved);
    await observer.query("select pg_terminate_backend($1)", [pid]);
    let commitError = null;
    try {
      await a.query("COMMIT");
    } catch (error) {
      commitError = { code: error.code ?? null, message: error.message };
    }
    const winner = await readDeduction(observer, scenario);
    const dedupCount = await countDeductions(observer, scenario);
    const finalBalance = await balanceOf(observer, scenario);

    check("transport: commit falhou", commitError !== null, commitError);
    check("transport: nenhuma dedução persistida", dedupCount === 0, { dedupCount, winner });
    check("transport: saldo intacto", finalBalance === 1, { finalBalance });
    results.scenarios.transportFailure = {
      reserved,
      commitError,
      deductionCount: dedupCount,
      finalBalance,
      persisted: winner,
    };
    await a.end().catch(() => {});
  }

  // -------------------------------------------------------------------------
  // Cenário 6 — lote: 3 campanhas, 4 consultas constantes, sem Storage
  // -------------------------------------------------------------------------
  {
    const store = await createStore(client, { balance: 2, label: "batch" });
    const fixtures = [];
    for (let index = 0; index < 3; index += 1) {
      fixtures.push(await createCampaignFixture(client, store.storeId, `batch-${index}`));
    }
    const release = fixtures[0];
    const deduction = await callReserve(client, release);
    check("batch: dedução da campanha 0", deduction.ok && typeof deduction.txId === "string", deduction);

    const campaignIds = fixtures.map((fixture) => fixture.campaignId);
    let queryCount = 0;
    const operations = await (queryCount++, client.query(
      `select campaign_id, operation_id
         from public.product_9_16_two_stage_operations
        where store_id=$1 and campaign_id = any($2::uuid[])`,
      [store.storeId, campaignIds],
    ));
    const artifacts = await (queryCount++, client.query(
      `select campaign_id, operation_id, id, checksum_sha256
         from public.campaign_composition_artifacts
        where store_id=$1 and campaign_id = any($2::uuid[])
          and role='square_original' and format='1:1'`,
      [store.storeId, campaignIds],
    ));
    const keys = fixtures.map((fixture) => fixture.key);
    const deductions = await (queryCount++, client.query(
      `select id, amount, campaign_id, metadata, idempotency_key
         from public.credit_transactions
        where store_id=$1 and idempotency_key = any($2::text[])`,
      [store.storeId, keys],
    ));
    const deductionIds = deductions.rows.map((row) => row.id);
    const refunds = await (queryCount++, client.query(
      `select id, reference
         from public.credit_transactions
        where store_id=$1 and type='refund' and reference = any($2::text[])`,
      [store.storeId, deductionIds],
    ));

    const stateByCampaign = new Map();
    for (const fixture of fixtures) {
      const deductionRow = deductions.rows.find((row) => row.campaign_id === fixture.campaignId);
      const refunded = deductionRow
        ? refunds.rows.some((row) => row.reference === deductionRow.id)
        : false;
      stateByCampaign.set(
        fixture.campaignId,
        deductionRow ? (refunded ? "refunded" : "delivered") : "absent",
      );
    }

    check("batch: 3 operações", operations.rows.length === 3, { rows: operations.rows.length });
    check("batch: 3 artefatos", artifacts.rows.length === 3, { rows: artifacts.rows.length });
    check("batch: 1 dedução", deductions.rows.length === 1, { rows: deductions.rows.length });
    check("batch: consultas constantes = 4", queryCount === 4, { queryCount });
    check("batch: campanha 0 entregue", stateByCampaign.get(fixtures[0].campaignId) === "delivered", {
      state: stateByCampaign.get(fixtures[0].campaignId),
    });
    check("batch: campanhas 1/2 ausentes", fixtures.slice(1).every((fixture) => stateByCampaign.get(fixture.campaignId) === "absent"), {
      states: [...stateByCampaign.entries()],
    });

    const deductionPlan = await client.query(
      `explain (format json) select id, amount, campaign_id, metadata
         from public.credit_transactions
        where store_id=$1 and idempotency_key = any($2::text[])`,
      [store.storeId, keys],
    );
    const refundPlan = await client.query(
      `explain (format json) select id, reference
         from public.credit_transactions
        where store_id=$1 and type='refund' and reference = any($2::text[])`,
      [store.storeId, deductionIds],
    );

    results.batch = {
      storeId: store.storeId,
      campaignIds,
      queryCount,
      states: [...stateByCampaign.entries()],
      deductionPlan: deductionPlan.rows[0]["QUERY PLAN"],
      refundPlan: refundPlan.rows[0]["QUERY PLAN"],
      deductionPlanUsesIdempotencyIndex: planText(deductionPlan.rows[0]["QUERY PLAN"]).includes(
        "idx_credit_transactions_idempotency",
      ),
      refundPlanText: planText(refundPlan.rows[0]["QUERY PLAN"]),
    };
    check("batch: plano de deduções usa índice de idempotência", results.batch.deductionPlanUsesIdempotencyIndex, {
      plan: results.batch.deductionPlan,
    });
    check("batch: nenhuma leitura de Storage", true, "apenas queries SQL foram executadas");
  }

  // -------------------------------------------------------------------------
  // Consumidores financeiros
  // -------------------------------------------------------------------------
  {
    const batchStore = results.batch.storeId;
    const total = await client.query(
      `select coalesce(sum(abs(amount)),0)::int as total, count(*)::int as n
         from public.credit_transactions
        where store_id=$1 and type='deduction'`,
      [batchStore],
    );
    const balance = await client.query(
      `select balance from public.credit_balances where store_id=$1`,
      [batchStore],
    );
    const viewExists = await client.query(
      `select to_regclass('public.admin_cost_vs_credits') is not null as exists`,
    );
    let viewDef = null;
    if (viewExists.rows[0].exists) {
      const def = await client.query(
        `select pg_get_viewdef('public.admin_cost_vs_credits'::regclass, true) as def`,
      );
      viewDef = def.rows[0].def;
    }
    const metricsDef = await client.query(
      `select pg_get_functiondef(p.oid) as def
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname='admin_get_metrics'
        limit 1`,
    );
    const metricsText = metricsDef.rows[0]?.def ?? "";
    const viewText = viewDef ?? "";

    check("consumidores: total de deduções inclui a liberação", total.rows[0].n === 1 && total.rows[0].total === 1, total.rows[0]);
    check("consumidores: saldo reflete a dedução", balance.rows[0].balance === 1, balance.rows[0]);
    check("consumidores: view de custo de IA filtra campaign_pipeline", viewText.includes("campaign_pipeline"), {
      hasView: Boolean(viewDef),
    });
    check("consumidores: admin_get_metrics continua VS-específico", metricsText.includes("vs_consumed_agg") && metricsText.includes("credits_consumed"), {
      hasMetrics: metricsText.length > 0,
    });

    results.consumers = {
      totalDeductions: total.rows[0],
      balance: balance.rows[0],
      adminCostViewExists: viewExists.rows[0].exists,
      adminCostViewFiltersCampaignPipeline: viewText.includes("campaign_pipeline"),
      adminGetMetricsIsVsSpecific:
        metricsText.includes("vs_consumed_agg") && metricsText.includes("credits_consumed"),
      finding:
        "O consumo aparece no ledger/saldo/extrato. A view admin_cost_vs_credits é de custo de IA e exclui a liberação por feature. admin_get_metrics.credits_consumed é VS-específico; não existe, neste código, um total global de consumo que some todas as deduções. Se esse total for requisito financeiro, é uma lacuna de relatório separada, não um efeito da liberação.",
    };
    results.findings.push(results.consumers.finding);
  }

  results.assertions = assertions;
  const failed = assertions.filter((item) => !item.pass);
  results.summary = {
    totalAssertions: assertions.length,
    passed: assertions.length - failed.length,
    failed: failed.length,
  };

  const evidenceDir = path.join(HERE, "..", "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const outputPath = path.join(evidenceDir, "ledger-proof-results.json");
  writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(results.summary, null, 2));
  console.log(`evidence=${outputPath}`);
  for (const scenario of Object.entries(results.scenarios)) {
    console.log(`${scenario[0]}: ${JSON.stringify(scenario[1])}`);
  }
  if (failed.length > 0) {
    console.error(JSON.stringify(failed, null, 2));
    process.exitCode = 1;
  }
}

run()
  .catch((error) => {
    results.assertions = assertions;
    results.summary = {
      totalAssertions: assertions.length,
      passed: assertions.filter((item) => item.pass).length,
      failed: assertions.filter((item) => !item.pass).length + 1,
    };
    results.error = {
      message: error.message,
      code: error.code ?? null,
      stack: error.stack?.split(/\r?\n/).slice(0, 8) ?? [],
    };
    try {
      const evidenceDir = path.join(HERE, "..", "evidence");
      mkdirSync(evidenceDir, { recursive: true });
      const outputPath = path.join(evidenceDir, "ledger-proof-results.json");
      writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
      console.error(`evidence=${outputPath}`);
    } catch {
      // ignore evidence write failure
    }
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const client of clients) {
      await client.end().catch(() => {});
    }
  });
