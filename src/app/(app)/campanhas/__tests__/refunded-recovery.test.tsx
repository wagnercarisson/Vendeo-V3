// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, renderHook, act, waitFor } from "@testing-library/react";
import type { Store } from "@/lib/store";

// ---------------------------------------------------------------------------
// F56.2b2b (B2.2 / C4 / B2B-D5 / B2B-D9) — PROVA ÚNICA: painel `refunded`,
// restauração do formulário a partir do SERVIDOR, transporte autenticado/ownership,
// escopo do rascunho por campanha e NOVOS IDs de submissão.
//
// A prova de restauração (3)/(9) atravessa a CADEIA REAL: `CampaignPageClient` →
// `CampaignInputForm` → `useCampaignForm` — SEM mockar o elo intermediário. O
// snapshot é injetado por PROP (`restoredForm`), como em `/campanhas/nova`.
// ---------------------------------------------------------------------------

const USER_ID = "00000000-0000-4000-8000-000000000001";
const STORE_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_CAMPAIGN_ID = "44444444-4444-4444-8444-444444444444";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_DATA_URL = "data:image/jpeg;base64,QUJD";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

// P1 — `persist-snapshot.ts`/`attempt-start-client` são `server-only`.
vi.mock("server-only", () => ({}));

// Fake do cliente Supabase admin: o leitor de direção de fundo da EVIDÊNCIA
// CONGELADA (somente-leitura) consulta `product_1_1_snapshot_frozen_evidence`.
const { mockSupabaseAdmin, mockEvidence } = vi.hoisted(() => {
  const state: { row: unknown; error: { message: string } | null } = {
    row: null,
    error: null,
  };
  const builder = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: state.row, error: state.error }),
  };
  return { mockSupabaseAdmin: builder, mockEvidence: state };
});

// O `operationId` da operação PERSISTIDA é resolvido SERVER-SIDE (nunca do
// cliente) — mockado no cliente fino.
const { mockGetCampaignOperation } = vi.hoisted(() => ({
  mockGetCampaignOperation: vi.fn(),
}));
vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    getCampaignOperation(campaignId: string) {
      return mockGetCampaignOperation(campaignId);
    }
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

// Cadeia REAL do formulário: NÃO mockar `use-campaign-form`/`use-input-preservation`.
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
// Folha (não é elo da cadeia): expõe os productImages restaurados para asserção.
vi.mock("@/components/flow/campaign-image-upload", () => ({
  CampaignImageUpload: ({
    productImages,
  }: {
    productImages?: Array<{ dataUrl?: string }>;
  }) => (
    <div data-testid="product-images">
      {(productImages ?? []).map((p, i) => (
        <img key={i} data-testid="product-image" src={p.dataUrl} alt={`imagem-${i}`} />
      ))}
    </div>
  ),
}));

// --- Mock do servidor `/campanhas/nova` (ownership + resolução do snapshot) ---
vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: vi.fn(async () => ({ userId: USER_ID })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: vi.fn(async () => ({ id: STORE_ID })),
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
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({})),
  supabaseAdmin: mockSupabaseAdmin,
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
  resolveProductFlowAuthorization: vi.fn(async () => ({ allowed: false })),
}));
vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: vi.fn(() => ({})),
}));

const { mockGetCampaignForDisplay } = vi.hoisted(() => ({
  mockGetCampaignForDisplay: vi.fn(),
}));
vi.mock("@/lib/campaign/display", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/campaign/display")>();
  return { ...actual, getCampaignForDisplay: mockGetCampaignForDisplay };
});

import { CampaignPageClient } from "@/components/flow/campaign-page-client";
import { RefundedPanel } from "@/components/flow/refunded-panel";
import {
  REFUNDED_ACTION_ERROR_MESSAGE,
  REFUNDED_CONFIRMED_UNAVAILABLE_MESSAGE,
  REFUNDED_DATA_UNAVAILABLE_NOTICE,
  REFUNDED_EXACT_MESSAGE,
  REFUNDED_NEW_GENERATION_NOTICE,
  REFUNDED_SCOPE_NOTE,
  REFUNDED_SUPPORT_CTA,
  REFUNDED_UNCONFIRMED_MESSAGE,
} from "@/components/flow/refunded-panel";
import { mapRestoredForm } from "@/lib/campaign/display";
import type { CampaignFormRestore } from "@/lib/campaign/display";
import { buildCampaignBriefFromFlat, buildCampaignBriefSnapshot } from "@/lib/campaign/brief";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";
import {
  BACKGROUND_DIRECTION_REQUIRED_ERROR,
  BACKGROUND_DIRECTION_UNRESOLVED_NOTICE,
  useCampaignForm,
} from "@/components/flow/use-campaign-form";

