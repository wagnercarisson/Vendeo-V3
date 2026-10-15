// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ admin: {} as Record<string, unknown> }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => {
  const proxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        const inner = h.admin as Record<string | symbol, unknown>;
        const value = inner[prop];
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(inner)
          : value;
      },
    },
  );
  return {
    supabaseAdmin: proxy,
    // `getCampaignForDisplay` (display.ts) usa `createServerClient()`; a prova fala
    // com o Postgres/Storage ISOLADOS reais.
    createServerClient: vi.fn(async () => proxy),
  };
});

import { ProductOneToOneAttemptStartClient } from "../orchestration/attempt-start-client";
import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";
import { readProductOneToOneBackgroundDirection } from "../snapshot/persist-snapshot";
import { getCampaignForDisplay, mapRestoredForm, type CampaignFormRestore } from "@/lib/campaign/display";
import {
  closeIsolatedContext,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  creditOperationRow,
  reserveCredit,
  setCredits,
  type IsolatedContext,
} from "./integration-harness";

/**
 * F56.2b2b — Plano 06 / Task 3: CAMADA 2 / SEAM (c) — CTA `refunded` →
 * `/campanhas/nova?restoreFrom=<campaignId>` → snapshot server-side COM OWNERSHIP
 * + direção de fundo LIDA da EVIDÊNCIA CONGELADA (`operationId` resolvido
 * server-side) → NOVA submissão com NOVOS `campaignId`/`operationId`.
 *
 * Postgres/Storage LOCAIS; provider SIMULADO (nenhuma chamada paga). A prova exige
 * o caminho CTA→formulário→nova identidade: preservar apenas o snapshot no banco
 * NÃO comprova (c).
 */

let ctx: IsolatedContext;
let storeId: string;

const attempts = () => new ProductOneToOneAttemptStartClient(ctx.supabase);
const credit = () => new ProductOneToOneCreditOperationClient(ctx.supabase);

/**
 * Espelha `src/app/(app)/campanhas/nova/page.tsx`: resolve o formulário restaurado
 * SERVER-SIDE com OWNERSHIP. `operationId` resolvido no servidor (NUNCA do
 * cliente) e direção de fundo lida da EVIDÊNCIA CONGELADA. Fail-closed: origem
 * ausente/não-possuída ⇒ `null`.
 */
async function resolveRestoreForm(
  ownerStoreId: string,
  restoreFrom: string | null,
): Promise<CampaignFormRestore | null> {
  if (!restoreFrom) return null;
  const campaign = await getCampaignForDisplay(restoreFrom);
  if (!campaign || campaign.store_id !== ownerStoreId) return null;

  let backgroundDirection: Awaited<ReturnType<typeof readProductOneToOneBackgroundDirection>> = null;
  const operation = await attempts().getCampaignOperation(restoreFrom);
  if (operation) {
    backgroundDirection = await readProductOneToOneBackgroundDirection(ctx.supabase, {
      campaignId: restoreFrom,
      operationId: operation.operationId,
    });
  }
  return mapRestoredForm({
    campaignId: campaign.id,
    inputSnapshot: campaign.input_snapshot,
    identitySnapshot: campaign.identity_snapshot,
    backgroundDirection,
  });
}

/** Insere evidência congelada (frozen evidence) com a direção de fundo dada. */
async function insertFrozenEvidence(
  campaign: string,
  operation: string,
  backgroundDirection: "studio" | "original" | "ambient",
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
    background_direction: backgroundDirection,
    briefing: "briefing congelado",
    reference_selections: [],
    base_version: "v1",
    composer_version: "c1",
    policy_versions: {},
  });
  if (evError) throw new Error(`fixture_evidence_failed:${evError.message}`);
}

