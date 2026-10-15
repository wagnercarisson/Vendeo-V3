// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => "/campanhas/[id]",
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {},
  createServerClient: vi.fn(),
}));

vi.mock("@/components/campaign/campaign-approval-view", () => ({
  default: () => <div>CampaignApprovalView</div>,
}));

import CampaignPageClient from "../client";
import {
  mapNewFlowCopy,
  mapNewFlowDisplayState,
  mapNewFlowCopyRecovery,
} from "@/lib/campaign/display";
import type {
  CampaignPageProps,
  NewFlowCopyRecoveryRecord,
  NewFlowCopyRecoveryView,
} from "@/lib/campaign/display";
import {
  registerCopyRecoveryDrivingHandle,
  clearCopyRecoveryDrivingHandle,
} from "@/lib/campaign/copy-recovery-driving";
import { CopyRecoveryRequestSchema } from "@/lib/product-1-1/copy/recovery-schemas";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 06: visão PERSISTIDA conectada à operação do novo fluxo.
// O estado exibido deriva da operação persistida (C1), NUNCA de `campaign.status`
// nem de dedução por tempo; `delivered`/`refunded` (terminal) PREVALECEM sobre o
// marcador histórico `unknown` (I2); a UI reflete o estado sem retomar
// processamento e nunca cai em `StaleView`/`ErrorView` legados nem expõe
// `Gerar novamente`/`Tente novamente`.
// ---------------------------------------------------------------------------

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

const BASE_PROPS: CampaignPageProps = {
  imageUrl: "https://img.example/art.jpg",
  caption: "Legenda",
  hashtags: ["#promo"],
  ctaPost: "Compre agora",
  displayStatus: "ready",
  productName: "Produto Teste",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  downloadUrl: `/api/campaign/${CAMPAIGN_ID}/download`,
  campaignId: CAMPAIGN_ID,
  isPublicationCopyEdited: false,
};

const FORBIDDEN = ["Gerar novamente", "Tente novamente"];
const CONTINUITY = ["continuaremos", "retomaremos", "pode fechar a página"];
const REFUND_COPY = "crédito foi devolvido";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mapNewFlowDisplayState — deriva do estado PERSISTIDO (C1/I2/E1)", () => {
  it("operação ausente (`null`) ⇒ `null` (campanha legada)", () => {
    expect(mapNewFlowDisplayState(null)).toBeNull();
  });

  it("`delivered`/`refunded` derivam diretamente", () => {
    expect(
      mapNewFlowDisplayState({ status: "delivered", unknown: false }),
    ).toBe("delivered");
    expect(
      mapNewFlowDisplayState({ status: "refunded", unknown: false }),
    ).toBe("refunded");
  });

  it("I2 — o estado TERMINAL prevalece sobre o marcador histórico `unknown`", () => {
    expect(mapNewFlowDisplayState({ status: "delivered", unknown: true })).toBe(
      "delivered",
    );
    expect(mapNewFlowDisplayState({ status: "refunded", unknown: true })).toBe(
      "refunded",
    );
  });

  it("`reserved`/`art_uploaded` SEM `unknown` persistido ⇒ `running`", () => {
    expect(mapNewFlowDisplayState({ status: "reserved", unknown: false })).toBe(
      "running",
    );
    expect(
      mapNewFlowDisplayState({ status: "art_uploaded", unknown: false }),
    ).toBe("running");
  });

  it("C1 — `reserved`/`art_uploaded` COM `unknown` PERSISTIDO ⇒ `unknown` (nunca por tempo/teto)", () => {
    expect(mapNewFlowDisplayState({ status: "reserved", unknown: true })).toBe(
      "unknown",
    );
    expect(
      mapNewFlowDisplayState({ status: "art_uploaded", unknown: true }),
    ).toBe("unknown");
  });

  it("P2 — `reserved`/`art_uploaded` COM `outcome='failed'` PERSISTIDO ⇒ `unknown` (pendência, nunca geração ativa)", () => {
    expect(
      mapNewFlowDisplayState({ status: "reserved", unknown: false, outcome: "failed" }),
    ).toBe("unknown");
    expect(
      mapNewFlowDisplayState({ status: "art_uploaded", unknown: false, outcome: "failed" }),
    ).toBe("unknown");
  });

  it("P2 — terminal PREVALECE mesmo com `outcome='failed'` persistido", () => {
    expect(
      mapNewFlowDisplayState({ status: "delivered", unknown: false, outcome: "failed" }),
    ).toBe("delivered");
    expect(
      mapNewFlowDisplayState({ status: "refunded", unknown: false, outcome: "failed" }),
    ).toBe("refunded");
  });
});

