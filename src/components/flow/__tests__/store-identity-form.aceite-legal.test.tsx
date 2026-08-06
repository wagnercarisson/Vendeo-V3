// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
/**
 * Fix 260806-fsl-feedback-aceite-legal — feedback explícito ao salvar/continuar
 * sem aceite legal no F36.
 *
 * Padrão do repo: os cenários bloqueadores do StoreIdentityForm são provados na
 * camada que ORQUESTRA (useOnboardingTabs) OU renderizando os elementos reais.
 * Aqui o comportamento VIVE no componente (handleStep1Submit), então renderiza
 * o StoreIdentityForm real em modo criação (mount leve: sem storeId, sem
 * drift/brand profile) com mocks de fetch/matchMedia — a prova do checklist do
 * usuário (não salva + feedback claro + foco no card).
 */

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

// ── Helpers ────────────────────────────────────────────────────────────────

const LEGAL_VERSIONS = {
  versions: {
    terms_of_service: { label: "Termos de Uso", version: "v1", url: "/termos" },
    acceptable_use: { label: "Política de Uso Aceitável", version: "v1", url: "/aup" },
  },
};

function okJson(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

function installFetch(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    // Prefixos mais específicos primeiro — evita "/api/store" casar com
    // "/api/store/store-1/legal-status".
    const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (url.startsWith(key)) return okJson(routes[key]);
    }
    return okJson({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const STORE: Store = {
  id: "store-1",
  user_id: "user-1",
  name: "Minha Loja",
  segment: "outros",
  city: null,
  state: null,
  brand_color: null,
  logo_url: null,
  subsegment: null,
  tone_of_voice: null,
  positioning: null,
  short_description: null,
  slogan: null,
  logo_status: null,
  identity_state: null,
  text_only_origin: null,
  manual_color_override: false,
  previous_identity_snapshot: null,
  visual_signature_attempts: 0,
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
};

beforeEach(() => {
  localStorage.clear();
  installMatchMedia(false); // desktop (isMobile false)
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Testes ─────────────────────────────────────────────────────────────────

describe("StoreIdentityForm — salvar/continuar sem aceite legal (fix 260806-fsl-feedback-aceite-legal)", () => {
  it("sem aceite + 'Salvar e continuar' → modal de erro + NÃO chama save (POST /api/store)", async () => {
    const fetchMock = installFetch({
      "/api/legal/current-versions": LEGAL_VERSIONS,
    });

    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fireEvent.change(screen.getByLabelText(/Nome da Loja/i), {
      target: { value: "Minha Loja" },
    });
    fireEvent.change(screen.getByLabelText(/^Segmento/i), {
      target: { value: "outros" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar e continuar" }));

    // Feedback claro e imediato (mensagem curta, modal de erro existente)
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByText("Para continuar, leia e aceite os termos de uso."),
    ).toBeInTheDocument();

    // Não salva: nenhuma chamada a POST /api/store (criação) nem update-cnpj
    const storeCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/api/store"),
    );
    expect(storeCalls).toHaveLength(0);
  });

  it("ao fechar o modal de erro, o foco vai para o card de aceite VISÍVEL (desktop → #aceite-legal)", async () => {
    installFetch({ "/api/legal/current-versions": LEGAL_VERSIONS });

    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fireEvent.change(screen.getByLabelText(/Nome da Loja/i), {
      target: { value: "Minha Loja" },
    });
    fireEvent.change(screen.getByLabelText(/^Segmento/i), {
      target: { value: "outros" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar e continuar" }));

    const modal = await screen.findByRole("alertdialog");
    expect(modal).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    // Foco/scroll ao card de aceite do viewport atual (ids únicos; a outra
    // variante fica display:none no DOM).
    await waitFor(() => {
      expect(document.activeElement?.id).toBe("aceite-legal");
    });
    expect(document.getElementById("aceite-legal-mobile")).not.toBeNull();
  });

  it("após aceite válido (edit mode) 'Salvar e continuar' chama PATCH e navega para Posicionamento", async () => {
    installFetch({
      "/api/legal/current-versions": LEGAL_VERSIONS,
      "/api/store/store-1/legal-status": {
        hasValidAcceptance: true,
        tosStatus: "current",
        aupStatus: "current",
      },
      "/api/store/check-readiness": { ready: true, missing: [] },
      "/api/store/store-1": { id: "store-1" },
    });

    render(<StoreIdentityForm initialStore={STORE} userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Salvar e continuar" }));

    // Navegou para a aba Posicionamento
    expect(
      await screen.findByRole("heading", { name: "Posicionamento" }),
    ).toBeInTheDocument();
  });
});