/** Campanha restável (snapshot com produto nomeado) pertencente à loja dada. */
async function createRestorableCampaign(ownerStoreId: string): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("campaigns")
    .insert({
      store_id: ownerStoreId,
      status: "ready",
      product_name: "Produto seam c",
      storage_path: `${ownerStoreId}/seam-c.jpg`,
      input_snapshot: {
        product: { name: "Produto seam c", description: "desc" },
        commercial: {
          intent: "offer",
          originalPriceCents: 29990,
          discountedPriceCents: 19990,
          badge: "Promoção",
        },
      },
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`fixture_campaign_failed:${error?.message}`);
  return data.id;
}

describe("F56.2b2b — Camada 2 / SEAM (c): CTA `refunded` → formulário restaurado → NOVA identidade", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
    await setCredits(ctx.pg, storeId, 40);
    // A resolução server-side (`getCampaignForDisplay`) fala com o isolado REAL.
    h.admin = ctx.supabase as unknown as Record<string, unknown>;
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  it("(c1-c3) origem `refunded` resolvida server-side (ownership + direção da evidência) ⇒ NOVA submissão com NOVOS ids", async () => {
    const campaign = await createRestorableCampaign(storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await insertFrozenEvidence(campaign, operation, "ambient");

    // A CTA só existe para o estado `refunded`: estorna a operação (PF completo).
    await ctx.pg.query("SELECT public.product_1_1_record_generation_outcome($1, $2, 'failed', $3)", [
      campaign,
      operation,
      "IMG-SEAM-C",
    ]);
    await credit().closeFailedOperation({
      campaignId: campaign,
      operationId: operation,
      artKind: "absent",
      reason: "generation_failed",
    });
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("refunded");

    // CTA → `/campanhas/nova?restoreFrom=<campaignId>` → resolução SERVER-SIDE.
    const restored = await resolveRestoreForm(storeId, campaign);
    expect(restored).not.toBeNull();
    expect(restored).toMatchObject({
      campaignId: campaign,
      productName: "Produto seam c",
      // Direção lida da EVIDÊNCIA CONGELADA (operationId resolvido server-side).
      backgroundDirection: "ambient",
    });

    // A submissão a partir do formulário restaurado NÃO reusa a operação estornada:
    // persiste uma NOVA campanha/operação.
    const newCampaign = await createCampaign(ctx.supabase, storeId, "Produto seam c (nova)");
    const newOperation = randomUUID();
    await reserveCredit(ctx.pg, storeId, newCampaign, newOperation);
    expect(newCampaign).not.toBe(campaign);
    expect(newOperation).not.toBe(operation);
    expect((await creditOperationRow(ctx.pg, newCampaign, newOperation))?.status).toBe("reserved");
    // A operação antiga permanece terminal (não sobrescrita).
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("refunded");
  }, 90_000);

  it("ownership: origem de OUTRA loja ⇒ `null` (o snapshot NUNCA é fornecido pelo cliente)", async () => {
    const other = await createTestStore(ctx.supabase);
    // A campanha pertence à loja-alvo; a resolução com a loja estranha falha.
    const campaign = await createRestorableCampaign(storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await insertFrozenEvidence(campaign, operation, "studio");

    expect(await resolveRestoreForm(other.storeId, campaign)).toBeNull();
    // A mesma origem resolve corretamente para a loja DONA.
    const owned = await resolveRestoreForm(storeId, campaign);
    expect(owned).toMatchObject({ campaignId: campaign, backgroundDirection: "studio" });
  }, 90_000);

  it("fonte de direção ausente ⇒ escolha obrigatória (NUNCA `studio` silencioso) na resolução server-side", async () => {
    const campaign = await createRestorableCampaign(storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    // Sem evidência congelada ⇒ direção NÃO resolvida.
    const restored = await resolveRestoreForm(storeId, campaign);
    expect(restored).not.toBeNull();
    expect(restored?.backgroundDirection).toBeUndefined();
    expect(restored?.backgroundDirectionUnresolved).toBe(true);
  }, 60_000);
});
