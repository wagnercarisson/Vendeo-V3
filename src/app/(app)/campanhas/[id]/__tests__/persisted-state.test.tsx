// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

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
import { mapNewFlowDisplayState } from "@/lib/campaign/display";
import type { CampaignPageProps } from "@/lib/campaign/display";

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

  it("`refunded` ⇒ mostra 'A geração falhou e o crédito foi devolvido.'", () => {
    render(
      <CampaignPageClient
        {...BASE_PROPS}
        imageUrl={null}
        newFlow={{ state: "refunded", operationId: OPERATION_ID }}
      />,
    );

    expect(
      screen.getByText("A geração falhou e o crédito foi devolvido."),
    ).toBeInTheDocument();
    for (const forbidden of FORBIDDEN) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
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
