// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
/**
 * F50.3 (REQ-50.3-02) — input de CNPJ fail-closed no onboarding.
 *
 * Prova os comportamentos que vivem no componente (StoreIdentityForm):
 * - colagem hostil detectada no `onPaste` ANTES do maxLength/onChange;
 * - erro local persistente (campo vazio NÃO limpa; só entrada completa válida);
 * - lookup bloqueado no blur e submit bloqueado com erro local;
 * - resposta de lookup obsoleta descartada (sequência/abort);
 * - troca de CNPJ após `resolved` limpa dados oficiais e billing derivado.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

// Mock do viewer de documentos para que o modal de aceite fique confirmável
// sem carregar iframes no jsdom (o componente só libera "Aceitar termos"
// quando todos os documentos reportam `onLoad(true)`).
vi.mock("@/components/legal/legal-document-viewer", async () => {
  const React = await import("react");
  return {
    LegalDocumentViewer: ({ onLoad }: { onLoad?: (success: boolean) => void }) => {
      const done = React.useRef(false);
      React.useEffect(() => {
        if (done.current) return;
        done.current = true;
        onLoad?.(true);
      }, [onLoad]);
      return null;
    },
  };
});

import { StoreIdentityForm } from "../store-identity-form";

// ── Helpers ────────────────────────────────────────────────────────────────

const LEGAL_VERSIONS = {
  versions: {
    terms_of_service: { label: "Termos de Uso", version: "v1", url: "/termos" },
    acceptable_use: { label: "Política de Uso Aceitável", version: "v1", url: "/aup" },
  },
};

const VALID_ALPHA_DISPLAY = "12.ABC.345/01DE-35";
const VALID_ALPHA_CANONICAL = "12ABC34501DE35";
const OTHER_VALID_DISPLAY = "11.222.333/0001-81";

const OFFICIAL_A = {
  razao_social: "EMPRESA ALFA LTDA",
  nome_fantasia: "Empresa Alfa",
  cidade: "São Paulo",
  uf: "SP",
  logradouro: "Rua A",
  numero: "1",
  bairro: "Centro",
  cep: "01000-000",
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

interface FetchOverrides {
  lookup?: (url: string, init?: RequestInit) => Promise<Response> | Response;
}

function installFetch(routes: Record<string, unknown>, overrides: FetchOverrides = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (overrides.lookup && url.startsWith("/api/cnpj/lookup")) {
      return overrides.lookup(url, init);
    }
    const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (url.startsWith(key)) return okJson(routes[key]);
    }
    return okJson({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function callsTo(fetchMock: ReturnType<typeof vi.fn>, prefix: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input).startsWith(prefix));
}

function lookupCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return callsTo(fetchMock, "/api/cnpj/lookup");
}

function storePosts(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input) === "/api/store" && (init as RequestInit | undefined)?.method === "POST",
  );
}

function cnpjInput() {
  return screen.getByLabelText(/^CNPJ/i) as HTMLInputElement;
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Nome da Loja/i), {
    target: { value: "Minha Loja" },
  });
  fireEvent.change(screen.getByLabelText(/^Segmento/i), {
    target: { value: "outros" },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Salvar e continuar" }));
}

function errorAlert() {
  return screen.queryByRole("alert");
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
  installMatchMedia(false); // desktop
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function acceptLegalTerms() {
  const buttons = screen.getAllByRole("button", { name: /Revisar e aceitar/i });
  fireEvent.click(buttons[0]);
  const checkbox = await screen.findByRole("checkbox");
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: /Aceitar termos/i }));
  await waitFor(() => {
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
}

// ── Testes ─────────────────────────────────────────────────────────────────

describe("StoreIdentityForm — CNPJ alfanumérico fail-closed (F50.3)", () => {
  it("1. digitação alfanumérica é formatada (12abc → 12.ABC)", () => {
    installFetch({ "/api/legal/current-versions": LEGAL_VERSIONS });
    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fireEvent.change(cnpjInput(), { target: { value: "12abc" } });

    expect(cnpjInput().value).toBe("12.ABC");
  });

  it("2. colagem de caractere desconhecido mantém o último valor e bloqueia lookup no blur", async () => {
    const fetchMock = installFetch({ "/api/legal/current-versions": LEGAL_VERSIONS });
    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fireEvent.change(cnpjInput(), { target: { value: "12.ABC.345/01DE-3" } });
    const previous = cnpjInput().value;

    fireEvent.change(cnpjInput(), {
      target: { value: `${VALID_ALPHA_DISPLAY}😀` },
    });

    expect(cnpjInput().value).toBe(previous);
    expect(errorAlert()).toHaveTextContent("CNPJ inválido");

    fireEvent.blur(cnpjInput());
    await act(async () => {
      await Promise.resolve();
    });

    expect(lookupCalls(fetchMock)).toHaveLength(0);
  });

  it("3. submit com erro local não chama POST /api/store", async () => {
    const fetchMock = installFetch({ "/api/legal/current-versions": LEGAL_VERSIONS });
    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fillRequiredFields();
    fireEvent.change(cnpjInput(), {
      target: { value: `${VALID_ALPHA_DISPLAY}😀` },
    });

    submit();

    await waitFor(() => {
      expect(storePosts(fetchMock)).toHaveLength(0);
    });
    expect(errorAlert()).toHaveTextContent("CNPJ inválido");
  });

  it("4. entrada parcial mantém o erro; só entrada completa válida limpa", () => {
    installFetch({ "/api/legal/current-versions": LEGAL_VERSIONS });
    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fireEvent.change(cnpjInput(), { target: { value: "😀" } });
    expect(errorAlert()).toHaveTextContent("CNPJ inválido");

    fireEvent.change(cnpjInput(), { target: { value: "12.ABC.345/01DE-3" } });
    expect(errorAlert()).toHaveTextContent("CNPJ inválido");

    fireEvent.change(cnpjInput(), { target: { value: VALID_ALPHA_DISPLAY } });
    expect(errorAlert()).not.toBeInTheDocument();
  });

  it("5. resposta de lookup em voo é descartada após mudança inválida", async () => {
    let resolveLookup!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveLookup = resolve;
    });

    installFetch(
      { "/api/legal/current-versions": LEGAL_VERSIONS },
      { lookup: () => pending },
    );

    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fireEvent.change(cnpjInput(), { target: { value: VALID_ALPHA_DISPLAY } });
    fireEvent.blur(cnpjInput());

    await waitFor(() => {
      expect(screen.getByText(/Consultando dados cadastrais/)).toBeInTheDocument();
    });

    fireEvent.change(cnpjInput(), {
      target: { value: `${VALID_ALPHA_DISPLAY}😀` },
    });

    await act(async () => {
      resolveLookup(okJson({ status: "resolved", data: OFFICIAL_A }));
      await pending;
    });

    expect(screen.queryByText(/Dados carregados da Receita Federal/)).not.toBeInTheDocument();
    expect(
      (screen.getByLabelText(/Razão Social/i) as HTMLInputElement).value,
    ).toBe("");
  });

  it("6. colagem hostil com campo vazio ativa erro e bloqueia submit sem POST", async () => {
    const fetchMock = installFetch({ "/api/legal/current-versions": LEGAL_VERSIONS });
    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    expect(cnpjInput().value).toBe("");

    fireEvent.change(cnpjInput(), { target: { value: "😀" } });
    expect(errorAlert()).toHaveTextContent("CNPJ inválido");

    fillRequiredFields();
    submit();

    await waitFor(() => {
      expect(storePosts(fetchMock)).toHaveLength(0);
    });
  });

  it("7. lookup resolved + troca para outro CNPJ válido limpa dados oficiais e billing", async () => {
    const fetchMock = installFetch(
      { "/api/legal/current-versions": LEGAL_VERSIONS },
      {
        lookup: () => okJson({ status: "resolved", data: OFFICIAL_A }),
      },
    );

    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fireEvent.change(cnpjInput(), { target: { value: VALID_ALPHA_DISPLAY } });
    fireEvent.blur(cnpjInput());

    await waitFor(() => {
      expect(screen.getByText(/Dados carregados da Receita Federal/)).toBeInTheDocument();
    });
    expect((screen.getByLabelText(/Razão Social/i) as HTMLInputElement).value).toBe(
      OFFICIAL_A.razao_social,
    );
    expect(
      screen.getByRole("button", { name: /Usar razão social como nome da loja/i }),
    ).toBeInTheDocument();
    expect(lookupCalls(fetchMock)).toHaveLength(1);

    fireEvent.change(cnpjInput(), { target: { value: OTHER_VALID_DISPLAY } });

    expect(screen.queryByText(/Dados carregados da Receita Federal/)).not.toBeInTheDocument();
    expect((screen.getByLabelText(/Razão Social/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Nome Fantasia/i) as HTMLInputElement).value).toBe("");
    expect(
      screen.queryByRole("button", { name: /Usar razão social como nome da loja/i }),
    ).not.toBeInTheDocument();
  });

  it("8. após trocar o CNPJ, POST /api/store não carrega nomes oficiais do CNPJ anterior", async () => {
    const fetchMock = installFetch(
      { "/api/legal/current-versions": LEGAL_VERSIONS },
      {
        lookup: () => okJson({ status: "resolved", data: OFFICIAL_A }),
      },
    );

    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fireEvent.change(cnpjInput(), { target: { value: VALID_ALPHA_DISPLAY } });
    fireEvent.blur(cnpjInput());
    await waitFor(() => {
      expect(screen.getByText(/Dados carregados da Receita Federal/)).toBeInTheDocument();
    });

    fireEvent.change(cnpjInput(), { target: { value: OTHER_VALID_DISPLAY } });

    await acceptLegalTerms();
    fillRequiredFields();
    submit();

    await waitFor(() => {
      expect(storePosts(fetchMock)).toHaveLength(1);
    });

    const body = JSON.parse(
      String((storePosts(fetchMock)[0][1] as RequestInit).body),
    ) as Record<string, unknown>;

    expect(body.razaoSocial).toBeUndefined();
    expect(body.nomeFantasia).toBeUndefined();
    expect(body.cnpj).toBe("11222333000181");
  });

  it("9. onPaste inspeciona o clipboard bruto antes do maxLength (inválido após posição 18)", () => {
    installFetch({ "/api/legal/current-versions": LEGAL_VERSIONS });
    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fireEvent.change(cnpjInput(), { target: { value: "12.ABC.345/01DE-3" } });
    const previous = cnpjInput().value;

    const hostile = `${VALID_ALPHA_DISPLAY}${"0".repeat(20)}😀`;
    const notCancelled = fireEvent.paste(cnpjInput(), {
      clipboardData: { getData: () => hostile },
    });

    expect(notCancelled).toBe(false); // preventDefault chamado
    expect(cnpjInput().value).toBe(previous);
    expect(errorAlert()).toHaveTextContent("CNPJ inválido");
  });

  it("10. limpar o campo após erro mantém erro/bloqueio; entrada completa válida limpa", async () => {
    const fetchMock = installFetch({ "/api/legal/current-versions": LEGAL_VERSIONS });
    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    fireEvent.change(cnpjInput(), { target: { value: "😀" } });
    expect(errorAlert()).toHaveTextContent("CNPJ inválido");

    fireEvent.change(cnpjInput(), { target: { value: "" } });
    expect(cnpjInput().value).toBe("");
    expect(errorAlert()).toHaveTextContent("CNPJ inválido");

    fillRequiredFields();
    submit();
    await waitFor(() => {
      expect(storePosts(fetchMock)).toHaveLength(0);
    });

    fireEvent.change(cnpjInput(), { target: { value: VALID_ALPHA_DISPLAY } });
    expect(errorAlert()).not.toBeInTheDocument();
    expect(cnpjInput().value).toBe(VALID_ALPHA_DISPLAY);
    expect(VALID_ALPHA_CANONICAL).toBe("12ABC34501DE35");
  });
});
