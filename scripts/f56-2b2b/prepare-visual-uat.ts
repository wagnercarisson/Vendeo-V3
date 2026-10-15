/**
 * F56.2b2b (B2.2 / Plano 07) — fixtures LOCAL-ONLY para a UAT visual humana.
 *
 * Cria SOMENTE as quatro campanhas aprovadas na loja de UAT conhecida
 * (`uat.b21@vendeo.local` / `UAT B2.1 Loja`, `is_test_store=true`), append-only:
 *
 *   1. `refunded-original`     — estorno + evidência congelada (direção Original)
 *   2. `refunded-ambient`      — estorno + evidência congelada (direção Ambientado)
 *   3. `refunded-unavailable`  — estorno + snapshot NÃO-restaurável (sem produto)
 *   4. `refunded-no-direction` — estorno + snapshot restaurável SEM evidência
 *
 * NÃO cria fixture administrativa, NÃO concede admin, NÃO toca em flags,
 * autorização, código produtivo, rota de debug nem em campanhas anteriores.
 * Provider SEMPRE simulado (zero chamada paga); sem `db push`/reset/deploy.
 *
 * Modo: DRY-RUN por padrão (nenhuma escrita). Escrever SOMENTE com `--apply`,
 * depois de revisar a identidade/loja/flags/bucket/efeitos do dry-run.
 */

import { randomUUID } from "node:crypto";
import {
  createCampaign,
  createIsolatedContext,
  closeIsolatedContext,
  type IsolatedContext,
  pgCallJson,
  reserveCredit,
} from "../../src/lib/product-1-1/__tests__/integration-harness";

const PREFLIGHT_TOKEN = "vendeo-f562a-isolated:56321:56322";
const UAT_EMAIL = "uat.b21@vendeo.local";
const UAT_STORE_NAME = "UAT B2.1 Loja";
const APP_URL = "http://localhost:3000";

type Direction = "original" | "ambient";

interface FixtureCase {
  readonly key: string;
  readonly label: string;
  readonly restorable: boolean;
  readonly direction: Direction | null;
  /**
   * Selo PERSISTIDO desde a origem. Deve pertencer a `BADGE_OPTIONS_OFFER`
   * (`src/lib/constants.ts`). O `-23%` dos casos históricos NÃO pertence às
   * opções do formulário — registrado como erro de preparação; NÃO convertido.
   */
  readonly badgeText: string;
}

const CASES: readonly FixtureCase[] = [
  // Casos HISTÓRICOS (já criados; preservados). `badgeText="-23%"` foi um erro
  // de preparação (não é opção do formulário) — mantido só como registro.
  { key: "refunded-original", label: "UAT B2.2 - refunded original", restorable: true, direction: "original", badgeText: "-23%" },
  { key: "refunded-ambient", label: "UAT B2.2 - refunded ambient", restorable: true, direction: "ambient", badgeText: "-23%" },
  { key: "refunded-unavailable", label: "UAT B2.2 - refunded unavailable", restorable: false, direction: null, badgeText: "-23%" },
  { key: "refunded-no-direction", label: "UAT B2.2 - refunded no-direction", restorable: true, direction: null, badgeText: "-23%" },
  // Fixture ADICIONAL autorizada: mesmo perfil da `refunded-original`, mas com o
  // selo CORRETO desde a origem (`Promoção` é a 1ª opção de `BADGE_OPTIONS_OFFER`).
  {
    key: "refunded-badge-promocao",
    label: "UAT B2.2 - refunded badge promocao",
    restorable: true,
    direction: "original",
    badgeText: "Promoção",
  },
];

/** Snapshot RESTAURÁVEL (produto nomeado + comercial completo) — marcador do novo fluxo presente. */
function restorableSnapshot(badgeText: string): Record<string, unknown> {
  return {
    frozenContentReferences: [],
    product: { name: "Produto UAT B2.2", description: "Descricao de teste local" },
    commercial: {
      intent: "offer",
      originalPriceCents: 12990,
      discountedPriceCents: 9990,
      badgeText,
      validity: { displayText: "Valida ate 31/10" },
      legalNotice: { text: "Imagem ilustrativa" },
    },
    creativeContext: { preserveImageContext: false },
  };
}

/** Snapshot NÃO-restaurável: marcador presente (novo fluxo) mas SEM produto nomeado. */
function unrestorableSnapshot(): Record<string, unknown> {
  return { frozenContentReferences: [] };
}

