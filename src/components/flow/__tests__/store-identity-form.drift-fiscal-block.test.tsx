// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
/**
 * CR-01 (F50.3) — o caminho de drift NÃO contorna o bloqueio fiscal.
 *
 * `persistSaveFromDrift()` chama `save()` diretamente, sem os guards do
 * `handleStep1Submit`. Aqui provamos, pela UI real do onboarding:
 * 1. com erro local de CNPJ ativo, "Manter e salvar" no modal de drift não
 *    dispara nenhum POST (nem draft, nem update-cnpj) e exibe o erro;
 * 2. depois de corrigir o CNPJ, o MESMO fluxo de drift persiste o canônico em
 *    um único POST — sem reload e sem draft silencioso.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const driftMocks = vi.hoisted(() => ({
  ignorar: vi.fn(async () => {}),
  realinhar: vi.fn(async () => ({})),
  dismissCriticalDrift: vi.fn(async () => {}),
}));

vi.mock("../use-drift-detection", () => ({
  useDriftDetection: () => ({
    driftStatus: "sensitive",
    currentSnapshot: {},
    driftCategory: "sensitive",
    criticalDrift: null,
    activeVsSummary: null,
    totalGeneratedSignatures: 0,
    creditBalance: 0,
    creditsChargingEnabled: false,
    dismissCriticalDrift: driftMocks.dismissCriticalDrift,
    realinhar: driftMocks.realinhar,
    ignorar: driftMocks.ignorar,
    isRealinhando: false,
  }),
  resolveRealignErrorMessage: () => "Não foi possível realinhar. Tente novamente mais tarde.",
}));

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

const LEGAL_VERSIONS = {
  versions: {
    terms_of_service: { label: "Termos de Uso", version: "v1", url: "/termos" },
    acceptable_use: { label: "Política de Uso Aceitável", version: "v1", url: "/aup" },
  },
};

const VALID_ALPHA_DISPLAY = "12.ABC.345/01DE-35";
const VALID_ALPHA_CANONICAL = "12ABC34501DE35";

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
    const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (url.startsWith(key)) return okJson(routes[key]);
    }
    return okJson({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function storePosts(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input) === "/api/store" &&
      (init as RequestInit | undefined)?.method === "POST",
  );
}

function updateCnpjPosts(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input) === "/api/store/update-cnpj" &&
      (init as RequestInit | undefined)?.method === "POST",
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

beforeEach(() => {
  localStorage.clear();
  driftMocks.ignorar.mockClear();
  driftMocks.realinhar.mockClear();
  driftMocks.dismissCriticalDrift.mockClear();
  installMatchMedia(false); // desktop
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("StoreIdentityForm — caminho de drift não contorna o bloqueio fiscal (CR-01)", () => {
  it("erro local ativo + 'Manter e salvar' → zero POST e erro visível", async () => {
    const fetchMock = installFetch({
      "/api/legal/current-versions": LEGAL_VERSIONS,
      "/api/store": { id: "store-created-1", cnpj_normalized: VALID_ALPHA_CANONICAL },
    });

    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    await acceptLegalTerms();
    fillRequiredFields();
    fireEvent.change(cnpjInput(), { target: { value: VALID_ALPHA_DISPLAY } });

    submit();

    // Modal de drift intercepta ANTES de qualquer persistência.
    await waitFor(() => {
      expect(screen.getByText("Direção visual desatualizada")).toBeInTheDocument();
    });
    expect(storePosts(fetchMock)).toHaveLength(0);

    // Hostile paste com o modal aberto: ativa o erro local sem mudar o valor
    // exibido (o CNPJ válido anterior é preservado).
    fireEvent.change(cnpjInput(), {
      target: { value: `${VALID_ALPHA_DISPLAY}😀` },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("CNPJ inválido");
    expect(cnpjInput().value).toBe(VALID_ALPHA_DISPLAY);

    fireEvent.click(screen.getByRole("button", { name: "Manter e salvar" }));

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "Erro ao salvar após ignorar drift. Tente novamente.",
      );
    });

    expect(driftMocks.ignorar).toHaveBeenCalledTimes(1);
    expect(storePosts(fetchMock)).toHaveLength(0);
    expect(updateCnpjPosts(fetchMock)).toHaveLength(0);
    expect(cnpjInput().value).toBe(VALID_ALPHA_DISPLAY);
  });

  it("após corrigir o CNPJ, o mesmo fluxo de drift envia UM POST com o canônico (sem reload)", async () => {
    const fetchMock = installFetch({
      "/api/legal/current-versions": LEGAL_VERSIONS,
      "/api/store": { id: "store-created-1", cnpj_normalized: VALID_ALPHA_CANONICAL },
    });

    render(<StoreIdentityForm initialStore={null} userId="user-1" />);

    await acceptLegalTerms();
    fillRequiredFields();
    fireEvent.change(cnpjInput(), { target: { value: VALID_ALPHA_DISPLAY } });

    submit();
    await waitFor(() => {
      expect(screen.getByText("Direção visual desatualizada")).toBeInTheDocument();
    });

    // Primeira tentativa pelo drift falha por erro fiscal local.
    fireEvent.change(cnpjInput(), {
      target: { value: `${VALID_ALPHA_DISPLAY}😀` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Manter e salvar" }));
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "Erro ao salvar após ignorar drift. Tente novamente.",
      );
    });
    expect(storePosts(fetchMock)).toHaveLength(0);

    // Correção completa válida limpa o erro local — sem reload (digitação:
    // parcial mantém o bloqueio, a entrada completa válida o remove).
    fireEvent.change(cnpjInput(), { target: { value: "12.ABC.345/01DE-3" } });
    expect(screen.getByRole("alert")).toHaveTextContent("CNPJ inválido");
    fireEvent.change(cnpjInput(), { target: { value: VALID_ALPHA_DISPLAY } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    submit();
    await waitFor(() => {
      expect(screen.getByText("Direção visual desatualizada")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Manter e salvar" }));

    await waitFor(() => {
      expect(storePosts(fetchMock)).toHaveLength(1);
    });

    expect(updateCnpjPosts(fetchMock)).toHaveLength(0);
    const body = JSON.parse(
      String((storePosts(fetchMock)[0][1] as RequestInit).body),
    ) as Record<string, unknown>;
    expect(body.cnpj).toBe(VALID_ALPHA_CANONICAL);
  });
});
