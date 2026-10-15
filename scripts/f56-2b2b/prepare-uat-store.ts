/**
 * F56.2b2b (B2.2 / Plano 07) — PRÉ-CONDIÇÃO da UAT visual: prepara a loja de UAT
 * (SOMENTE `UAT B2.1 Loja`) para passar em `check_store_readiness`.
 *
 * NÃO é onboarding real e NÃO comprova o onboarding: apenas satisfaz a
 * pré-condição do UAT. Escopo estrito (local-only, isolado):
 *   - atualiza SOMENTE os três campos fiscais da loja autorizada; e
 *   - insere UM `store_brand_profiles` de fixture (`status='synced'`, compatível
 *     com o schema/constraints existentes).
 *
 * Fail-closed: se os valores anteriores DIVERGIREM do diagnóstico (algum campo
 * fiscal já preenchido) ou se JÁ existir perfil, PARA sem sobrescrever. As
 * escritas acontecem em UMA transação. NUNCA remove guards, chama provider,
 * aplica migrations ou toca outras lojas/campanhas. Sem cleanup/rollback
 * automático.
 *
 * Modo: DRY-RUN por padrão (nenhuma escrita). Escrever SOMENTE com `--apply`.
 */

import {
  closeIsolatedContext,
  createIsolatedContext,
  type IsolatedContext,
  pgCallJson,
} from "../../src/lib/product-1-1/__tests__/integration-harness";
import { hashCnpjRoot } from "../../src/lib/cnpj/hash";

const PREFLIGHT_TOKEN = "vendeo-f562a-isolated:56321:56322";
const UAT_EMAIL = "uat.b21@vendeo.local";
const UAT_STORE_NAME = "UAT B2.1 Loja";
const EXPECTED_STORE_ID = "8cbc70d5-36b3-496e-8a54-6970899a4b01";

/**
 * CNPJ como VALOR DE FIXTURE do repositório (o mesmo `VALID_CNPJ` usado nos
 * testes). A validade matemática dos dígitos NÃO afirma nada sobre existência
 * real e nenhuma consulta/envio externo é feito.
 */
const FIXTURE_CNPJ = "11222333000181";
const FIXTURE_RAZAO_SOCIAL = "UAT B2.2 Loja de Teste LTDA";
const FIXTURE_NOME_FANTASIA = "UAT B2.2 Teste";

const BRAND_PROFILE_FIXTURE = {
  source: "text_only",
  status: "synced",
  safe_color_tokens: { primary: "#0B6E4F", secondary: "#0E3B2E" },
  visual_style: "limpo e direto (fixture local)",
  visual_tone: "objetivo (fixture local)",
  brand_personality: "comercial e acessivel (fixture local)",
  campaign_guidelines: "fixture local B2.2 — sem uso em producao",
  campaign_brief: "fixture local B2.2 — sem uso em producao",
} as const;

interface StoreRow {
  cnpj_normalized: string | null;
  cnpj_root_hash: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  identity_state: string;
  is_test_store: boolean;
  name: string;
}

async function legalClearanceOk(ctx: IsolatedContext, storeId: string): Promise<boolean> {
  const rows = await ctx.pg.query<{ document_type: string; accepted: string; current: string }>(
    `SELECT av.document_type, av.accepted, cv.version AS current
       FROM (SELECT DISTINCT ON (document_type) document_type, document_version AS accepted
               FROM public.legal_acceptances WHERE store_id=$1
              ORDER BY document_type, accepted_at DESC) av
       JOIN (SELECT DISTINCT ON (document_type) document_type, version
               FROM public.legal_document_versions WHERE effective_at <= now()
              ORDER BY document_type, effective_at DESC) cv USING (document_type)
      WHERE av.document_type IN ('terms_of_service','acceptable_use')`,
    [storeId],
  );
  return (
    rows.rows.length === 2 &&
    rows.rows.every((row) => row.accepted === row.current)
  );
}

async function countScoped(ctx: IsolatedContext, storeId: string): Promise<Record<string, number>> {
  const stores = await ctx.pg.query<{ n: number }>("SELECT count(*)::int AS n FROM public.stores");
  const campaigns = await ctx.pg.query<{ n: number }>("SELECT count(*)::int AS n FROM public.campaigns");
  const ops = await ctx.pg.query<{ n: number }>("SELECT count(*)::int AS n FROM public.product_1_1_campaign_credit_operations");
  const storeCampaigns = await ctx.pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.campaigns WHERE store_id=$1",
    [storeId],
  );
  return {
    stores: stores.rows[0]?.n ?? 0,
    campaigns: campaigns.rows[0]?.n ?? 0,
    creditOperations: ops.rows[0]?.n ?? 0,
    storeCampaigns: storeCampaigns.rows[0]?.n ?? 0,
  };
}