async function insertFrozenEvidence(
  ctx: IsolatedContext,
  campaign: string,
  operation: string,
  direction: Direction,
): Promise<void> {
  const { data, error } = await ctx.supabase.rpc("product_1_1_persist_snapshot_with_binding", {
    p_campaign_id: campaign,
    p_primary_model: "gpt-image-2.5-sunburst",
    p_primary_quality: "medium",
    p_fallback_model: "gpt-image-2",
    p_fallback_quality: "medium",
    p_config_version_id: randomUUID(),
    p_origin: "human_decision",
    p_operation_id: operation,
    p_content_fingerprint: `fp-${randomUUID()}`,
  });
  if (error) throw new Error(`fixture_snapshot_failed:${error.message}`);
  const snapshotOriginalId = (data as Array<{ snapshot_original_id: string }>)[0]?.snapshot_original_id;
  if (!snapshotOriginalId) throw new Error("fixture_snapshot_missing_id");
  const { error: evError } = await ctx.supabase.from("product_1_1_snapshot_frozen_evidence").insert({
    snapshot_original_id: snapshotOriginalId,
    campaign_id: campaign,
    operation_id: operation,
    campaign_intent: "offer",
    background_direction: direction,
    briefing: "briefing congelado",
    reference_selections: [],
    base_version: "v1",
    composer_version: "c1",
    policy_versions: {},
  });
  if (evError) throw new Error(`fixture_evidence_failed:${evError.message}`);
}

