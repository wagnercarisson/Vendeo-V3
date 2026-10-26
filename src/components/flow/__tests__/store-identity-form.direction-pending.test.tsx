// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Store } from "@/lib/store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { StoreIdentityForm } from "../store-identity-form";

function okJson(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

const STORE_ID = "store-1";

const STORE = {
  id: STORE_ID,
  user_id: "user-1",
  name: "Minha Loja",
  segment: "outros",
  city: null,
  state: null,
  brand_color: "#22C55E",
  logo_url: null,
  subsegment: null,
  tone_of_voice: null,
  positioning: null,
  short_description: null,
  slogan: null,
  logo_status: "generated",
  identity_state: "visual_signature",
  text_only_origin: null,
  manual_color_override: false,
  previous_identity_snapshot: null,
  visual_signature_attempts: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  cnpj_normalized: null,
  cnpj_root_hash: "",
  razao_social: null,
  nome_fantasia: null,
  cnpj_validation_score: null,
  verification_status: "not_verified",
  verification_data: null,
  cnpj_official_data: null,
  cnpj_lookup_hash: null,
  verification_requested_at: null,
  verification_decided_at: null,
  verification_reasons: null,
  is_test_store: false,
} as unknown as Store;

const SYNCED_PROFILE = {
  id: "p-1",
  status: "synced",
  logo_colors_detected: ["#22C55E"],
  safe_color_tokens: { primary: "#22C55E", accent: "#1E40AF", secondary: "#3B82F6", background: "#FFFFFF" },
  visual_style: "Moderno",
  visual_tone: "Elegante",
  brand_personality: "Sofisticado",
  brand_colors_chosen: [],
  inferred_primary_color: "#22C55E",
  inferred_accent_color: "#1E40AF",
  metadata: {},
};

type ReadinessConfig = Record<string, unknown> | "loading" | "error" | "reject";

interface Routes {
  directionState?: Record<string, unknown> | "error";
  syncedProfile?: unknown;
  readiness?: ReadinessConfig | ReadinessConfig[];
  realign?: Record<string, unknown>;
  visualSignatures?: Record<string, unknown>;
  reviewSignatures?: Record<string, unknown>;
  generate?: Record<string, unknown>;
  approve?: Record<string, unknown>;
  store?: Record<string, unknown>;
}

function readinessResponse(config?: ReadinessConfig): Promise<Response> | Response {
  if (config === "loading") return new Promise<Response>(() => {});
  if (config === "error") return { ok: false, json: async () => ({}) } as Response;
  if (config === "reject") return Promise.reject(new Error("readiness unavailable"));
  return okJson(config ?? { ready: true, missing: [] });
}

function installFetch(routes: Routes = {}) {
  let readinessCalls = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/legal/current-versions") {
      return okJson({
        versions: {
          terms_of_service: { label: "Termos", version: "v1", url: "/t" },
          acceptable_use: { label: "AUP", version: "v1", url: "/a" },
        },
      });
    }
    if (url === "/api/legal/status") {
      return okJson({ acceptanceStatus: "current" });
    }
    if (url === `/api/store/${STORE_ID}/legal-status`) {
      return okJson({ hasValidAcceptance: true });
    }
    if (url === "/api/store/check-readiness") {
      const configured = Array.isArray(routes.readiness)
        ? routes.readiness[Math.min(readinessCalls, routes.readiness.length - 1)]
        : routes.readiness;
      readinessCalls += 1;
      return readinessResponse(configured);
    }
    if (url === `/api/store/${STORE_ID}/visual-signature/generate-without-logo`) {
      return okJson(
        routes.generate ?? {
          assetUrl: "https://x/pending.png",
          signatureId: "sig-pending",
          artDirectorOutput: {
            creative_description: "Assinatura pendente",
            suggested_colors: ["#22C55E"],
            visual_direction: "Moderna",
            elements_used: ["nome da loja"],
          },
          attempt: 1,
        },
      );
    }
    if (url === `/api/store/${STORE_ID}/visual-signature/approve`) {
      return okJson(
        routes.approve ?? {
          signature: { assetUrl: "https://x/pending.png", id: "sig-pending", status: "active" },
          bp_status: "success",
        },
      );
    }
    if (url.includes(`/api/store/${STORE_ID}/visual-signature?limit=6`)) {
      return okJson(routes.reviewSignatures ?? { signatures: [], total: 0 });
    }
    if (url === `/api/store/${STORE_ID}/visual-signature`) {
      return okJson(
        routes.visualSignatures ?? {
          signatures: [],
          total: 0,
          credit_balance: 5,
          credits_charging_enabled: false,
        },
      );
    }
    if (url === `/api/store/${STORE_ID}/brand-profile?status=direction-state`) {
      if (routes.directionState === "error") {
        return { ok: false, json: async () => ({ error: "direction_state_unavailable" }) } as Response;
      }
      return okJson(
        routes.directionState ?? {
          pending: false,
          active_signature_id: "sig-1",
          synced_profile_id: "p-1",
          reference: "sig-1",
          failure_at: null,
        },
      );
    }
    if (url === `/api/store/${STORE_ID}/brand-profile?status=synced`) {
      return okJson(routes.syncedProfile ?? SYNCED_PROFILE);
    }
    if (url === `/api/store/${STORE_ID}/brand-profile/realign`) {
      return okJson(routes.realign ?? { success: true, profile: SYNCED_PROFILE });
    }
    if (url === `/api/store/${STORE_ID}/brand-profile`) {
      return okJson(null);
    }
    if (url === `/api/store/${STORE_ID}/logo`) {
      return okJson({ assets: {} });
    }
    if (url === `/api/store/${STORE_ID}`) {
      return okJson(routes.store ?? STORE);
    }
    return okJson({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const DVAP01_MESSAGE =
  "Não foi possível concluir sua direção visual. A geração de campanhas ficará indisponível até a conclusão. Entre em contato com o suporte e informe o código DVAP01. Após a orientação do suporte, clique em Realinhar direção visual.";
const DVRE01_MESSAGE =
  "Não foi possível concluir sua direção visual. A geração de campanhas ficará indisponível até a conclusão. Entre em contato com o suporte e informe o código DVRE01. Após a orientação do suporte, clique em Realinhar direção visual.";

const PENDING_STATE = {
  pending: true,
  active_signature_id: "sig-1",
  synced_profile_id: null,
  reference: "run-ref-42",
  failure_at: "2026-10-25T00:00:00.000Z",
  support_code: "DVAP01",
};

const NEEDS_DIRECTION_WARNING =
  "Sua loja precisa de uma direção visual para gerar campanhas. Configure agora.";

const READY = { ready: true, missing: [] };
const FISCAL_ONLY = {
  ready: false,
  missing: [{ item: "cadastro_fiscal", reason: "CNPJ pendente para geração." }],
};
const BRAND_PROFILE_MISSING = {
  ready: false,
  missing: [{ item: "brand_profile", reason: "Perfil de marca ainda não gerado." }],
};
const READINESS_UNAVAILABLE = {
  ready: false,
  missing: [{
    item: "brand_profile",
    reason: "Não foi possível verificar a prontidão da loja: offline",
  }],
};

function renderForm({ redirectMessage }: { redirectMessage?: string } = {}) {
  return render(
    <StoreIdentityForm
      initialStore={STORE}
      userId="user-1"
      initialTab="direcao-visual"
      redirectMessage={redirectMessage}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("StoreIdentityForm — direção visual pendente (261025-svt)", () => {
  it("load com pending mostra banner com DVAP01 (sem UUID) e não aplica o perfil synced", async () => {
    const fetchMock = installFetch({ directionState: PENDING_STATE, syncedProfile: SYNCED_PROFILE });
    renderForm();

    await waitFor(() => {
      expect(screen.getByText("Direção visual pendente")).toBeInTheDocument();
    });
    expect(screen.getByText(DVAP01_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/Código de suporte/)).not.toBeInTheDocument();
    expect(screen.queryByText(/run-ref-42/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Realinhar direção visual" })).toBeInTheDocument();
    // Campos orientadores limpos → badge "Necessário" (sem perfil aplicado)
    expect(screen.getAllByText("Necessário").length).toBeGreaterThan(0);

    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("status=direction-state"))).toBe(true);
  });

  it("load com pendência histórica sem support_code deriva DVAP01", async () => {
    installFetch({
      directionState: { ...PENDING_STATE, support_code: undefined },
      syncedProfile: SYNCED_PROFILE,
    });
    renderForm();

    await waitFor(() => {
      expect(screen.getByText("Direção visual pendente")).toBeInTheDocument();
    });
    expect(screen.getByText(DVAP01_MESSAGE)).toBeInTheDocument();
  });

  it("load com direção realinhada pendente usa DVRE01", async () => {
    installFetch({
      directionState: { ...PENDING_STATE, support_code: "DVRE01" },
      syncedProfile: SYNCED_PROFILE,
    });
    renderForm();

    await waitFor(() => {
      expect(screen.getByText(DVRE01_MESSAGE)).toBeInTheDocument();
    });
  });

  it("load sem pendência não mostra banner", async () => {
    installFetch({ directionState: { ...PENDING_STATE, pending: false } });
    renderForm();

    await waitFor(() => {
      expect(screen.queryByText("Direção visual pendente")).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/Código de suporte/)).not.toBeInTheDocument();
  });

  it("erro de leitura mostra banner de erro explícito (não legado/ausência)", async () => {
    installFetch({ directionState: "error" });
    renderForm();

    await waitFor(() => {
      expect(screen.getByText("Não foi possível verificar a direção visual")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Realinhar direção visual" })).toBeInTheDocument();
  });

  describe("GAP 1 — aviso de direção derivado da prontidão", () => {
    it("URL needs-visual-direction + prontidão completa não mostra o aviso antigo", async () => {
      const fetchMock = installFetch({ readiness: READY });
      renderForm({ redirectMessage: "needs-visual-direction" });

      await waitFor(() => {
        expect(fetchMock.mock.calls.some(
          ([u]) => String(u) === "/api/store/check-readiness",
        )).toBe(true);
      });
      expect(screen.queryByText(NEEDS_DIRECTION_WARNING)).not.toBeInTheDocument();
    });

    it("pendência apenas fiscal não é tratada como ausência de direção", async () => {
      const fetchMock = installFetch({ readiness: FISCAL_ONLY });
      renderForm({ redirectMessage: "needs-visual-direction" });

      await waitFor(() => {
        expect(fetchMock.mock.calls.some(
          ([u]) => String(u) === "/api/store/check-readiness",
        )).toBe(true);
      });
      expect(screen.queryByText(NEEDS_DIRECTION_WARNING)).not.toBeInTheDocument();
    });

    it("brand_profile confirmado em missing mostra o aviso de direção", async () => {
      installFetch({ readiness: BRAND_PROFILE_MISSING });
      renderForm({ redirectMessage: "needs-visual-direction" });

      await waitFor(() => {
        expect(screen.getByText(NEEDS_DIRECTION_WARNING)).toBeInTheDocument();
      });
    });

    it("prontidão carregando não infere ausência de direção pela URL", async () => {
      const fetchMock = installFetch({ readiness: "loading" });
      renderForm({ redirectMessage: "needs-visual-direction" });

      await waitFor(() => {
        expect(fetchMock.mock.calls.some(
          ([u]) => String(u) === "/api/store/check-readiness",
        )).toBe(true);
      });
      expect(screen.queryByText(NEEDS_DIRECTION_WARNING)).not.toBeInTheDocument();
    });

    it("prontidão indisponível (fallback/erro) não infere ausência de direção pela URL", async () => {
      const fallbackFetch = installFetch({ readiness: READINESS_UNAVAILABLE });
      const first = renderForm({ redirectMessage: "needs-visual-direction" });

      await waitFor(() => {
        expect(fallbackFetch.mock.calls.some(
          ([u]) => String(u) === "/api/store/check-readiness",
        )).toBe(true);
      });
      expect(screen.queryByText(NEEDS_DIRECTION_WARNING)).not.toBeInTheDocument();
      first.unmount();

      installFetch({ readiness: "reject" });
      renderForm({ redirectMessage: "needs-visual-direction" });
      await waitFor(() => {
        expect(screen.queryByText(NEEDS_DIRECTION_WARNING)).not.toBeInTheDocument();
      });
    });

    it("realinhamento bem-sucedido + prontidão atualizada remove o aviso sem mudar a URL", async () => {
      installFetch({
        directionState: PENDING_STATE,
        readiness: [BRAND_PROFILE_MISSING, READY],
        realign: { success: true, profile: SYNCED_PROFILE },
      });
      const urlBefore = window.location.href;
      renderForm({ redirectMessage: "needs-visual-direction" });

      await waitFor(() => expect(screen.getByText("Direção visual pendente")).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "Realinhar direção visual" }));

      await waitFor(() => {
        expect(screen.queryByText("Direção visual pendente")).not.toBeInTheDocument();
      });
      expect(screen.queryByText(NEEDS_DIRECTION_WARNING)).not.toBeInTheDocument();
      expect(window.location.href).toBe(urlBefore);
    });

    it("outra pendência permanece após recuperação e não há aviso de direção/campanhas liberadas", async () => {
      installFetch({
        directionState: PENDING_STATE,
        readiness: [BRAND_PROFILE_MISSING, FISCAL_ONLY],
        realign: { success: true, profile: SYNCED_PROFILE },
      });
      renderForm({ redirectMessage: "needs-visual-direction" });

      await waitFor(() => expect(screen.getByText("Direção visual pendente")).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "Realinhar direção visual" }));

      await waitFor(() => {
        expect(screen.queryByText("Direção visual pendente")).not.toBeInTheDocument();
      });
      expect(screen.queryByText(NEEDS_DIRECTION_WARNING)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: /Dados/i }));
      await waitFor(() => {
        expect(screen.getByText(/Fiscal pendente:/)).toBeInTheDocument();
      });
    });
  });

  it("realinhamento bem-sucedido limpa o banner e reexecuta readiness", async () => {
    const fetchMock = installFetch({
      directionState: PENDING_STATE,
      realign: { success: true, profile: SYNCED_PROFILE },
    });
    renderForm();

    await waitFor(() => expect(screen.getByText("Direção visual pendente")).toBeInTheDocument());

    const readinessBefore = fetchMock.mock.calls.filter(
      ([u]) => String(u) === "/api/store/check-readiness",
    ).length;

    fireEvent.click(screen.getByRole("button", { name: "Realinhar direção visual" }));

    await waitFor(() => {
      expect(screen.queryByText("Direção visual pendente")).not.toBeInTheDocument();
    });

    const readinessAfter = fetchMock.mock.calls.filter(
      ([u]) => String(u) === "/api/store/check-readiness",
    ).length;
    expect(readinessAfter).toBeGreaterThan(readinessBefore);
    expect(
      fetchMock.mock.calls.some(
        ([u, init]) =>
          String(u) === `/api/store/${STORE_ID}/brand-profile/realign` &&
          (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(true);
  });

  it("realinhamento falhando mantém a pendência e atualiza para DVRE01", async () => {
    installFetch({
      directionState: PENDING_STATE,
      realign: {
        success: false,
        message: DVRE01_MESSAGE,
        support_code: "DVRE01",
        failure_reference: "run-ref-99",
      },
    });
    renderForm();

    await waitFor(() => expect(screen.getByText(DVAP01_MESSAGE)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Realinhar direção visual" }));

    await waitFor(() => {
      expect(screen.getByText(DVRE01_MESSAGE)).toBeInTheDocument();
    });
    expect(screen.getByText("Direção visual pendente")).toBeInTheDocument();
    expect(screen.queryByText(/run-ref-99/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Código de suporte/)).not.toBeInTheDocument();
  });

  it("integração modal → formulário (aprovação inicial): atualiza imagem/identidade e readiness sem remover a pendência", async () => {
    const initialStore = {
      ...STORE,
      identity_state: "text_only",
      logo_status: null,
      visual_signature_url: null,
      has_archived_signatures: false,
      tone_of_voice: "profissional",
    };
    const fetchMock = installFetch({
      store: initialStore,
      syncedProfile: null,
      approve: {
        signature: {
          assetUrl: "https://x/new-initial.png",
          id: "sig-new-initial",
          status: "active",
        },
        bp_status: "failed",
        brand_profile_status: "failed",
        support_code: "DVAP01",
        failure_reference: "run-initial",
        message: DVAP01_MESSAGE,
      },
    });

    render(
      <StoreIdentityForm
        initialStore={initialStore as unknown as Store}
        userId="user-1"
        initialTab="direcao-visual"
        initialApprovalMode="standard"
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Aprovar" })).toBeInTheDocument());
    const readinessBefore = fetchMock.mock.calls.filter(
      ([u]) => String(u) === "/api/store/check-readiness",
    ).length;

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() => {
      expect(screen.getByAltText("Assinatura visual")).toHaveAttribute(
        "src",
        "https://x/new-initial.png",
      );
    });
    expect(screen.getByText("Assinatura visual ativa")).toBeInTheDocument();
    expect(screen.getAllByText(/informe o código DVAP01/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/run-initial/)).not.toBeInTheDocument();
    expect(screen.queryByText("Direção visual definida pelo Vendeo")).not.toBeInTheDocument();

    const readinessAfter = fetchMock.mock.calls.filter(
      ([u]) => String(u) === "/api/store/check-readiness",
    ).length;
    expect(readinessAfter).toBeGreaterThan(readinessBefore);
  }, 15000);

  it("integração modal → formulário (substituição): troca a imagem pendente e reconsulta readiness sem remover o banner", async () => {
    const substitutionStore = {
      ...STORE,
      identity_state: "visual_signature",
      logo_status: "generated",
      visual_signature_url: "https://x/old-signature.png",
      visual_signature_attempts: 1,
    };
    const fetchMock = installFetch({
      store: substitutionStore,
      visualSignatures: {
        signatures: [
          {
            id: "sig-active",
            status: "active",
            type: "ai_generated",
            input_snapshot: {
              name: "Nome Antigo",
              segment: "outros",
              city: null,
              state: null,
              slogan: null,
            },
            art_direction: {
              content_used: { store_name: true, city: false, state: false, slogan: false },
            },
            critical_drift: null,
            dismissed_snapshot: null,
          },
        ],
        total: 1,
        credit_balance: 5,
        credits_charging_enabled: false,
      },
      approve: {
        signature: {
          assetUrl: "https://x/new-substitution.png",
          id: "sig-new-substitution",
          status: "active",
        },
        bp_status: "failed",
        brand_profile_status: "failed",
        support_code: "DVAP01",
        failure_reference: "run-substitution",
        message: DVAP01_MESSAGE,
      },
    });

    render(
      <StoreIdentityForm
        initialStore={substitutionStore as unknown as Store}
        userId="user-1"
        initialTab="direcao-visual"
        initialApprovalMode="substitution"
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Aprovar" })).toBeInTheDocument());
    const readinessBefore = fetchMock.mock.calls.filter(
      ([u]) => String(u) === "/api/store/check-readiness",
    ).length;

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() => {
      expect(screen.getByAltText("Assinatura visual")).toHaveAttribute(
        "src",
        "https://x/new-substitution.png",
      );
    });
    expect(screen.getByText("Assinatura visual ativa")).toBeInTheDocument();
    expect(screen.getAllByText(/informe o código DVAP01/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/run-substitution/)).not.toBeInTheDocument();

    const readinessAfter = fetchMock.mock.calls.filter(
      ([u]) => String(u) === "/api/store/check-readiness",
    ).length;
    expect(readinessAfter).toBeGreaterThan(readinessBefore);
  }, 15000);
});
