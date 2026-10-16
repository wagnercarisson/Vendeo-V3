// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { Store } from "@/lib/store";

/**
 * F56.2b2b — Plano 06 / Task 3: CAMADA 2 / SEAM (c) — CTA `refunded` →
 * `/campanhas/nova?restoreFrom=<campaignId>` → PÁGINA REAL (ownership +
 * direção de fundo LIDA da EVIDÊNCIA CONGELADA, `operationId` server-side) →
 * CADEIA REAL `CampaignPageClient` → `CampaignInputForm` → `useCampaignForm` →
 * NOVA submissão com NOVOS `campaignId`/`operationId`.
 *
 * Postgres/Storage LOCAIS (instância descartável isolada); provider SIMULADO
 * (nenhuma chamada paga). A prova NÃO reimplementa a lógica da página: o
 * `restoredForm` é obtido chamando o COMPONENTE/SERVIDOR REAL com auth
 * simulada e backend isolado REAL. Preservar apenas o snapshot no banco NÃO
 * comprova (c) — a prova exige o caminho CTA→formulário→nova identidade.
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const STORE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_STORE_ID = "99999999-9999-4999-8999-999999999999";
const VALID_DATA_URL = "data:image/jpeg;base64,QUJD";
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// O backend ISOLADO REAL é injetado nos mocks (nunca produção/rede externa).
// A página REAL e `getCampaignForDisplay` falam com o Postgres isolado via este
// Proxy. Auth é SIMULADA.
const h = vi.hoisted(() => ({
  client: null as unknown as Record<string | symbol, unknown>,
  userId: "00000000-0000-4000-8000-000000000001",
  storeId: "11111111-1111-4111-8111-111111111111",
}));
const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => {
  const proxy = new Proxy(
    {},
    {
      get: (_target, prop) => {
        const inner = h.client;
        if (!inner) return undefined;
        const value = inner[prop];
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(inner)
          : value;
      },
    },
  );
  return { supabaseAdmin: proxy, createServerClient: vi.fn(async () => proxy) };
});

// Auth/CSRF SIMULADOS: identidade e loja atuais vêm do holder (backend REAL).
vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: vi.fn(async () => ({ userId: h.userId })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: vi.fn(async () => ({ id: h.storeId })),
}));
vi.mock("@/lib/legal/clearance", () => ({
  requireLegalClearance: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: class {
    async getBalance() {
      return 5;
    }
  },
}));
vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: () => ({ generationPaused: false }),
}));
vi.mock("@/components/legal/legal-clearance-gate", () => ({
  LegalClearanceGate: () => null,
}));
vi.mock("@/lib/store-readiness", () => ({
  getStoreReadiness: vi.fn(async () => ({ ready: true, missing: [] })),
}));
vi.mock("@/lib/store-identity-service", () => ({
  resolveStoreIdentity: vi.fn(async () => ({})),
  validateIdentityReference: vi.fn(async () => null),
}));
vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: vi.fn(() => ({})),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, refresh: nav.refresh }),
  useSearchParams: () => new URLSearchParams(),
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

// Folhas da cadeia REAL (não são elos da prova): neutralizadas para reduzir
// ruído — a cadeia `CampaignPageClient → CampaignInputForm → useCampaignForm`
// permanece REAL.
vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => ({
    costs: { campaign_generation: { costCredits: 1, enabled: true } },
    status: "loaded",
    refetch: vi.fn(),
  }),
}));
vi.mock("@/components/credit/credit-cta", () => ({ CreditCta: () => null }));
vi.mock("@/components/campaign/mandatory-artwork-field", () => ({
  MandatoryArtworkField: () => null,
}));
vi.mock("@/components/campaign/illustrative-notice-field", () => ({
  IllustrativeNoticeField: () => null,
}));
vi.mock("@/components/campaign/validity-field", () => ({ ValidityField: () => null }));
vi.mock("@/components/flow/generation-progress", () => ({
  GenerationProgress: () => null,
}));
vi.mock("@/components/flow/campaign-image-upload", () => ({
  CampaignImageUpload: () => null,
}));

import { ProductOneToOneAttemptStartClient } from "../orchestration/attempt-start-client";
import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";
import { CampaignPageClient } from "@/components/flow/campaign-page-client";
import { RefundedPanel } from "@/components/flow/refunded-panel";
import { useCampaignForm } from "@/components/flow/use-campaign-form";
import type { CampaignFormRestore } from "@/lib/campaign/display";
import {
  closeIsolatedContext,
  createIsolatedContext,
  createTestStore,
  creditOperationRow,
  reserveCredit,
  setCredits,
  type IsolatedContext,
} from "./integration-harness";

let ctx: IsolatedContext;
let storeId: string;

const credit = () => new ProductOneToOneCreditOperationClient(ctx.supabase);

const STORE = {
  id: STORE_ID,
  name: "Loja Teste",
  segment: "moda",
  brand_color: "#111111",
} as unknown as Store;

/** Chama o COMPONENTE/SERVIDOR REAL `/campanhas/nova` e devolve o `restoredForm`. */
async function renderNova(restoreFrom: string): Promise<CampaignFormRestore | null> {
  const { default: NovaCampanhaPage } = await import("@/app/(app)/campanhas/nova/page");
  const el = (await NovaCampanhaPage({
    searchParams: Promise.resolve({ restoreFrom }),
  })) as unknown as {
    props: { children: { props: { restoredForm: CampaignFormRestore | null } } };
  };
  return el.props.children.props.restoredForm;
}