const STORE = {
  id: STORE_ID,
  name: "Loja Teste",
  segment: "moda",
  brand_color: "#111111",
} as unknown as Store;

const INPUT_SNAPSHOT: Record<string, unknown> = {
  schemaVersion: "campaign_brief_v1",
  product: {
    source: "manual",
    name: "Tênis Runner Pro",
    description: "Leve e confortável",
  },
  commercial: {
    intent: "offer",
    originalPriceCents: 29990,
    discountedPriceCents: 19990,
    badgeText: "Promoção",
    validity: { enabled: true, displayText: "somente hoje" },
    legalNotice: { enabled: true, text: "Imagem ilustrativa" },
  },
  media: { images: [] },
  creativeContext: { preserveImageContext: false },
  metadata: { source: "web_form" },
  identityDirective: "tom acolhedor",
  frozenContentReferences: [{ kind: "product", id: "c1", role: "primary", index: 0 }],
};

function restoreFor(
  campaignId: string,
  direction?: "studio" | "original" | "ambient",
): CampaignFormRestore {
  const restore = mapRestoredForm({
    campaignId,
    inputSnapshot: INPUT_SNAPSHOT,
    ...(direction ? { backgroundDirection: direction } : {}),
  });
  if (!restore) throw new Error("fixture: mapRestoredForm retornou null");
  return restore;
}

// P1 — snapshot REAL produzido pelos builders canônicos (`buildCampaignBriefFromFlat`
// + `buildCampaignBriefSnapshot`): NÃO contém direção de fundo — ela vive na
// EVIDÊNCIA CONGELADA (lida server-side).
const BRIEF_INPUT = {
  storeId: STORE_ID,
  productName: "Tênis Runner Pro",
  description: "Leve e confortável",
  originalPriceCents: 29990,
  discountedPriceCents: 19990,
  badgeText: "Promoção",
  campaignIntent: "offer",
  validity: "somente hoje",
  mandatoryArtworkText: "Imagem ilustrativa",
} as unknown as GenerateImageRequest;

function realSnapshot(): Record<string, unknown> {
  return buildCampaignBriefSnapshot(
    buildCampaignBriefFromFlat(BRIEF_INPUT, STORE_ID),
  ) as unknown as Record<string, unknown>;
}

function campaignRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: SOURCE_CAMPAIGN_ID,
    store_id: STORE_ID,
    status: "error",
    product_name: "Tênis Runner Pro",
    input_snapshot: INPUT_SNAPSHOT,
    identity_snapshot: null,
    generation_metadata: null,
    render_snapshot: null,
    publication_copy_snapshot: null,
    publication_copy_current: null,
    storage_path: `${STORE_ID}/${SOURCE_CAMPAIGN_ID}.jpg`,
    error_message: null,
    approval_status: "pending_approval",
    rejection_count: 0,
    approved_version_id: null,
    approved_at: null,
    operation_run_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function renderNova(restoreFrom?: string) {
  const { default: NovaCampanhaPage } = await import(
    "@/app/(app)/campanhas/nova/page"
  );
  const el = (await NovaCampanhaPage({
    searchParams: Promise.resolve(restoreFrom ? { restoreFrom } : {}),
  })) as unknown as { props: { children: { props: { restoredForm: CampaignFormRestore | null } } } };
  return el.props.children.props;
}