async function main(): Promise<void> {
  if (process.env.B22_VISUAL_PREFLIGHT !== PREFLIGHT_TOKEN) {
    throw new Error("Run the protected isolated preflight and supply its local environment first");
  }
  const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");

  // Constraint `chk_stores_cnpj_atomic`: com CNPJ não-nulo, `cnpj_root_hash` é
  // OBRIGATÓRIO (HMAC-SHA256 do RAIZ de 8 dígitos com `CNPJ_PEPPER`). Sem pepper
  // ⇒ falha fechada (nunca grava hash arbitrário).
  if (!process.env.CNPJ_PEPPER) throw new Error("CNPJ_PEPPER unavailable; refusing to write fiscal data");
  const cnpjRootHash = hashCnpjRoot(FIXTURE_CNPJ.slice(0, 8));

  const ctx = await createIsolatedContext();
  try {
    // --- Loja AUTORIZADA (exatamente uma, de teste, id esperado). ---
    const owners = await ctx.pg.query<{ id: string; is_test_store: boolean }>(
      "SELECT s.id,s.is_test_store FROM public.stores s JOIN auth.users u ON u.id=s.user_id WHERE u.email=$1 AND s.name=$2",
      [UAT_EMAIL, UAT_STORE_NAME],
    );
    if (owners.rows.length !== 1 || owners.rows[0].is_test_store !== true || owners.rows[0].id !== EXPECTED_STORE_ID) {
      throw new Error("Expected exactly the authorized local UAT test store");
    }
    const storeId = owners.rows[0].id;

    // --- Estado anterior: DENTRO do diagnóstico (fiscal vazio) e SEM perfil. ---
    const current = await ctx.pg.query<StoreRow>(
      "SELECT cnpj_normalized,cnpj_root_hash,razao_social,nome_fantasia,identity_state,is_test_store,name FROM public.stores WHERE id=$1",
      [storeId],
    );
    const store = current.rows[0];
    if (!store) throw new Error("UAT store row not found");
    const fiscalFilled = [store.cnpj_normalized, store.razao_social, store.nome_fantasia].filter(
      (value) => value !== null && value !== "",
    );
    const profileCount = await ctx.pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.store_brand_profiles WHERE store_id=$1",
      [storeId],
    );
    if (fiscalFilled.length > 0 || (profileCount.rows[0]?.n ?? 0) > 0) {
      throw new Error("UAT store diverges from diagnosis (fiscal filled or brand profile exists) — refusing to overwrite");
    }

    // --- Flags DEVEM permanecer OFF (sem drift no fim). ---
    const flags = await ctx.pg.query<{ key: string; enabled: boolean }>(
      "SELECT key,enabled FROM public.feature_flags WHERE key IN ('product_1_1_test_stores_enabled','product_1_1_all_stores_enabled') ORDER BY key",
    );
    if (flags.rows.length !== 2 || flags.rows.some((row) => row.enabled !== false)) {
      throw new Error("Product must remain OFF");
    }

    const legalBefore = await legalClearanceOk(ctx, storeId);
    const countsBefore = await countScoped(ctx, storeId);

    const previous = {
      cnpj_normalized: store.cnpj_normalized,
      cnpj_root_hash: store.cnpj_root_hash,
      razao_social: store.razao_social,
      nome_fantasia: store.nome_fantasia,
      brand_profiles: profileCount.rows[0]?.n ?? 0,
    };
    const proposed = {
      cnpj_normalized: FIXTURE_CNPJ,
      cnpj_root_hash: "(computed via CNPJ_PEPPER)",
      razao_social: FIXTURE_RAZAO_SOCIAL,
      nome_fantasia: FIXTURE_NOME_FANTASIA,
      brand_profile: BRAND_PROFILE_FIXTURE,
    };

    if (!apply) {
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: "dry-run",
            localOnly: true,
            providerCalls: 0,
            storeId,
            identityState: store.identity_state,
            cnpjRootHashPresent: cnpjRootHash.length > 0,
            previous,
            proposed,
            flags: flags.rows,
            legalClearanceBefore: legalBefore,
            countsBefore,
            effects: ["stores: UPDATE 3 fiscal columns + cnpj_root_hash", "store_brand_profiles: INSERT +1 (synced)"],
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    // --- Escritas em UMA transação (BEGIN/COMMIT/ROLLBACK). ---
    await ctx.pg.query("BEGIN");
    try {
      const locked = await ctx.pg.query<StoreRow>(
        "SELECT cnpj_normalized,razao_social,nome_fantasia FROM public.stores WHERE id=$1 FOR UPDATE",
        [storeId],
      );
      const lockedStore = locked.rows[0];
      const lockedFilled = [lockedStore?.cnpj_normalized, lockedStore?.razao_social, lockedStore?.nome_fantasia].filter(
        (value) => value !== null && value !== "",
      );
      if (lockedFilled.length > 0) throw new Error("Fiscal values changed before apply — aborting");
      const lockedProfiles = await ctx.pg.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM public.store_brand_profiles WHERE store_id=$1",
        [storeId],
      );
      if ((lockedProfiles.rows[0]?.n ?? 0) > 0) throw new Error("Brand profile appeared before apply — aborting");

      await ctx.pg.query(
        "UPDATE public.stores SET cnpj_normalized=$2, cnpj_root_hash=$3, razao_social=$4, nome_fantasia=$5 WHERE id=$1",
        [storeId, FIXTURE_CNPJ, cnpjRootHash, FIXTURE_RAZAO_SOCIAL, FIXTURE_NOME_FANTASIA],
      );
      await ctx.pg.query(
        `INSERT INTO public.store_brand_profiles
           (store_id, source, status, safe_color_tokens, visual_style, visual_tone,
            brand_personality, campaign_guidelines, campaign_brief)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)`,
        [
          storeId,
          BRAND_PROFILE_FIXTURE.source,
          BRAND_PROFILE_FIXTURE.status,
          JSON.stringify(BRAND_PROFILE_FIXTURE.safe_color_tokens),
          BRAND_PROFILE_FIXTURE.visual_style,
          BRAND_PROFILE_FIXTURE.visual_tone,
          BRAND_PROFILE_FIXTURE.brand_personality,
          BRAND_PROFILE_FIXTURE.campaign_guidelines,
          BRAND_PROFILE_FIXTURE.campaign_brief,
        ],
      );
      await ctx.pg.query("COMMIT");
    } catch (error) {
      await ctx.pg.query("ROLLBACK");
      throw error;
    }

    // --- Pós-condições: readiness ready, legal preservado, sem drift de flags. ---
    const readiness = await pgCallJson<{ ready: boolean; missing: unknown[] }>(
      ctx.pg,
      "SELECT public.check_store_readiness($1) AS r",
      [storeId],
    );
    const flagsAfter = await ctx.pg.query<{ key: string; enabled: boolean }>(
      "SELECT key,enabled FROM public.feature_flags WHERE key IN ('product_1_1_test_stores_enabled','product_1_1_all_stores_enabled') ORDER BY key",
    );
    const flagDrift = JSON.stringify(flagsAfter.rows) !== JSON.stringify(flags.rows);
    const legalAfter = await legalClearanceOk(ctx, storeId);
    const countsAfter = await countScoped(ctx, storeId);

    const otherStoresUntouched =
      countsAfter.stores === countsBefore.stores &&
      countsAfter.campaigns === countsBefore.campaigns &&
      countsAfter.creditOperations === countsBefore.creditOperations &&
      countsAfter.storeCampaigns === countsBefore.storeCampaigns;

    if (readiness.ready !== true) throw new Error("readiness did not become ready");
    if (flagDrift) throw new Error("Flag drift detected");
    if (!legalAfter) throw new Error("Legal clearance not preserved");
    if (!otherStoresUntouched) throw new Error("Unexpected changes outside the authorized store");

    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "apply",
          localOnly: true,
          providerCalls: 0,
          storeId,
          previous,
          applied: proposed,
          readiness,
          flagDrift,
          legalClearanceBefore: legalBefore,
          legalClearanceAfter: legalAfter,
          countsBefore,
          countsAfter,
          otherStoresUntouched,
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
    `uat_store_prep_failed: ${error instanceof Error ? error.message : String(error)}; no automatic cleanup or rollback performed; inspect the authorized local UAT store before retry`,
  );
  process.exitCode = 1;
});