describe("CampaignPageClient — visão persistida do novo fluxo", () => {
  it("`delivered` ⇒ arte + download; SEM `Gerar novamente`", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{ state: "delivered", operationId: OPERATION_ID }}
      />,
    );

    expect(screen.getByText("Baixar Original")).toBeInTheDocument();
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
    for (const forbidden of FORBIDDEN) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("`refunded` ⇒ RefundedPanel com a mensagem EXATA + CTA de nova geração (restauração disponível)", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        imageUrl={null}
        newFlow={{
          state: "refunded",
          operationId: OPERATION_ID,
          restoredForm: {
            campaignId: CAMPAIGN_ID,
            productName: "Produto Teste",
            description: "",
            originalPriceCents: 0,
            badge: "",
            campaignIntent: "offer",
            preserveImageContext: false,
            mandatoryArtworkTextFree: "",
            referenceSelections: [],
            imageRestoreLimited: true,
          },
        }}
      />,
    );

    expect(
      screen.getByText(
        "Não conseguimos concluir a comunicação desta geração. Seus dados foram preservados e o crédito foi estornado. Você pode gerar novamente.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Gerar novamente com meus dados/ }),
    ).toBeInTheDocument();
    for (const forbidden of FORBIDDEN) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("`refunded` SEM restauração disponível ⇒ informa o estorno SEPARADAMENTE, sem prometer dados preservados", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        imageUrl={null}
        newFlow={{ state: "refunded", operationId: OPERATION_ID }}
      />,
    );

    expect(
      screen.getByText("O crédito desta geração foi estornado."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Seus dados foram preservados/),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Gerar novamente com meus dados/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Verificar novamente" }),
    ).toBeInTheDocument();
  });

  it("`running` ⇒ processamento neutro, SEM promessa de continuidade nem devolução", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{ state: "running", operationId: OPERATION_ID }}
      />,
    );

    expect(screen.getByText("Sua campanha está sendo gerada...")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(REFUND_COPY))).toBeNull();
    for (const forbidden of [...FORBIDDEN, ...CONTINUITY]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("`unknown` ⇒ UnknownResultPanel (âmbar) SEM devolução e SEM `Gerar novamente`", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{
          state: "unknown",
          operationId: OPERATION_ID,
          supportReference: "IMG-001-abc",
        }}
      />,
    );

    expect(
      screen.getByText("Não foi possível confirmar a conclusão desta geração"),
    ).toBeInTheDocument();
    expect(screen.getByText(/IMG-001-abc/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(REFUND_COPY))).toBeNull();
    for (const forbidden of [...FORBIDDEN, ...CONTINUITY]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("I2 — resolução administrativa: operação terminal com `unknown` histórico mostra o estado TERMINAL", () => {
    // A pré-filtragem (server) já resolveu a operação para `delivered` mesmo com
    // a linha histórica `outcome='unknown'` — a UI exibe `delivered`, nunca unknown.
    expect(mapNewFlowDisplayState({ status: "delivered", unknown: true })).toBe(
      "delivered",
    );
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{ state: "delivered", operationId: OPERATION_ID }}
      />,
    );
    expect(screen.queryByText(/Não foi possível confirmar/)).toBeNull();
    expect(screen.getByText("Baixar Original")).toBeInTheDocument();
  });

  it("campanha SEM operação (legado) ⇒ caminho anterior preservado", () => {
    render(<CampaignPageClient {...BASE_PROPS} />);

    // Legacy `ready` permanece no ReadyView (sem `newFlow`).
    expect(screen.getByText("Baixar Original")).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível confirmar/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F56.2b1b (Plano 08 — correção P3): a copy do NOVO FLUXO é exibida POR OPERAÇÃO.
// `delivered` mostra os textos completos; `failed`/`canceled` mostram feedback
// SEGURO (âmbar) — nunca sucesso falso, nunca bloqueia a arte, sem retry.
// ---------------------------------------------------------------------------

describe("mapNewFlowCopy — copy do novo fluxo (P3)", () => {
  it("`completed` ⇒ textos completos (título/legenda/hashtags/CTA)", () => {
    expect(
      mapNewFlowCopy(
        {
          state: "completed",
          copyText: "Legenda",
          copyPayload: {
            title: "Oferta",
            caption: "Legenda",
            hashtags: ["#promo"],
            cta_post: "Aproveite!",
          },
        },
        false,
      ),
    ).toEqual({
      state: "delivered",
      title: "Oferta",
      caption: "Legenda",
      hashtags: ["#promo"],
      ctaPost: "Aproveite!",
    });
  });

  it("`failed` sem cancelamento ⇒ `failed`; com cancelamento ⇒ `canceled`", () => {
    const record = { state: "failed" as const, copyText: null, copyPayload: null };
    expect(mapNewFlowCopy(record, false)).toMatchObject({ state: "failed" });
    expect(mapNewFlowCopy(record, true)).toMatchObject({ state: "canceled" });
  });

  it("sem registro ⇒ `null` (sem superfície de copy)", () => {
    expect(mapNewFlowCopy(null, false)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F56.2b2a (Plano 04 — correção pós-revisão + correção da regra `aguardando`):
// precedência do SUMÁRIO da recuperação. O ciclo AUTOMÁTICO só está ABERTO antes
// de QUALQUER início MANUAL (`manualAttempts === 0`): com o CTA MANUAL liberado
// apenas quando a espera venceu (`waitRemainingMs === 0`); após um início MANUAL
// não se agenda nova automática e o estado cai em `interrompida`.
// ---------------------------------------------------------------------------
describe("mapNewFlowCopyRecovery — precedência da recuperação (correções pós-revisão)", () => {
  const deliveredCopy = {
    state: "completed" as const,
    copyText: "Legenda",
    copyPayload: { caption: "Legenda", hashtags: ["#promo"], cta_post: "Aproveite!" },
  };
  const failedCopy = { state: "failed" as const, copyText: null, copyPayload: null };

  function record(
    overrides: Partial<NewFlowCopyRecoveryRecord> = {},
  ): NewFlowCopyRecoveryRecord {
    return {
      state: "failed",
      attemptSeq: 1,
      attemptActive: false,
      waitRemainingMs: 0,
      autoAttempts: 1,
      manualAttempts: 0,
      definitive: false,
      ...overrides,
    };
  }

  it("(FIX 3) entrega `completed` + sumário INDISPONÍVEL ⇒ `concluida` (textos prevalecem)", () => {
    expect(mapNewFlowCopyRecovery(null, deliveredCopy)).toEqual({
      state: "concluida",
      autoAttempts: 0,
      manualAttempts: 0,
      waitRemainingMs: 0,
      canRetry: false,
    });
  });

  it("(FIX 3) sumário INDISPONÍVEL + entrega NÃO entregue ⇒ `indeterminada` (canRetry false)", () => {
    expect(mapNewFlowCopyRecovery(null, failedCopy)).toMatchObject({
      state: "indeterminada",
      canRetry: false,
    });
    expect(mapNewFlowCopyRecovery(null, null)).toMatchObject({
      state: "indeterminada",
      canRetry: false,
    });
  });

  it("(correção aguardando) `failed` transitório + espera VENCIDA (wait 0) + automáticas restantes + SEM manual ⇒ `aguardando` com CTA MANUAL LIBERADO (reload/outra aba)", () => {
    expect(
      mapNewFlowCopyRecovery(record({ waitRemainingMs: 0, autoAttempts: 1 }), failedCopy),
    ).toMatchObject({ state: "aguardando", waitRemainingMs: 0, canRetry: true });
  });

  it("(correção aguardando) enquanto a espera CORRE (wait > 0) ⇒ `aguardando` com `canRetry === false` (CTA disabled, anti-duplicação)", () => {
    expect(
      mapNewFlowCopyRecovery(record({ waitRemainingMs: 5000, autoAttempts: 1 }), failedCopy),
    ).toMatchObject({ state: "aguardando", waitRemainingMs: 5000, canRetry: false });
  });

  it("(correção aguardando) MANUAL já iniciado (`manualAttempts > 0`) ⇒ NÃO é `aguardando`; cai em `interrompida` com manual restante", () => {
    const view = mapNewFlowCopyRecovery(
      record({
        state: "failed",
        definitive: false,
        waitRemainingMs: 0,
        autoAttempts: 1,
        manualAttempts: 1,
      }),
      failedCopy,
    );
    expect(view).toMatchObject({ state: "interrompida", canRetry: true });
    expect(view?.state).not.toBe("aguardando");
  });

  it("(FIX 1) `pending` SEM lease ⇒ `interrompida` (sem espera transitória)", () => {
    expect(
      mapNewFlowCopyRecovery(
        record({ state: "pending", attemptSeq: 1, waitRemainingMs: 0 }),
        failedCopy,
      ),
    ).toMatchObject({ state: "interrompida", canRetry: true });
  });

  it("precedência preservada: `completed` no registro ⇒ `concluida`; sem tentativa ⇒ `null`", () => {
    expect(
      mapNewFlowCopyRecovery(record({ state: "completed" }), failedCopy),
    ).toMatchObject({ state: "concluida", canRetry: false });
    expect(
      mapNewFlowCopyRecovery(record({ attemptSeq: 0, state: null }), failedCopy),
    ).toBeNull();
  });
});

describe("CampaignPageClient — copy do novo fluxo na campanha entregue (P3)", () => {
  it("`delivered` com copy entregue ⇒ mostra os textos completos SEM `Gerar novamente`", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        caption=""
        hashtags={[]}
        ctaPost=""
        newFlow={{
          state: "delivered",
          operationId: OPERATION_ID,
          copy: {
            state: "delivered",
            title: "Oferta Especial",
            caption: "Legenda nova da campanha",
            hashtags: ["#promo"],
            ctaPost: "Aproveite!",
          },
        }}
      />,
    );

    expect(screen.getByText("Oferta Especial")).toBeInTheDocument();
    expect(screen.getByText("Legenda nova da campanha")).toBeInTheDocument();
    expect(screen.getByText("#promo")).toBeInTheDocument();
    expect(screen.getByText("Aproveite!")).toBeInTheDocument();
    // A arte continua exibida e o download permanece.
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
    expect(screen.getByText("Baixar Original")).toBeInTheDocument();
    for (const forbidden of FORBIDDEN) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("`delivered` com copy FALHOU ⇒ feedback seguro (âmbar), arte visível, sem retry", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{
          state: "delivered",
          operationId: OPERATION_ID,
          copy: { state: "failed", caption: "", hashtags: [], ctaPost: "" },
        }}
      />,
    );

    expect(
      screen.getByText("Não foi possível gerar o texto desta campanha. A arte está pronta para uso."),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
    for (const forbidden of FORBIDDEN) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("`delivered` com copy CANCELADA ⇒ feedback seguro (âmbar) e arte visível", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{
          state: "delivered",
          operationId: OPERATION_ID,
          copy: { state: "canceled", caption: "", hashtags: [], ctaPost: "" },
        }}
      />,
    );

    expect(
      screen.getByText(
        "A geração do texto demorou mais que o esperado e foi interrompida. A arte está pronta para uso.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
    for (const forbidden of FORBIDDEN) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("`delivered` sem informação de copy ⇒ sem painel de copy e arte visível (sem sucesso falso)", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{ state: "delivered", operationId: OPERATION_ID }}
      />,
    );

    expect(screen.queryByText("Kit de Publicação")).toBeNull();
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
    expect(screen.getByText("Baixar Original")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F56.2b1b (Plano 08 — P3): integração PAGE → CLIENT. O que a página mapeia do
// registro PERSISTIDO (`mapNewFlowCopy`) é exatamente o que o client renderiza —
// prova fim-a-fim da superfície (textos completos; falha/cancelamento ⇒ feedback
// SEGURO âmbar; arte SEMPRE visível; SEM retry).
// ---------------------------------------------------------------------------

describe("P3 — PAGE → CLIENT: cópia persistida mapeada e exibida", () => {
  it("`completed` ⇒ textos completos, arte visível e SEM retry", () => {
    const copy = mapNewFlowCopy(
      {
        state: "completed",
        copyText: "Legenda",
        copyPayload: {
          title: "Oferta",
          caption: "Legenda",
          hashtags: ["#promo"],
          cta_post: "Aproveite!",
        },
      },
      false,
    );

    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{ state: "delivered", operationId: OPERATION_ID, copy }}
      />,
    );

    expect(screen.getByText("Kit de Publicação")).toBeInTheDocument();
    expect(screen.getByText("Oferta")).toBeInTheDocument();
    expect(screen.getByText("Legenda")).toBeInTheDocument();
    expect(screen.getByText("#promo")).toBeInTheDocument();
    expect(screen.getByText("Aproveite!")).toBeInTheDocument();
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
    for (const forbidden of FORBIDDEN) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("`failed` ⇒ feedback SEGURO (âmbar), arte visível e SEM retry", () => {
    const copy = mapNewFlowCopy({ state: "failed", copyText: null, copyPayload: null }, false);

    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{ state: "delivered", operationId: OPERATION_ID, copy }}
      />,
    );

    expect(
      screen.getByText(
        "Não foi possível gerar o texto desta campanha. A arte está pronta para uso.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
    for (const forbidden of FORBIDDEN) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("`canceled` (falha + cancelamento) ⇒ feedback SEGURO (âmbar), arte visível e SEM retry", () => {
    const copy = mapNewFlowCopy({ state: "failed", copyText: null, copyPayload: null }, true);

    render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{ state: "delivered", operationId: OPERATION_ID, copy }}
      />,
    );

    expect(
      screen.getByText(
        "A geração do texto demorou mais que o esperado e foi interrompida. A arte está pronta para uso.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
    for (const forbidden of FORBIDDEN) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// F56.2b2a (B2.1 / Plano 04 — UI-SPEC §Surface): a superfície de RECUPERAÇÃO de
// copy na campanha entregue. Os 7 estados, a CTA secundária condicional, os
// contadores, a espera REPORTADA pelo servidor e a agenda da 2ª automática
// SOMENTE na aba INICIADORA (handle de condução). Provider simulado; sem chamada
// paga; a arte `delivered` permanece visível/baixável durante a recuperação.
// ---------------------------------------------------------------------------

const SCOPE_NOTICE =
  "Isso gera apenas os textos. A imagem da campanha não muda e nenhum crédito adicional é usado.";
const LIMIT_MESSAGE =
  "Infelizmente, não foi possível gerar os textos. Por favor, entre em contato com o suporte.";
const RECOVERY_FAILURE_MESSAGE =
  "Não conseguimos gerar os textos automaticamente. Você pode tentar novamente ou entrar em contato com o suporte.";
const CTA = "Gerar os textos novamente";

function recoveryView(
  overrides: Partial<NewFlowCopyRecoveryView> = {},
): NewFlowCopyRecoveryView {
  return {
    state: "falha",
    autoAttempts: 3,
    manualAttempts: 0,
    waitRemainingMs: 0,
    canRetry: true,
    ...overrides,
  };
}

function fetchMock() {
  // Mock sem a tipagem de `Response` (o teste injeta objetos parciais via
  // `vi.stubGlobal`); evita casts repetidos no corpo dos casos.
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

function copyRecoveryCalls() {
  return fetchMock().mock.calls.filter(([url]) =>
    String(url).includes(`/api/campaign/${CAMPAIGN_ID}/copy-recovery`),
  );
}

describe("CampaignPageClient — superfície de recuperação de copy (B2.1 / Plano 04)", () => {
  beforeEach(() => {
    clearCopyRecoveryDrivingHandle();
    const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", mock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearCopyRecoveryDrivingHandle();
  });

  function recoveryElement(
    view: NewFlowCopyRecoveryView | null,
    extra: Partial<NonNullable<CampaignPageProps["newFlow"]>> = {},
  ) {
    return (
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{
          state: "delivered",
          operationId: OPERATION_ID,
          recovery: view,
          ...extra,
        }}
      />
    );
  }

  function renderRecovery(
    view: NewFlowCopyRecoveryView | null,
    extra: Partial<NonNullable<CampaignPageProps["newFlow"]>> = {},
  ) {
    return render(recoveryElement(view, extra));
  }

  it("`concluída` ⇒ remove TODA ação de recuperação e exibe o texto entregue", () => {
    renderRecovery(recoveryView({ state: "concluida", canRetry: false }), {
      copy: {
        state: "delivered",
        title: "Oferta",
        caption: "Legenda nova da campanha",
        hashtags: [],
        ctaPost: "",
      },
    });

    expect(screen.queryByText(CTA)).toBeNull();
    expect(screen.queryByText("Copy da campanha")).toBeNull();
    expect(screen.getByText("Legenda nova da campanha")).toBeInTheDocument();
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
    expect(screen.getByText("Baixar Original")).toBeInTheDocument();
  });

  it("SEM tentativa (`recovery` null) ⇒ SEM painel e SEM CTA", () => {
    renderRecovery(null);

    expect(screen.queryByText("Copy da campanha")).toBeNull();
    expect(screen.queryByText(CTA)).toBeNull();
    expect(screen.queryByText(SCOPE_NOTICE)).toBeNull();
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
  });

  it("`ativa` ⇒ spinner + CTA `disabled` + `aria-disabled`, arte visível", () => {
    renderRecovery(recoveryView({ state: "ativa", canRetry: false, autoAttempts: 1 }));

    expect(screen.getAllByText("Gerando os textos...").length).toBeGreaterThan(0);
    expect(document.querySelector(".animate-spin")).toBeTruthy();
    const button = screen.getByRole("button", { name: CTA });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
    expect(screen.getByText("Baixar Original")).toBeInTheDocument();
  });

  it("`aguardando` NA ABA DIRIGENTE ⇒ contagem reportada + disabled + emite a 2ª automática com token NOVO ao fim", async () => {
    registerCopyRecoveryDrivingHandle({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    vi.useFakeTimers();
    renderRecovery(
      recoveryView({ state: "aguardando", autoAttempts: 1, waitRemainingMs: 5000, canRetry: false }),
    );

    // A contagem REPORTADA pelo servidor é exibida (5s) e o botão está disabled.
    expect(screen.getByText(/Nova tentativa em 5s/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CTA })).toBeDisabled();
    expect(copyRecoveryCalls()).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    const calls = copyRecoveryCalls();
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String((calls[0][1] as RequestInit).body));
    expect(body.mode).toBe("auto_retry");
    expect(body.operationId).toBe(OPERATION_ID);
    expect(typeof body.requestToken).toBe("string");
    expect(body.requestToken.length).toBeGreaterThan(0);
  });

  it("`aguardando` NA ABA NÃO-DIRIGENTE (sem handle) ⇒ apenas ACOMPANHA (não emite)", async () => {
    // SEM `registerCopyRecoveryDrivingHandle` ⇒ `isDriving === false` (reload/outra aba).
    vi.useFakeTimers();
    renderRecovery(
      recoveryView({ state: "aguardando", autoAttempts: 1, waitRemainingMs: 5000, canRetry: false }),
    );

    expect(screen.getByText(/Nova tentativa em 5s/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CTA })).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(copyRecoveryCalls()).toHaveLength(0);
  });

  it("(correção aguardando) reload/outra aba com espera VENCIDA e SEM tentativa ativa ⇒ CTA MANUAL HABILITADO e ZERO automáticas", async () => {
    // Sem `registerCopyRecoveryDrivingHandle` ⇒ `isDriving === false` (reload/outra aba).
    vi.useFakeTimers();
    renderRecovery(
      recoveryView({
        state: "aguardando",
        autoAttempts: 1,
        manualAttempts: 0,
        waitRemainingMs: 0,
        canRetry: true,
      }),
    );

    // A espera já venceu: o CTA MANUAL fica LIBERADO (ninguém agenda a próxima
    // automática fora da aba dirigente).
    expect(screen.getByRole("button", { name: CTA })).toBeEnabled();

    expect(screen.getByText(RECOVERY_FAILURE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("Nova tentativa em andamento")).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByText(/Nova tentativa em 0s/)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    // Aba não-dirigente NUNCA emite automática.
    expect(copyRecoveryCalls()).toHaveLength(0);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("espera de outra aba só faz poll até o servidor confirmar o vencimento; depois oferece manual sem timer", async () => {
    vi.useFakeTimers();
    const { rerender } = render(recoveryElement(
      recoveryView({ state: "aguardando", autoAttempts: 1, waitRemainingMs: 5000, canRetry: false }),
    ));
    expect(screen.getByRole("button", { name: CTA })).toBeDisabled();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    rerender(recoveryElement(
      recoveryView({ state: "aguardando", autoAttempts: 1, waitRemainingMs: 0, canRetry: true }),
    ));
    expect(screen.getByText(RECOVERY_FAILURE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CTA })).toBeEnabled();
    expect(screen.queryByRole("timer")).toBeNull();
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(copyRecoveryCalls()).toHaveLength(0);
  });

  it("operação delivered com espera vencida não faz poll mesmo com status legado generating", async () => {
    vi.useFakeTimers();
    render(<CampaignPageClient {...BASE_PROPS} displayStatus="generating" newFlow={{
      state: "delivered", operationId: OPERATION_ID,
      recovery: recoveryView({ state: "aguardando", waitRemainingMs: 0, canRetry: true }),
    }} />);
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(copyRecoveryCalls()).toHaveLength(0);
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("(correção aguardando) `aguardando` na aba DIRIGENTE com manual já iniciado ⇒ guarda extra NÃO emite automática (ciclo fechado)", async () => {
    registerCopyRecoveryDrivingHandle({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    vi.useFakeTimers();
    renderRecovery(
      recoveryView({
        state: "aguardando",
        autoAttempts: 1,
        manualAttempts: 1,
        waitRemainingMs: 0,
        canRetry: true,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    // belt-and-braces: após um início MANUAL nenhuma automática é agendada.
    expect(copyRecoveryCalls()).toHaveLength(0);
  });

  it("(correção aguardando) 1ª MANUAL falhou após interrupção (manualAttempts > 0, wait vencida) ⇒ `interrompida` com CTA habilitado; nenhuma automática", async () => {
    vi.useFakeTimers();
    renderRecovery(
      recoveryView({
        state: "interrompida",
        autoAttempts: 1,
        manualAttempts: 1,
        waitRemainingMs: 0,
        canRetry: true,
      }),
    );

    expect(
      screen.getByText(RECOVERY_FAILURE_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CTA })).toBeEnabled();

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    expect(copyRecoveryCalls()).toHaveLength(0);
  });

  it("`indeterminada` ⇒ sem spinner, CTA `disabled`, `Verificar novamente` (query-only) sem nova chamada", () => {
    renderRecovery(recoveryView({ state: "indeterminada", canRetry: false }));

    expect(
      screen.getByText("Não foi possível verificar agora. Tente novamente em instantes."),
    ).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeNull();
    const button = screen.getByRole("button", { name: CTA });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" }));

    // Re-verificação é query-only: nenhuma chamada ao endpoint de recuperação.
    expect(copyRecoveryCalls()).toHaveLength(0);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("`falha`/`falha definitiva`/`interrompida` ⇒ CTA condicional; `interrompida` SEM spinner", () => {
    const { unmount: u1 } = renderRecovery(
      recoveryView({ state: "falha", autoAttempts: 3, manualAttempts: 0, canRetry: true }),
    );
    expect(screen.getAllByText(RECOVERY_FAILURE_MESSAGE)).toHaveLength(1);
    expect(screen.getByRole("button", { name: CTA })).toBeEnabled();
    u1();

    const { unmount: u2 } = renderRecovery(
      recoveryView({
        state: "falha_definitiva",
        canRetry: true,
        manualAttempts: 0,
      }),
      { supportEmail: "suporte@vendeo.test" },
    );
    expect(screen.getAllByText(RECOVERY_FAILURE_MESSAGE)).toHaveLength(1);
    expect(screen.queryByText("Não dá para tentar automaticamente")).toBeNull();
    expect(screen.getByRole("button", { name: CTA })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Falar com o suporte" })).toBeInTheDocument();
    u2();

    renderRecovery(recoveryView({ state: "interrompida", canRetry: true, manualAttempts: 0 }));
    expect(screen.getAllByText(RECOVERY_FAILURE_MESSAGE)).toHaveLength(1);
    expect(screen.getByRole("button", { name: CTA })).toBeEnabled();
    // `interrompida` NUNCA usa spinner.
    expect(document.querySelector(".animate-spin")).toBeNull();
  });

  it("contadores ficam internos e o aviso de escopo permanece", () => {
    renderRecovery(recoveryView({ state: "falha", autoAttempts: 3, manualAttempts: 1, canRetry: true }));

    expect(screen.queryByText(/Tentativas automáticas:/)).toBeNull();
    expect(screen.queryByText(/Tentativas manuais:/)).toBeNull();
    const scope = screen.getByText(SCOPE_NOTICE);
    expect(scope).toBeInTheDocument();
    expect(scope.className).toContain("font-body");
  });

  it("limite manual atingido ⇒ sem nova tentativa, só mensagem final e suporte", () => {
    renderRecovery(
      recoveryView({ state: "falha", manualAttempts: 3, canRetry: false }),
      { supportEmail: "suporte@vendeo.test" },
    );

    expect(screen.queryByRole("button", { name: CTA })).toBeNull();
    expect(screen.getAllByText(LIMIT_MESSAGE)).toHaveLength(1);
    expect(screen.queryByText(RECOVERY_FAILURE_MESSAGE)).toBeNull();
    expect(screen.queryByText(/Tentativas manuais:/)).toBeNull();
    expect(screen.getByRole("button", { name: "Falar com o suporte" })).toBeInTheDocument();
  });

  it("terceira manual ainda ativa não exibe falha final antes de terminar", () => {
    renderRecovery(recoveryView({ state: "ativa", manualAttempts: 3, canRetry: false }));
    expect(screen.queryByText(LIMIT_MESSAGE)).toBeNull();
    expect(screen.queryByRole("button", { name: CTA })).toBeNull();
    expect(document.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByText(/Tentativas manuais:/)).toBeNull();
    expect(screen.getByAltText("Produto Teste")).toBeInTheDocument();
  });

  it("clique manual ⇒ UMA requisição `manual`; dois cliques ⇒ tokens DISTINTOS (por acionamento)", async () => {
    renderRecovery(recoveryView({ state: "interrompida", canRetry: true, manualAttempts: 0 }));

    const button = screen.getByRole("button", { name: CTA });
    fireEvent.click(button);
    await waitFor(() => expect(copyRecoveryCalls()).toHaveLength(1));
    fireEvent.click(button);
    await waitFor(() => expect(copyRecoveryCalls()).toHaveLength(2));

    const bodies = copyRecoveryCalls().map(([, init]) =>
      JSON.parse(String((init as RequestInit).body)),
    );
    expect(bodies[0].mode).toBe("manual");
    expect(bodies[1].mode).toBe("manual");
    expect(bodies[0].operationId).toBe(OPERATION_ID);
    expect(bodies[0].requestToken).not.toBe(bodies[1].requestToken);
  });

  it("erro de rede na ação manual ⇒ feedback SEGURO (sem terminal falso)", async () => {
    fetchMock().mockResolvedValue({ ok: false, json: async () => ({}) });
    renderRecovery(recoveryView({ state: "interrompida", canRetry: true, manualAttempts: 0 }));

    fireEvent.click(screen.getByRole("button", { name: CTA }));

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível tentar novamente agora. Tente de novo em instantes."),
      ).toBeInTheDocument(),
    );
  });

  // -------------------------------------------------------------------------
  // F56.2b2a (correção pós-revisão) — emissão ancorada no AVANÇO PERSISTIDO.
  // -------------------------------------------------------------------------

  it("(FIX 1) 2ª falha RÁPIDA → 10s → 3ª automática: exatamente 2 POSTs com tokens DISTINTOS (T2≠T3)", async () => {
    registerCopyRecoveryDrivingHandle({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    vi.useFakeTimers();

    const { rerender } = render(
      recoveryElement(
        recoveryView({ state: "aguardando", autoAttempts: 1, waitRemainingMs: 5000, canRetry: false }),
      ),
    );

    // A superfície NUNCA sai de `aguardando` (falha rápida): sem spinner/`ativa`.
    expect(screen.getByText(/Nova tentativa em 5s/)).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(copyRecoveryCalls()).toHaveLength(1);

    // Servidor avançou para a 2ª espera (10s, auto=2) — o poll refletiria isso.
    rerender(
      recoveryElement(
        recoveryView({ state: "aguardando", autoAttempts: 2, waitRemainingMs: 10000, canRetry: false }),
      ),
    );
    expect(screen.getByText(/Nova tentativa em 10s/)).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(copyRecoveryCalls()).toHaveLength(2);

    // Servidor concluiu: acompanha o sucesso e NÃO emite mais nada.
    rerender(
      recoveryElement(
        recoveryView({ state: "concluida", autoAttempts: 2, canRetry: false }),
        { copy: { state: "delivered", caption: "Legenda nova", hashtags: [], ctaPost: "" } },
      ),
    );
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    const bodies = copyRecoveryCalls().map(([, init]) =>
      JSON.parse(String((init as RequestInit).body)),
    );
    expect(bodies).toHaveLength(2);
    expect(bodies[0].mode).toBe("auto_retry");
    expect(bodies[1].mode).toBe("auto_retry");
    expect(bodies[0].operationId).toBe(OPERATION_ID);
    // Critério 27: cada NOVA automática gera token PRÓPRIO (T2≠T3).
    expect(bodies[0].requestToken).not.toBe(bodies[1].requestToken);
    // Teto automático respeitado: só 2 automáticas emitidas pela UI.
    expect(copyRecoveryCalls()).toHaveLength(2);
  });

  it("(FIX 1) espera JÁ VENCIDA na chegada (aba dirigente) ⇒ UMA auto_retry imediata com token novo", async () => {
    registerCopyRecoveryDrivingHandle({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    renderRecovery(
      recoveryView({ state: "aguardando", autoAttempts: 1, waitRemainingMs: 0, canRetry: false }),
    );

    await waitFor(() => expect(copyRecoveryCalls()).toHaveLength(1));
    const body = JSON.parse(String((copyRecoveryCalls()[0][1] as RequestInit).body));
    expect(body.mode).toBe("auto_retry");
    expect(body.operationId).toBe(OPERATION_ID);
    expect(typeof body.requestToken).toBe("string");
    expect(body.requestToken.length).toBeGreaterThan(0);

    // UMA única emissão no MESMO episódio persistido (não duplica).
    await act(async () => {});
    expect(copyRecoveryCalls()).toHaveLength(1);
  });

  it("(FIX 2) outra aba (SEM handle) ACOMPANHA a recuperação ativa: poll reflete `concluida` e ZERO POSTs", async () => {
    // Sem `registerCopyRecoveryDrivingHandle` ⇒ `isDriving === false` (reload/outra aba).
    vi.useFakeTimers();
    const { rerender } = render(
      recoveryElement(
        recoveryView({ state: "ativa", autoAttempts: 1, canRetry: false }),
        { copy: { state: "pending", caption: "", hashtags: [], ctaPost: "" } },
      ),
    );

    // Imagem já `delivered` + recuperação `ativa` ⇒ o poll ACOMPANHA mesmo sem `running`.
    expect(document.querySelector(".animate-spin")).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Servidor concluiu: o poll reflete a atualização (textos exibidos).
    rerender(
      recoveryElement(
        recoveryView({ state: "concluida", autoAttempts: 1, canRetry: false }),
        { copy: { state: "delivered", caption: "Legenda nova da campanha", hashtags: [], ctaPost: "" } },
      ),
    );
    expect(screen.getByText("Legenda nova da campanha")).toBeInTheDocument();
    expect(screen.queryByText("Gerando os textos...")).toBeNull();

    // `concluida` encerra o acompanhamento e NENHUM POST é emitido pela aba.
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(copyRecoveryCalls()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// F56.2b2a (CR-01 + WR-01) — REGRESSÃO emissor REAL → schema REAL.
//
// O corpo CAPTURADO do `fetch` (o que o componente REALMENTE envia) deve
// satisfazer `CopyRecoveryRequestSchema.safeParse(...).success === true` para
// AMBOS os caminhos: clique MANUAL e automática (`auto_retry`) da aba dirigente.
// Não se re-testa um payload construído à mão com campos que a UI nunca envia.
//
// WR-01 — sem `crypto.randomUUID`, mas COM `getRandomValues`, o `requestToken`
// emitido deve ser um UUID v4 VÁLIDO. SEM nenhuma fonte criptográfica, NENHUM
// POST é enviado (o manual mostra o erro SEGURO; a automática não emite).
// ---------------------------------------------------------------------------
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function realBodyAt(index = 0): unknown {
  const call = copyRecoveryCalls()[index];
  return JSON.parse(String((call[1] as RequestInit).body));
}

describe("CR-01/WR-01 — corpo REAL do emissor satisfaz o schema REAL", () => {
  function renderRecovery(
    view: NewFlowCopyRecoveryView,
  ) {
    return render(
      <CampaignPageClient
        {...BASE_PROPS}
        newFlow={{ state: "delivered", operationId: OPERATION_ID, recovery: view }}
      />,
    );
  }

  beforeEach(() => {
    clearCopyRecoveryDrivingHandle();
    const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", mock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearCopyRecoveryDrivingHandle();
  });

  it("CR-01 — clique MANUAL: o corpo REAL enviado passa no `CopyRecoveryRequestSchema`", async () => {
    renderRecovery(recoveryView({ state: "interrompida", canRetry: true, manualAttempts: 0 }));

    fireEvent.click(screen.getByRole("button", { name: CTA }));
    await waitFor(() => expect(copyRecoveryCalls()).toHaveLength(1));

    const parsed = CopyRecoveryRequestSchema.safeParse(realBodyAt());
    expect(parsed.success).toBe(true);
    expect(CopyRecoveryRequestSchema.safeParse(realBodyAt()).data?.mode).toBe("manual");
  });

  it("CR-01 — automática da aba DIRIGENTE: o corpo REAL `auto_retry` passa no schema REAL", async () => {
    registerCopyRecoveryDrivingHandle({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    renderRecovery(
      recoveryView({ state: "aguardando", autoAttempts: 1, waitRemainingMs: 0, canRetry: false }),
    );

    await waitFor(() => expect(copyRecoveryCalls()).toHaveLength(1));

    const parsed = CopyRecoveryRequestSchema.safeParse(realBodyAt());
    expect(parsed.success).toBe(true);
    expect(CopyRecoveryRequestSchema.safeParse(realBodyAt()).data?.mode).toBe("auto_retry");
  });

  it("WR-01 — SEM `randomUUID` (com `getRandomValues`) o token emitido é um UUID v4 VÁLIDO (manual)", async () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });
    renderRecovery(recoveryView({ state: "interrompida", canRetry: true, manualAttempts: 0 }));

    fireEvent.click(screen.getByRole("button", { name: CTA }));
    await waitFor(() => expect(copyRecoveryCalls()).toHaveLength(1));

    const body = realBodyAt() as { requestToken: string };
    expect(body.requestToken).toMatch(UUID_V4);
    expect(CopyRecoveryRequestSchema.safeParse(body).success).toBe(true);
  });

  it("WR-01 — SEM `randomUUID` (com `getRandomValues`) o token automático é um UUID v4 VÁLIDO (auto_retry)", async () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });
    registerCopyRecoveryDrivingHandle({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    renderRecovery(
      recoveryView({ state: "aguardando", autoAttempts: 1, waitRemainingMs: 0, canRetry: false }),
    );

    await waitFor(() => expect(copyRecoveryCalls()).toHaveLength(1));

    const body = realBodyAt() as { requestToken: string };
    expect(body.requestToken).toMatch(UUID_V4);
    expect(CopyRecoveryRequestSchema.safeParse(body).success).toBe(true);
  });

  it("WR-01 — SEM fonte criptográfica (manual): NENHUM POST e erro SEGURO exibido", async () => {
    vi.stubGlobal("crypto", {});
    renderRecovery(recoveryView({ state: "interrompida", canRetry: true, manualAttempts: 0 }));

    fireEvent.click(screen.getByRole("button", { name: CTA }));

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível tentar novamente agora. Tente de novo em instantes."),
      ).toBeInTheDocument(),
    );
    expect(copyRecoveryCalls()).toHaveLength(0);
  });

  it("WR-01 — SEM fonte criptográfica (automática): NENHUMA emissão", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("crypto", {});
    registerCopyRecoveryDrivingHandle({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID });
    renderRecovery(
      recoveryView({ state: "aguardando", autoAttempts: 1, waitRemainingMs: 0, canRetry: false }),
    );

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });
    expect(copyRecoveryCalls()).toHaveLength(0);
  });
});