/** Renderiza a cadeia REAL `CampaignPageClient` → `CampaignInputForm` → `useCampaignForm`. */
function renderChain(restoredForm: CampaignFormRestore | null) {
  return render(
    <CampaignPageClient
      store={STORE}
      balance={5}
      supportEmail="suporte@vendeo.test"
      identity={null}
      eligible
      restoredForm={restoredForm}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockGetCampaignForDisplay.mockResolvedValue(campaignRecord());
  mockEvidence.row = null;
  mockEvidence.error = null;
  mockGetCampaignOperation.mockResolvedValue({
    campaignId: SOURCE_CAMPAIGN_ID,
    operationId: SOURCE_OPERATION_ID,
    status: "refunded",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// (1) `refunded` confirmado ⇒ mensagem EXATA + CTA + nota de escopo.
// (2) Estorno NÃO confirmado ⇒ amber HONESTO, SEM anunciar crédito.
// ---------------------------------------------------------------------------
describe("RefundedPanel — mensagem exata só com estorno confirmado (1) e amber honesto (2)", () => {
  it("(1) confirmado ⇒ mensagem EXATA + nota de escopo + aviso de nova geração + CTA com origem", () => {
    render(
      <RefundedPanel
        campaignId={SOURCE_CAMPAIGN_ID}
        supportEmail="suporte@vendeo.test"
        confirmed
        restoredForm={restoreFor(SOURCE_CAMPAIGN_ID)}
      />,
    );

    expect(screen.getByText(REFUNDED_EXACT_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(REFUNDED_SCOPE_NOTE)).toBeInTheDocument();
    expect(screen.getByText(REFUNDED_NEW_GENERATION_NOTICE)).toBeInTheDocument();

    const cta = screen.getByRole("button", { name: /Voltar aos dados da campanha/ });
    expect(cta).toBeInTheDocument();
    expect(screen.getByRole("button", { name: REFUNDED_SUPPORT_CTA })).toBeInTheDocument();

    // A CTA NÃO reabre a operação: navega para a NOVA geração com a origem.
    cta.click();
    expect(mockPush).toHaveBeenCalledWith(
      `/campanhas/nova?restoreFrom=${SOURCE_CAMPAIGN_ID}`,
    );
  });

  it("(1b) estorno CONFIRMADO sem restauração ⇒ informa o estorno SEPARADAMENTE, sem prometer dados/CTA", () => {
    render(<RefundedPanel campaignId={SOURCE_CAMPAIGN_ID} confirmed restoredForm={null} />);

    expect(screen.getByText(REFUNDED_CONFIRMED_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(REFUNDED_DATA_UNAVAILABLE_NOTICE)).toBeInTheDocument();
    // NÃO promete "dados preservados" nem "gerar novamente com meus dados".
    expect(screen.queryByText(REFUNDED_EXACT_MESSAGE)).toBeNull();
    expect(screen.queryByText(REFUNDED_SCOPE_NOTE)).toBeNull();
    expect(screen.queryByText(REFUNDED_NEW_GENERATION_NOTICE)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Voltar aos dados da campanha/ }),
    ).toBeNull();
    const verifyButton = screen.getByRole("button", { name: "Verificar novamente" });
    const refreshIcon = verifyButton.querySelector("svg");
    expect(refreshIcon).toHaveClass("lucide-refresh-cw", "h-4", "w-4");
    expect(refreshIcon).toHaveAttribute("aria-hidden", "true");
    expect(verifyButton.firstElementChild).toBe(refreshIcon);
    verifyButton.click();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("(2) NÃO confirmado ⇒ amber honesto, SEM anunciar crédito devolvido", () => {
    render(
      <RefundedPanel
        campaignId={SOURCE_CAMPAIGN_ID}
        supportEmail="suporte@vendeo.test"
        confirmed={false}
      />,
    );

    expect(screen.getByText(REFUNDED_UNCONFIRMED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(REFUNDED_EXACT_MESSAGE)).toBeNull();
    expect(screen.queryByText(/crédito foi estornado/)).toBeNull();
    expect(screen.queryByText(REFUNDED_NEW_GENERATION_NOTICE)).toBeNull();
    // Re-verificação é query-only (refresh) — nunca inicia geração.
    const verifyButton = screen.getByRole("button", { name: "Verificar novamente" });
    const refreshIcon = verifyButton.querySelector("svg");
    expect(refreshIcon).toHaveClass("lucide-refresh-cw", "h-4", "w-4");
    expect(refreshIcon).toHaveAttribute("aria-hidden", "true");
    expect(verifyButton.firstElementChild).toBe(refreshIcon);
    verifyButton.click();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("erro de rede/validação ⇒ accent-red (role=alert), sem alterar a mensagem confirmada", () => {
    render(
      <RefundedPanel
        campaignId={SOURCE_CAMPAIGN_ID}
        confirmed
        restoredForm={restoreFor(SOURCE_CAMPAIGN_ID)}
        actionError={REFUNDED_ACTION_ERROR_MESSAGE}
      />,
    );

    const alert = screen.getByText(REFUNDED_ACTION_ERROR_MESSAGE);
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute("role", "alert");
    expect(screen.getByText(REFUNDED_EXACT_MESSAGE)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// (5)/(6) Transporte AUTENTICADO com OWNERSHIP em `/campanhas/nova`.
// ---------------------------------------------------------------------------
describe("campanhas/nova — transporte autenticado/ownership do snapshot (5)(6)", () => {
  it("(5) origem VÁLIDA + ownership OK ⇒ snapshot resolvido server-side e passado à página", async () => {
    const props = await renderNova(SOURCE_CAMPAIGN_ID);

    expect(props.restoredForm).not.toBeNull();
    expect(props.restoredForm?.campaignId).toBe(SOURCE_CAMPAIGN_ID);
    expect(props.restoredForm?.productName).toBe("Tênis Runner Pro");
    expect(mockGetCampaignForDisplay).toHaveBeenCalledWith(SOURCE_CAMPAIGN_ID);
  });

  it("(6a) origem NÃO-POSSUÍDA (store divergente) ⇒ snapshot `null` (sem promessa falsa)", async () => {
    mockGetCampaignForDisplay.mockResolvedValue(
      campaignRecord({ store_id: "99999999-9999-4999-8999-999999999999" }),
    );

    const props = await renderNova(SOURCE_CAMPAIGN_ID);

    expect(props.restoredForm).toBeNull();
  });

  it("(6b) origem AUSENTE ⇒ snapshot `null` (não consulta a campanha)", async () => {
    const props = await renderNova(undefined);

    expect(props.restoredForm).toBeNull();
    expect(mockGetCampaignForDisplay).not.toHaveBeenCalled();
  });

  it("(6c) leitura da campanha FALHA ⇒ snapshot `null` (fail-closed)", async () => {
    mockGetCampaignForDisplay.mockRejectedValue(new Error("read failed"));

    const props = await renderNova(SOURCE_CAMPAIGN_ID);

    expect(props.restoredForm).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// (3)/(4)/(7)/(9) Cadeia REAL: campos de fato RESTAURADOS + escopo do rascunho.
// ---------------------------------------------------------------------------
describe("Cadeia REAL — restauração/predraça do formulário (3)(4)(7)(9)", () => {
  it("(3) `restoredForm` + SEM rascunho ⇒ campos server-side RESTAURADOS no formulário + aviso de imagem", () => {
    renderChain(restoreFor(SOURCE_CAMPAIGN_ID));

    expect(screen.getByLabelText(/Nome do Produto/)).toHaveValue("Tênis Runner Pro");
    expect(screen.getByDisplayValue("Leve e confortável")).toBeInTheDocument();
    // Aviso HONESTO de imagem (client-only) — nunca promete restauração.
    expect(screen.getByText(REFUNDED_SCOPE_NOTE)).toBeInTheDocument();
  });

  it("(3b) CAMPOS retidos APÓS os efeitos do formulário (intenção, preços, selo, validade, texto obrigatório)", () => {
    const restored = restoreFor(SOURCE_CAMPAIGN_ID);
    const { result } = renderHook(() =>
      useCampaignForm(STORE_ID, { eligible: true, restoredForm: restored }),
    );

    // Assert no ESTADO do formulário após a hidratação (não apenas na prop recebida).
    expect(result.current.fields.productName).toBe("Tênis Runner Pro");
    expect(result.current.fields.campaignIntent).toBe("offer");
    expect(result.current.fields.originalPriceCents).toBe(29990);
    expect(result.current.fields.discountedPriceCents).toBe(19990);
    expect(result.current.fields.badge).toBe("Promoção");
    expect(result.current.fields.validityMode).toBe("custom");
    expect(result.current.fields.validityCustomText).toBe("somente hoje");
    expect(result.current.fields.mandatoryArtworkTextFree).toBe("Imagem ilustrativa");
    // P1 — fonte da direção AUSENTE (sem evidência) ⇒ NÃO pré-seleciona `studio`:
    // a direção fica indefinida e exige escolha EXPLÍCITA.
    expect(result.current.fields.backgroundDirection).toBeUndefined();
    expect(result.current.backgroundDirectionRequired).toBe(true);
    expect(result.current.backgroundDirectionNotice).toBe(
      BACKGROUND_DIRECTION_UNRESOLVED_NOTICE,
    );
  });

  it("(3c) rascunho SEM direção + evidência Original/Ambientado ⇒ usa a direção RECUPERADA do servidor", () => {
    for (const direction of ["original", "ambient"] as const) {
      sessionStorage.clear();
      sessionStorage.setItem(
        `campaign_draft:${SOURCE_CAMPAIGN_ID}`,
        JSON.stringify({
          productName: "Rascunho sem direção",
          campaignIntent: "offer",
          originalPriceCents: 10000,
          discountedPriceCents: 9000,
          badge: "Promoção",
          productImages: [],
        }),
      );
      const { result } = renderHook(() =>
        useCampaignForm(STORE_ID, {
          eligible: true,
          restoredForm: restoreFor(SOURCE_CAMPAIGN_ID, direction),
        }),
      );
      // Direção RECUPERADA do SERVIDOR (o rascunho não a tinha) — não `studio`.
      expect(result.current.fields.backgroundDirection).toBe(direction);
      expect(result.current.backgroundDirectionRequired).toBe(false);
      // Demais campos do rascunho preservados.
      expect(result.current.fields.productName).toBe("Rascunho sem direção");
      expect(result.current.fields.badge).toBe("Promoção");
    }
  });

  it("(3d) rascunho SEM direção + evidência INDISPONÍVEL ⇒ sem seleção + escolha OBRIGATÓRIA", () => {
    sessionStorage.setItem(
      `campaign_draft:${SOURCE_CAMPAIGN_ID}`,
      JSON.stringify({
        productName: "Rascunho sem direção",
        campaignIntent: "offer",
        originalPriceCents: 10000,
        discountedPriceCents: 9000,
        badge: "Promoção",
        productImages: [],
      }),
    );
    const { result } = renderHook(() =>
      useCampaignForm(STORE_ID, {
        eligible: true,
        restoredForm: restoreFor(SOURCE_CAMPAIGN_ID), // evidência indisponível
      }),
    );
    // NUNCA o `studio` inicial do formulário como prova de escolha.
    expect(result.current.fields.backgroundDirection).toBeUndefined();
    expect(result.current.backgroundDirectionRequired).toBe(true);
    // O rascunho do produto ainda é preservado.
    expect(result.current.fields.productName).toBe("Rascunho sem direção");
  });

  it("(4) SEM rascunho E SEM snapshot ⇒ SEM promessa falsa (campos vazios, sem aviso)", () => {
    renderChain(null);

    expect(screen.getByLabelText(/Nome do Produto/)).toHaveValue("");
    expect(screen.queryByText(REFUNDED_SCOPE_NOTE)).toBeNull();
  });

  it("(7) rascunho de OUTRA campanha é IGNORADO (escopo por campanha)", () => {
    sessionStorage.setItem(
      `campaign_draft:${OTHER_CAMPAIGN_ID}`,
      JSON.stringify({
        productName: "Produto de OUTRA campanha",
        campaignIntent: "offer",
        originalPriceCents: 10000,
        discountedPriceCents: 9000,
        badge: "Promoção",
        productImages: [],
      }),
    );

    renderChain(restoreFor(SOURCE_CAMPAIGN_ID));

    // O rascunho de OUTRA campanha NÃO é aplicado: vale o snapshot do SERVIDOR.
    expect(screen.getByLabelText(/Nome do Produto/)).toHaveValue("Tênis Runner Pro");
    expect(screen.queryByDisplayValue("Produto de OUTRA campanha")).toBeNull();
  });

  it("(9) mount-clear remove SOMENTE chaves legadas e PRESERVA rascunhos de OUTRAS campanhas", () => {
    // Chaves LEGADAS GLOBAIS (a remover) + escopadas de ALVO e de OUTRA campanha.
    sessionStorage.setItem("campaign_draft", JSON.stringify({ productName: "legado" }));
    sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);
    sessionStorage.setItem("campaign_preview", "preview");
    sessionStorage.setItem(
      `campaign_draft:${SOURCE_CAMPAIGN_ID}`,
      JSON.stringify({
        productName: "Rascunho da campanha-alvo",
        campaignIntent: "offer",
        originalPriceCents: 10000,
        discountedPriceCents: 9000,
        badge: "Promoção",
        productImages: [],
      }),
    );
    sessionStorage.setItem(`campaign_draft_image:${SOURCE_CAMPAIGN_ID}`, VALID_DATA_URL);
    sessionStorage.setItem(
      `campaign_draft:${OTHER_CAMPAIGN_ID}`,
      JSON.stringify({ productName: "OUTRA", productImages: [] }),
    );

    renderChain(restoreFor(SOURCE_CAMPAIGN_ID));

    // O texto e a imagem da campanha-ALVO sobrevivem ao clear (chave escopada).
    expect(screen.getByLabelText(/Nome do Produto/)).toHaveValue("Rascunho da campanha-alvo");
    const img = screen.getByTestId("product-image");
    expect(img).toHaveAttribute("src", VALID_DATA_URL);
    expect(sessionStorage.getItem(`campaign_draft:${SOURCE_CAMPAIGN_ID}`)).not.toBeNull();
    expect(sessionStorage.getItem(`campaign_draft_image:${SOURCE_CAMPAIGN_ID}`)).toBe(
      VALID_DATA_URL,
    );
    // IGNORAR um rascunho alheio NÃO significa apagá-lo: a OUTRA campanha é PRESERVADA.
    expect(sessionStorage.getItem(`campaign_draft:${OTHER_CAMPAIGN_ID}`)).not.toBeNull();
    // As chaves LEGADAS GLOBAIS são removidas pelo mount-clear.
    expect(sessionStorage.getItem("campaign_draft")).toBeNull();
    expect(sessionStorage.getItem("campaign_draft_image")).toBeNull();
    expect(sessionStorage.getItem("campaign_preview")).toBeNull();
    // Sem aviso de imagem: a imagem da campanha-alvo foi restaurada.
    expect(screen.queryByText(REFUNDED_SCOPE_NOTE)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// (8) Nova submissão ⇒ NOVOS `campaignId`/`operationId` (nunca reusa a operação
// estornada). Exercita o hook REAL (`useCampaignForm`) com o snapshot por prop.
// ---------------------------------------------------------------------------
describe("(8) submissão a partir do formulário restaurado gera NOVOS IDs", () => {
  it("`enterReview` → `confirmReview` envia NOVOS ids (≠ campanha/operação estornadas)", async () => {
    sessionStorage.setItem(`campaign_draft_image:${SOURCE_CAMPAIGN_ID}`, VALID_DATA_URL);

    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"type":"phase","phase":"generating","status":"start"}\n', {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() =>
      useCampaignForm(STORE_ID, {
        eligible: true,
        restoredForm: restoreFor(SOURCE_CAMPAIGN_ID, "original"),
      }),
    );

    await waitFor(() =>
      expect(result.current.fields.productName).toBe("Tênis Runner Pro"),
    );

    await act(async () => {
      const ok = await result.current.enterReview();
      expect(ok).toBe(true);
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
    };

    expect(body.campaignId).toMatch(UUID_V4);
    expect(body.operationId).toMatch(UUID_V4);
    // NUNCA reusa a identidade da campanha/operação estornada.
    expect(body.campaignId).not.toBe(SOURCE_CAMPAIGN_ID);
    expect(body.operationId).not.toBe(SOURCE_OPERATION_ID);
    // P1 (iv) — a direção RESTAURADA da evidência congelada está no CORPO.
    expect((body as { backgroundDirection?: string }).backgroundDirection).toBe("original");
    // O snapshot transportado NÃO carrega `operationId` (nunca reabre a operação).
    expect(restoreFor(SOURCE_CAMPAIGN_ID, "original")).not.toHaveProperty("operationId");
  });
});

// ---------------------------------------------------------------------------
// P1 (correção 2026-10-15) — DIREÇÃO DE FUNDO da EVIDÊNCIA CONGELADA:
// (i) builders REAIS + evidência congelada ⇒ Original/Ambientado/Estúdio na
// cadeia COMPLETA; (ii) fonte ausente ⇒ aviso + escolha OBRIGATÓRIA (sem geração);
// (iii) ownership divergente ⇒ nada recuperado; (iv)/(v) novos IDs + campos.
// ---------------------------------------------------------------------------
describe("P1 — direção de fundo da evidência congelada (i)(ii)(iii)", () => {
  it("(i) builders REAIS + evidência congelada ⇒ Original/Ambientado/Estúdio restaurados na cadeia REAL", async () => {
    for (const direction of ["original", "ambient", "studio"] as const) {
      mockGetCampaignForDisplay.mockResolvedValue(
        campaignRecord({ input_snapshot: realSnapshot() }),
      );
      mockGetCampaignOperation.mockResolvedValue({
        campaignId: SOURCE_CAMPAIGN_ID,
        operationId: SOURCE_OPERATION_ID,
        status: "refunded",
      });
      // EVIDÊNCIA CONGELADA (fonte da direção) — lida SERVER-SIDE.
      mockEvidence.row = {
        campaign_id: SOURCE_CAMPAIGN_ID,
        operation_id: SOURCE_OPERATION_ID,
        background_direction: direction,
      };

      const props = await renderNova(SOURCE_CAMPAIGN_ID);

      // A direção foi resolvida a partir da evidência (não de `input_snapshot`).
      expect(props.restoredForm?.backgroundDirection).toBe(direction);
      expect(props.restoredForm?.backgroundDirectionUnresolved).toBeFalsy();

      // A CADEIA COMPLETA (page → CampaignPageClient → CampaignInputForm →
      // useCampaignForm) reflete a direção escolhida no seletor.
      const { unmount } = renderChain(props.restoredForm);
      const label =
        direction === "original" ? "Original" : direction === "ambient" ? "Ambientado" : "Estúdio";
      expect(screen.getByRole("radio", { name: label })).toBeChecked();
      expect(screen.getByLabelText(/Nome do Produto/)).toHaveValue("Tênis Runner Pro");
      expect(screen.queryByText(BACKGROUND_DIRECTION_UNRESOLVED_NOTICE)).toBeNull();
      unmount();
    }
  });

  it("(ii) evidência AUSENTE ⇒ aviso + escolha OBRIGATÓRIA (submissão bloqueada), SEM geração", async () => {
    mockGetCampaignForDisplay.mockResolvedValue(
      campaignRecord({ input_snapshot: realSnapshot() }),
    );
    mockEvidence.row = null; // fonte ausente ⇒ fail-closed

    const props = await renderNova(SOURCE_CAMPAIGN_ID);
    expect(props.restoredForm?.backgroundDirectionUnresolved).toBe(true);
    expect(props.restoredForm?.backgroundDirection).toBeUndefined();

    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    // UI: aviso honesto + avanço BLOQUEADO (não há `studio` silencioso).
    renderChain(props.restoredForm);
    expect(screen.getByText(BACKGROUND_DIRECTION_UNRESOLVED_NOTICE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revisar e gerar/ })).toBeDisabled();

    // Hook REAL: `enterReview` retorna `false` e marca o erro de escolha.
    const { result } = renderHook(() =>
      useCampaignForm(STORE_ID, { eligible: true, restoredForm: props.restoredForm }),
    );
    await waitFor(() => expect(result.current.backgroundDirectionRequired).toBe(true));
    await act(async () => {
      const ok = await result.current.enterReview();
      expect(ok).toBe(false);
    });
    expect(result.current.fieldErrors.backgroundDirection).toBe(
      BACKGROUND_DIRECTION_REQUIRED_ERROR,
    );
    // NENHUMA geração foi disparada.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("(iii) ownership divergente ⇒ nenhum dado recuperado (direção nem consultada)", async () => {
    mockGetCampaignForDisplay.mockResolvedValue(
      campaignRecord({ store_id: "99999999-9999-4999-8999-999999999999" }),
    );
    mockEvidence.row = {
      campaign_id: SOURCE_CAMPAIGN_ID,
      operation_id: SOURCE_OPERATION_ID,
      background_direction: "original",
    };

    const props = await renderNova(SOURCE_CAMPAIGN_ID);

    expect(props.restoredForm).toBeNull();
    // Sem ownership, a operação/evidência NÃO é consultada.
    expect(mockGetCampaignOperation).not.toHaveBeenCalled();
  });
});