async function main(): Promise<void> {
  if (process.env.B22_VISUAL_PREFLIGHT !== PREFLIGHT_TOKEN) {
    throw new Error("Run the protected isolated preflight and supply its local environment first");
  }
  const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");

  const ctx = await createIsolatedContext();
  try {
    // --- Identidade da loja de UAT (exatamente uma, de teste). ---
    const owners = await ctx.pg.query<{ id: string; user_id: string; is_test_store: boolean }>(
      "SELECT s.id,s.user_id,s.is_test_store FROM public.stores s JOIN auth.users u ON u.id=s.user_id WHERE u.email=$1 AND s.name=$2",
      [UAT_EMAIL, UAT_STORE_NAME],
    );
    if (owners.rows.length !== 1 || owners.rows[0].is_test_store !== true) {
      throw new Error("Expected exactly one dedicated local UAT test store");
    }
    const storeId = owners.rows[0].id;

    // --- Flags DEVEM permanecer OFF (fail-closed) e sem drift no fim. ---
    const flags = await ctx.pg.query<{ key: string; enabled: boolean }>(
      "SELECT key,enabled FROM public.feature_flags WHERE key IN ('product_1_1_test_stores_enabled','product_1_1_all_stores_enabled') ORDER BY key",
    );
    if (flags.rows.length !== 2 || flags.rows.some((row) => row.enabled !== false)) {
      throw new Error("Product must remain OFF");
    }

    // --- Bucket privado obrigatório. ---
    const bucket = await ctx.supabase.storage.getBucket("campaign-images");
    if (bucket.error || !bucket.data || bucket.data.public) throw new Error("Private local bucket required");

    // --- Saldo: apenas o MÍNIMO sintético aditivo (nunca redefine o saldo). ---
    const balanceRow = await ctx.pg.query<{ balance: number }>(
      "SELECT balance FROM public.credit_balances WHERE store_id=$1",
      [storeId],
    );
    const initialBalance = Number(balanceRow.rows[0]?.balance ?? 0);

    const campaignsBefore = (
      await ctx.pg.query<{ n: number }>("SELECT count(*)::int AS n FROM public.campaigns WHERE store_id=$1", [storeId])
    ).rows[0]?.n ?? 0;

    // Detecção de duplicatas: só as fixtures AUSENTES são criadas; as existentes
    // são preservadas integralmente (nenhuma escrita).
    const existingRows = await ctx.pg.query<{ id: string; product_name: string }>(
      "SELECT id, product_name FROM public.campaigns WHERE store_id=$1 AND product_name = ANY($2::text[])",
      [storeId, CASES.map((c) => c.label)],
    );
    const existingIds = new Map(existingRows.rows.map((row) => [row.product_name, row.id]));

    const plan = CASES.map((c) => ({
      key: c.key,
      label: c.label,
      restorable: c.restorable,
      direction: c.direction,
      badgeText: c.badgeText,
      exists: existingIds.has(c.label),
      effects: [
        "campaigns(+1)",
        "credit_operations: reserved->refunded",
        "credit_transactions: deduction(+1), refund(+1)",
        "generation_outcomes: failed(+1)",
        ...(c.direction ? ["snapshot_frozen_evidence: +1"] : []),
      ],
    }));
    const newCases = plan.filter((c) => !c.exists);
    const topUp = Math.max(0, newCases.length - initialBalance);

    if (!apply) {
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: "dry-run",
            localOnly: true,
            providerCalls: 0,
            storeId,
            flags: flags.rows,
            bucketPrivate: bucket.data.public === false,
            initialBalance,
            syntheticTopUp: topUp,
            newCaseCount: newCases.length,
            campaignsBefore,
            cases: plan,
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    if (topUp > 0) {
      await ctx.pg.query(
        `INSERT INTO public.credit_balances(store_id,balance,bonus_balance,purchased_balance)
         VALUES($1,$2,$2,0) ON CONFLICT(store_id) DO UPDATE
         SET balance=credit_balances.balance+EXCLUDED.balance,
             bonus_balance=credit_balances.bonus_balance+EXCLUDED.bonus_balance`,
        [storeId, topUp],
      );
    }

    const results = [];
    let createdCount = 0;
    for (const fixture of CASES) {
      // Guarda de idempotência: nunca duplicar fixtures já criadas.
      const existing = await ctx.pg.query<{ id: string }>(
        "SELECT id FROM public.campaigns WHERE store_id=$1 AND product_name=$2",
        [storeId, fixture.label],
      );
      if (existing.rows.length > 0) {
        const campaignId = existing.rows[0].id;
        const op = await ctx.pg.query<{ operation_id: string; status: string }>(
          "SELECT operation_id,status FROM public.product_1_1_campaign_credit_operations WHERE campaign_id=$1 ORDER BY created_at DESC LIMIT 1",
          [campaignId],
        );
        results.push({
          key: fixture.key,
          skipped: true,
          campaignId,
          operationId: op.rows[0]?.operation_id ?? null,
          status: op.rows[0]?.status ?? null,
          badgeText: fixture.badgeText,
          url: `${APP_URL}/campanhas/${campaignId}`,
          restoreUrl: `${APP_URL}/campanhas/nova?restoreFrom=${campaignId}`,
        });
        continue;
      }

      const campaignId = await createCampaign(ctx.supabase, storeId, fixture.label);
      await ctx.pg.query("UPDATE public.campaigns SET input_snapshot=$2::jsonb WHERE id=$1 AND store_id=$3", [
        campaignId,
        JSON.stringify(fixture.restorable ? restorableSnapshot(fixture.badgeText) : unrestorableSnapshot()),
        storeId,
      ]);

      const operationId = randomUUID();
      const reservation = await reserveCredit(ctx.pg, storeId, campaignId, operationId);
      if (reservation.success !== true) throw new Error(`fixture_reserve_failed:${fixture.key}`);

      if (fixture.direction) {
        await insertFrozenEvidence(ctx, campaignId, operationId, fixture.direction);
      }

      const recorded = await pgCallJson<{ success: boolean }>(
        ctx.pg,
        "SELECT public.product_1_1_record_generation_outcome($1::uuid,$2::uuid,'failed',$3::text) AS r",
        [campaignId, operationId, `IMG-REF-UAT-${fixture.key}`],
      );
      if (recorded.success !== true) throw new Error(`fixture_record_failed:${fixture.key}`);

      const closed = await pgCallJson<{ status: string }>(
        ctx.pg,
        "SELECT public.product_1_1_close_failed_operation($1::uuid,$2::uuid,'absent',$3::text) AS r",
        [campaignId, operationId, "generation_failed"],
      );
      if (closed.status !== "refunded") throw new Error(`fixture_close_failed:${fixture.key}`);

      createdCount += 1;
      results.push({
        key: fixture.key,
        skipped: false,
        campaignId,
        operationId,
        status: closed.status,
        direction: fixture.direction,
        restorable: fixture.restorable,
        badgeText: fixture.badgeText,
        url: `${APP_URL}/campanhas/${campaignId}`,
        restoreUrl: `${APP_URL}/campanhas/nova?restoreFrom=${campaignId}`,
      });
    }

    // --- Sem drift de flags + campanhas anteriores preservadas. ---
    const flagsAfter = await ctx.pg.query<{ key: string; enabled: boolean }>(
      "SELECT key,enabled FROM public.feature_flags WHERE key IN ('product_1_1_test_stores_enabled','product_1_1_all_stores_enabled') ORDER BY key",
    );
    if (JSON.stringify(flagsAfter.rows) !== JSON.stringify(flags.rows)) {
      throw new Error("Flag drift detected");
    }
    const campaignsAfter = (
      await ctx.pg.query<{ n: number }>("SELECT count(*)::int AS n FROM public.campaigns WHERE store_id=$1", [storeId])
    ).rows[0]?.n ?? 0;
    if (campaignsAfter !== campaignsBefore + createdCount) {
      throw new Error("Previous campaigns were not preserved (unexpected count delta)");
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "apply",
          localOnly: true,
          providerCalls: 0,
          storeId,
          flags: flagsAfter.rows,
          flagDrift: false,
          initialBalance,
          syntheticTopUp: topUp,
          campaignsBefore,
          campaignsAfter,
          createdCount,
          cases: results,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await closeIsolatedContext(ctx);
  }
}

main().catch((error: unknown) => {
  console.error(
    `visual_uat_fixture_failed: ${error instanceof Error ? error.message : String(error)}; no rollback or cleanup performed; inspect dedicated local UAT fixtures before retry`,
  );
  process.exitCode = 1;
});