/** Campanha restável (snapshot com produto nomeado) pertencente à loja dada. */
async function createRestorableCampaign(
  ownerStoreId: string,
  productName = "Produto seam c",
): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("campaigns")
    .insert({
      store_id: ownerStoreId,
      status: "ready",
      product_name: productName,
      storage_path: `${ownerStoreId}/${randomUUID()}.jpg`,
      input_snapshot: {
        product: { name: productName, description: "desc" },
        commercial: {
          intent: "offer",
          originalPriceCents: 29990,
          discountedPriceCents: 19990,
          badgeText: "Promoção",
        },
      },
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`fixture_campaign_failed:${error?.message}`);
  return data.id;
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

/** Leva a campanha ao estado `refunded` (a CTA só existe nesse terminal). */
async function makeRefunded(campaign: string, direction: "studio" | "original" | "ambient"): Promise<string> {
  const operation = randomUUID();
  await reserveCredit(ctx.pg, storeId, campaign, operation);
  await insertFrozenEvidence(campaign, operation, direction);
  await ctx.pg.query(
    "SELECT public.product_1_1_record_generation_outcome($1, $2, 'failed', $3)",
    [campaign, operation, "IMG-SEAM-C"],
  );
  await credit().closeFailedOperation({
    campaignId: campaign,
    operationId: operation,
    artKind: "absent",
    observedEpoch: (
      await ctx.pg.query<{ state_epoch: number }>(
        "SELECT state_epoch FROM public.product_1_1_campaign_credit_operations WHERE campaign_id=$1 AND operation_id=$2",
        [campaign, operation],
      )
    ).rows[0].state_epoch,
    reason: "generation_failed",
  });
  expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("refunded");
  return operation;
}

describe("F56.2b2b — Camada 2 / SEAM (c): página REAL → formulário REAL → NOVA identidade", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
    await setCredits(ctx.pg, storeId, 40);
    h.client = ctx.supabase as unknown as Record<string | symbol, unknown>;
    h.storeId = storeId;
    h.userId = store.userId;
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("(c1-c3) CTA → PÁGINA REAL (ownership + direção da evidência) → CADEIA REAL → submissão com NOVOS ids", async () => {
    const campaign = await createRestorableCampaign(storeId);
    const sourceOperation = await makeRefunded(campaign, "ambient");

    // O `restoredForm` vem da PÁGINA REAL (não de uma reimplementação local).
    const restored = await renderNova(campaign);
    expect(restored).not.toBeNull();
    expect(restored).toMatchObject({
      campaignId: campaign,
      productName: "Produto seam c",
      // Direção lida da EVIDÊNCIA CONGELADA (operationId resolvido server-side).
      backgroundDirection: "ambient",
    });
    expect(restored?.backgroundDirectionUnresolved).toBeFalsy();

    // (c1) CTA REAL `refunded` → `/campanhas/nova?restoreFrom=<campaignId>`.
    const cta = render(
      createElement(RefundedPanel, {
        campaignId: campaign,
        confirmed: true,
        supportEmail: "suporte@vendeo.test",
        restoredForm: restored,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Voltar aos dados da campanha/ }));
    expect(nav.push).toHaveBeenCalledWith(`/campanhas/nova?restoreFrom=${campaign}`);
    cta.unmount();

    // (c2) A CADEIA REAL reflete o formulário restaurado preenchido + direção.
    const chain = render(
      createElement(CampaignPageClient, {
        store: STORE,
        balance: 5,
        supportEmail: "suporte@vendeo.test",
        identity: null,
        eligible: true,
        restoredForm: restored,
      }),
    );
    expect(screen.getByLabelText(/Nome do Produto/)).toHaveValue("Produto seam c");
    expect(screen.getByRole("radio", { name: "Ambientado" })).toBeChecked();
    chain.unmount();

    // (c3) A SUBMISSÃO a partir do formulário restaurado gera NOVOS ids.
    sessionStorage.setItem(`campaign_draft_image:${campaign}`, VALID_DATA_URL);
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"type":"phase","phase":"generating","status":"start"}\n', { status: 200 }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() =>
      useCampaignForm(storeId, { eligible: true, restoredForm: restored }),
    );
    await waitFor(() => expect(result.current.fields.productName).toBe("Produto seam c"));
    expect(result.current.fields.backgroundDirection).toBe("ambient");
    expect(result.current.backgroundDirectionRequired).toBe(false);

    await act(async () => {
      expect(await result.current.enterReview()).toBe(true);
    });
    await act(async () => {
      await result.current.confirmReview();
    });

    const generateCalls = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes("/api/campaign/generate-image"),
    );
    expect(generateCalls.length).toBeGreaterThan(0);
    const body = JSON.parse(String((generateCalls[0][1] as RequestInit).body)) as {
      campaignId?: string;
      operationId?: string;
      backgroundDirection?: string;
    };
    expect(body.campaignId).toMatch(UUID_V4);
    expect(body.operationId).toMatch(UUID_V4);
    // NUNCA reusa a identidade da campanha/operação estornada.
    expect(body.campaignId).not.toBe(campaign);
    expect(body.operationId).not.toBe(sourceOperation);
    // A direção RESTAURADA da evidência congelada viaja no corpo.
    expect(body.backgroundDirection).toBe("ambient");
  }, 90_000);

  it("ownership divergente ⇒ a PÁGINA REAL não fornece NENHUM dado", async () => {
    const otherStore = await createTestStore(ctx.supabase);
    const campaign = await createRestorableCampaign(storeId);
    await makeRefunded(campaign, "studio");

    // A loja corrente é OUTRA: a origem não é possuída ⇒ `restoredForm` nulo.
    h.storeId = otherStore.storeId;
    const restored = await renderNova(campaign);
    expect(restored).toBeNull();
    h.storeId = storeId;

    // A MESMA origem, para a loja DONA, resolve corretamente.
    const owned = await renderNova(campaign);
    expect(owned).toMatchObject({ campaignId: campaign, backgroundDirection: "studio" });
  }, 90_000);

  it("fonte de direção ausente ⇒ escolha obrigatória (NUNCA `studio` silencioso) na PÁGINA REAL", async () => {
    const campaign = await createRestorableCampaign(storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    // Sem evidência congelada ⇒ direção NÃO resolvida (exercita a página REAL).
    const restored = await renderNova(campaign);
    expect(restored).not.toBeNull();
    expect(restored?.backgroundDirection).toBeUndefined();
    expect(restored?.backgroundDirectionUnresolved).toBe(true);

    // A cadeia REAL bloqueia o avanço até a escolha EXPLÍCITA.
    render(
      createElement(CampaignPageClient, {
        store: STORE,
        balance: 5,
        identity: null,
        eligible: true,
        restoredForm: restored,
      }),
    );
    expect(
      screen.getByRole("button", { name: /Revisar e gerar/ }),
    ).toBeDisabled();
  }, 60_000);
});
