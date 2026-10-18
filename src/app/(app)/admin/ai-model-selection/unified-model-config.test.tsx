// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODEL_REGISTRY, LEGACY_SELECTION_CAPABILITIES } from "@/lib/ai/model-registry";
import type { AiModelSelectionViewModel } from "@/lib/ai/ai-model-selection-view";
import type { ImageModelPairConfigView } from "@/lib/ai/image-model-pair-config-view";
import { AiModelSelectionForm } from "./form";
import { ImageModelPairConfigForm, ImageModelPairScopeBanner } from "../image-model-pair/form";

const target = (provider: "openai" | "gemini", model: string, protocol: "chat-completions" | "responses" | "images" | "gemini") => ({
  provider,
  model,
  protocol,
  catalogStatus: "active" as const,
});

const SELECTION_VIEW = {
  ...MODEL_REGISTRY,
  catalog: [],
  selections: [],
  defaults: MODEL_REGISTRY,
  capabilities: LEGACY_SELECTION_CAPABILITIES.map((capability) => {
    const config = MODEL_REGISTRY[capability];
    return {
      capability,
      segment: config.segment,
      source: "default" as const,
      current: { primary: target(config.primary.provider, config.primary.model, config.primary.protocol), fallback: null },
      default: { primary: target(config.primary.provider, config.primary.model, config.primary.protocol), fallback: null },
      configured: null,
      selection: null,
    };
  }),
} as unknown as AiModelSelectionViewModel;

const PAIR_VIEW: ImageModelPairConfigView = {
  eligibleModels: ["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"],
  eligibleQualities: ["low", "medium"],
  configured: true,
  current: {
    primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
    fallback: { model: "gpt-image-2", quality: "medium" },
  },
  eligible: true,
  origin: "human_decision",
  configVersionId: "11111111-2222-3333-4444-555555555555",
  updatedBy: "admin@vendeo.test",
  updatedAt: "2026-10-06T12:00:00.000Z",
  reason: "Definição inicial aprovada",
  productionActive: false,
  pricingCoverage: "complete",
  pricing: null,
  targetCoverageByPair: {},
  readError: null,
};

function UnifiedComposition() {
  return (
    <div>
      <AiModelSelectionForm view={SELECTION_VIEW} />
      <section aria-labelledby="product-1-1-image-heading">
        <h2 id="product-1-1-image-heading">Imagem de campanhas — Produto 1:1</h2>
        <ImageModelPairScopeBanner />
        <ImageModelPairConfigForm view={PAIR_VIEW} />
      </section>
    </div>
  );
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("ui-operation-id") });
});

afterEach(() => vi.unstubAllGlobals());

describe("Página unificada de modelos — composição", () => {
  it("exibe as capacidades legadas e a seção Produto 1:1 na mesma página", () => {
    render(<UnifiedComposition />);
    expect(screen.getByRole("heading", { name: "Imagem de campanhas — Produto 1:1" })).toBeInTheDocument();
    expect(screen.getByText("campaign_copy")).toBeInTheDocument();
    expect(screen.getByText("campaign_image")).toBeInTheDocument();
    expect(screen.getByText(/Esta configuração define os modelos do fluxo Produto 1:1/)).toBeInTheDocument();
  });

  it("não grava nada automaticamente ao carregar (nenhuma seleção implícita)", () => {
    render(<UnifiedComposition />);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("salvar uma seção não modifica a outra (endpoints independentes)", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<UnifiedComposition />);

    const pairSection = screen.getByRole("region", { name: "Configuração do par" });
    fireEvent.change(within(pairSection).getByLabelText("Motivo da alteração"), {
      target: { value: "Ajuste do par Produto 1:1" },
    });
    fireEvent.click(within(pairSection).getByRole("button", { name: "Salvar configuração" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch.mock.calls[0][0]).toBe("/api/admin/image-model-pair");

    const copyCard = screen.getByText("campaign_copy").closest("article")!;
    fireEvent.change(within(copyCard).getByLabelText("Motivo da alteração"), {
      target: { value: "Ajuste de copy" },
    });
    fireEvent.click(within(copyCard).getByRole("button", { name: "Salvar seleção" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(mockFetch.mock.calls[1][0]).toBe("/api/admin/ai-model-selection");
    // O salvamento da seção de imagem não repetiu o endpoint do par.
    expect(mockFetch.mock.calls.filter((call) => call[0] === "/api/admin/image-model-pair")).toHaveLength(1);
  });

  it("mantém o motivo obrigatório na seção Produto 1:1 sem acionar a rede", () => {
    render(<UnifiedComposition />);
    const pairSection = screen.getByRole("region", { name: "Configuração do par" });
    fireEvent.click(within(pairSection).getByRole("button", { name: "Salvar configuração" }));
    expect(within(pairSection).getByRole("alert")).toHaveTextContent("Motivo obrigatório");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("Página unificada de modelos — rota legada e navegação", () => {
  it("mantém /admin/image-model-pair como redirecionamento para a seção Produto 1:1", () => {
    const redirectSource = readFileSync(
      path.resolve(process.cwd(), "src/app/(app)/admin/image-model-pair/page.tsx"),
      "utf8",
    );
    expect(redirectSource).toMatch(/redirect\("\/admin\/ai-model-selection#produto-1-1-imagem"\)/);
  });

  it("a seção Produto 1:1 tem âncora de destino e reutiliza o formulário do par", () => {
    const sectionSource = readFileSync(
      path.resolve(process.cwd(), "src/app/(app)/admin/ai-model-selection/image-model-pair-section.tsx"),
      "utf8",
    );
    expect(sectionSource).toMatch(/id="produto-1-1-imagem"/);
    expect(sectionSource).toMatch(/ImageModelPairConfigForm/);
    expect(sectionSource).toMatch(/buildImageModelPairConfigView/);
  });

  it("a navegação administrativa tem uma única entrada de modelos", () => {
    const layoutSource = readFileSync(
      path.resolve(process.cwd(), "src/app/(app)/admin/layout.tsx"),
      "utf8",
    );
    expect(layoutSource).toMatch(/href="\/admin\/ai-model-selection"/);
    expect(layoutSource).not.toMatch(/href="\/admin\/image-model-pair"/);
  });
});
