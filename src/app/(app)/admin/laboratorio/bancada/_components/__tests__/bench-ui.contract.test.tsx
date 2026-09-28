// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F48.2.2 — suíte de contrato da UI da bancada (`48-2-2-07`).
 *
 * Trava o contrato visual da bancada: navegação interna, estado de ambiente
 * desabilitado sem acesso a dados, fluxo mínimo (loja → branding → produto/oferta
 * → upload em `draft` → prompt → formato/modelo/qualidade → estimativa →
 * confirmação → execução → resultado/download → evidências), a distinção entre
 * usage/calculado/estimado e a **ausência** de comparação lado a lado, votação,
 * emojis e promessa de cancelamento de geração ativa.
 *
 * `fetch` é sempre mockado e nenhum provider é chamado.
 */

const {
  mockGetLabEnvironment,
  mockListBenchTestStores,
  mockListBenchPresets,
} = vi.hoisted(() => ({
  mockGetLabEnvironment: vi.fn(),
  mockListBenchTestStores: vi.fn(),
  mockListBenchPresets: vi.fn(),
}));

vi.mock("@/lib/lab/environment-guard", () => ({
  getLabEnvironment: () => mockGetLabEnvironment(),
  assertLabEnvironment: vi.fn(),
  labEnvironmentDeniedBody: (reason: string) => ({
    error: "environment_blocked",
    reason,
  }),
  LabEnvironmentError: class LabEnvironmentError extends Error {},
}));

vi.mock("@/lib/lab/bench/domain/store-manifest", () => ({
  listBenchTestStores: (...args: unknown[]) => mockListBenchTestStores(...args),
}));

vi.mock("@/lib/lab/bench/domain/preset-registry", () => ({
  listBenchPresets: (...args: unknown[]) => mockListBenchPresets(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import BancadaPage from "@/app/(app)/admin/laboratorio/bancada/page";
import LaboratorioLayout from "@/app/(app)/admin/laboratorio/layout";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ENABLED_ENV = {
  enabled: true,
  supabaseHost: "localhost",
  local: true,
  reason: "ok",
};
const DISABLED_ENV = {
  enabled: false,
  supabaseHost: null,
  local: false,
  reason: "disabled_flag",
};

const STORE_A = {
  id: "11111111-1111-4111-8111-111111111111",
  label: "Loja de teste A",
  name: "Empório Aurora",
  segment: "mercados-mercearias",
};

const PRESET_ENABLED = {
  id: "gpt-image-2-low",
  label: "GPT Image 2 · low",
  capability: "campaign_image",
  provider: "openai",
  model: "gpt-image-2",
  protocol: "images",
  quality: "low",
  size: "1024x1024",
  enabled: true,
};

const PRESET_DISABLED = {
  id: "gpt-image-2-responses",
  label: "GPT Image 2 · responses (desabilitado)",
  capability: "campaign_image",
  provider: "openai",
  model: "gpt-image-2",
  protocol: "responses",
  quality: "low",
  size: "1024x1024",
  enabled: false,
  reason: "protocolo_nao_confirmado",
};

const PRESETS = [PRESET_ENABLED, PRESET_DISABLED];

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn().mockReturnValue("00000000-0000-4000-8000-0000000000aa"),
  });
  mockGetLabEnvironment.mockReturnValue(ENABLED_ENV);
  mockListBenchTestStores.mockResolvedValue([STORE_A]);
  mockListBenchPresets.mockReturnValue(PRESETS);
});

afterEach(() => vi.unstubAllGlobals());

// ─── 1. Página, navegação interna e estado de ambiente desabilitado ──────────

describe("contrato de UI — página da bancada e navegação interna", () => {
  it("mostra o aviso de indisponibilidade com o motivo e não lê lojas/presets quando o ambiente está bloqueado", async () => {
    mockGetLabEnvironment.mockReturnValue(DISABLED_ENV);

    render(await BancadaPage());

    expect(
      screen.getByText("Laboratório desabilitado neste ambiente"),
    ).toBeInTheDocument();
    expect(screen.getByText("disabled_flag")).toBeInTheDocument();
    expect(screen.getByText("A flag VENDEO_LAB_ENABLED não está ativa")).toBeInTheDocument();

    expect(mockListBenchTestStores).not.toHaveBeenCalled();
    expect(mockListBenchPresets).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("expõe 'Bancada' na navegação interna do laboratório", () => {
    render(
      <LaboratorioLayout>
        <div>conteúdo</div>
      </LaboratorioLayout>,
    );

    const nav = screen.getByRole("navigation", {
      name: "Navegação do laboratório",
    });
    const link = within(nav).getByRole("link", { name: "Bancada" });
    expect(link).toHaveAttribute("href", "/admin/laboratorio/bancada");
  });

  it("renderiza o seletor de loja de teste com as lojas do manifesto", async () => {
    render(await BancadaPage());

    expect(screen.getByTestId("bench-store-selector")).toBeInTheDocument();
    expect(screen.getByLabelText("Loja de teste")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Loja de teste A/ })).toBeInTheDocument();
  });
});
