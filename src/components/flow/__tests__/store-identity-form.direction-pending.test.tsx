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

interface Routes {
  directionState?: Record<string, unknown> | "error";
  syncedProfile?: unknown;
  realign?: Record<string, unknown>;
}

function installFetch(routes: Routes = {}) {
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
    if (url === `/api/store/${STORE_ID}/legal-status`) {
      return okJson({ hasValidAcceptance: true });
    }
    if (url === "/api/store/check-readiness") {
      return okJson({ ready: true, missing: [] });
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
      return okJson(STORE);
    }
    return okJson({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const PENDING_STATE = {
  pending: true,
  active_signature_id: "sig-1",
  synced_profile_id: null,
  reference: "run-ref-42",
  failure_at: "2026-10-25T00:00:00.000Z",
};

function renderForm() {
  return render(
    <StoreIdentityForm initialStore={STORE} userId="user-1" initialTab="direcao-visual" />,
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
  it("load com pending mostra banner com referência e não aplica o perfil synced", async () => {
    const fetchMock = installFetch({ directionState: PENDING_STATE, syncedProfile: SYNCED_PROFILE });
    renderForm();

    await waitFor(() => {
      expect(screen.getByText("Direção visual pendente")).toBeInTheDocument();
    });
    expect(screen.getByText("Código de suporte: run-ref-42")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Realinhar direção visual" })).toBeInTheDocument();
    // Campos orientadores limpos → badge "Necessário" (sem perfil aplicado)
    expect(screen.getAllByText("Necessário").length).toBeGreaterThan(0);

    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("status=direction-state"))).toBe(true);
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

  it("realinhamento falhando mantém a pendência e atualiza a referência", async () => {
    installFetch({
      directionState: PENDING_STATE,
      realign: {
        success: false,
        message: "Não foi possível concluir a direção visual. Tente novamente.",
        failure_reference: "run-ref-99",
      },
    });
    renderForm();

    await waitFor(() => expect(screen.getByText("Código de suporte: run-ref-42")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Realinhar direção visual" }));

    await waitFor(() => {
      expect(screen.getByText("Código de suporte: run-ref-99")).toBeInTheDocument();
    });
    expect(screen.getByText("Direção visual pendente")).toBeInTheDocument();
  });
});
