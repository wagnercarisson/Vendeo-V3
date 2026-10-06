// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageModelPairConfigView } from "@/lib/ai/image-model-pair-config-view";
import type {
  ImagePairCapacityPricingStatus,
  ImagePairPricingCoverage,
  ImagePairTargetPricingStatus,
} from "@/lib/ai-cost/types";
import { ImageModelPairConfigForm, ImageModelPairInactiveBanner } from "../form";

const ELIGIBLE_MODELS = ["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"];
const ELIGIBLE_QUALITIES = ["low", "medium"];

function pairStatus(model: string, quality: string, coverage: ImagePairPricingCoverage) {
  const available = coverage === "complete";
  return {
    model,
    quality,
    components: [
      {
        component: "image_unit" as const,
        provider: "openai",
        model,
        quality,
        available,
        source: (available ? "table" : "missing") as "table" | "missing",
      },
    ],
    missingComponents: available ? [] : (["image_unit"] as ("image_unit")[]),
    pricingCoverage: coverage,
  };
}

function pricingStatus(coverage: ImagePairPricingCoverage): ImagePairCapacityPricingStatus {
  return {
    primary: pairStatus("gpt-image-2.5-sunburst", "medium", coverage),
    fallback: pairStatus("gpt-image-2", "medium", coverage),
    missingComponents: coverage === "complete" ? [] : ["image_unit"],
    pricingCoverage: coverage,
  };
}

/**
 * Mapa de cobertura por par elegível (6 combinações). Por padrão todos os pares
 * estão `complete`; `overrides` ajusta pares específicos por chave `${model}|${quality}`.
 */
function targetCoverageMap(
  overrides: Partial<Record<string, ImagePairPricingCoverage>> = {},
): Record<string, ImagePairTargetPricingStatus> {
  const map: Record<string, ImagePairTargetPricingStatus> = {};
  for (const model of ELIGIBLE_MODELS) {
    for (const quality of ELIGIBLE_QUALITIES) {
      const key = `${model}|${quality}`;
      map[key] = pairStatus(model, quality, overrides[key] ?? "complete");
    }
  }
  return map;
}

const EMPTY_VIEW: ImageModelPairConfigView = {
  eligibleModels: ELIGIBLE_MODELS,
  eligibleQualities: ELIGIBLE_QUALITIES,
  configured: false,
  current: null,
  eligible: false,
  origin: null,
  configVersionId: null,
  updatedBy: null,
  updatedAt: null,
  reason: null,
  productionActive: false,
  pricingCoverage: null,
  pricing: null,
  targetCoverageByPair: {},
  readError: null,
};

const CONFIGURED_VIEW: ImageModelPairConfigView = {
  ...EMPTY_VIEW,
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
  pricingCoverage: "complete",
  pricing: pricingStatus("complete"),
  targetCoverageByPair: targetCoverageMap(),
};

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  const randomUUID = vi.fn().mockReturnValueOnce("ui-operation-id").mockReturnValue("ui-operation-id-next");
  vi.stubGlobal("crypto", { randomUUID });
});

afterEach(() => vi.unstubAllGlobals());

describe("ImageModelPairConfigForm", () => {
  it("mostra o aviso permanente de não-ativa no estado vazio", () => {
    render(
      <>
        <ImageModelPairInactiveBanner />
        <ImageModelPairConfigForm view={EMPTY_VIEW} />
      </>,
    );
    expect(screen.getByText("Esta configuração NÃO está ativa em produção.")).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma campanha usa estes modelos/)).toBeInTheDocument();
  });

  it("restringe as opções ao catálogo elegível (3 modelos x low/medium)", () => {
    render(<ImageModelPairConfigForm view={EMPTY_VIEW} />);
    const primary = screen.getByRole("group", { name: "Par principal" });
    const primaryModels = within(within(primary).getByLabelText("Modelo")).getAllByRole("option");
    expect(primaryModels.map((option) => option.textContent)).toEqual(ELIGIBLE_MODELS);
    const primaryQualities = within(within(primary).getByLabelText("Qualidade")).getAllByRole("option");
    expect(primaryQualities.map((option) => option.textContent)).toEqual(ELIGIBLE_QUALITIES);

    const fallback = screen.getByRole("group", { name: "Par fallback" });
    const fallbackModels = within(within(fallback).getByLabelText("Modelo")).getAllByRole("option");
    expect(fallbackModels.map((option) => option.textContent)).toEqual(ELIGIBLE_MODELS);
    const fallbackQualities = within(within(fallback).getByLabelText("Qualidade")).getAllByRole("option");
    expect(fallbackQualities.map((option) => option.textContent)).toEqual(ELIGIBLE_QUALITIES);
  });

  it("bloqueia o envio com motivo vazio usando 'Motivo obrigatório'", () => {
    render(<ImageModelPairConfigForm view={EMPTY_VIEW} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Motivo obrigatório");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("envia PUT com operationId e mantém o aviso de não-ativa após o sucesso", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ config: { success: true } }) });
    render(
      <>
        <ImageModelPairInactiveBanner />
        <ImageModelPairConfigForm view={EMPTY_VIEW} />
      </>,
    );
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), {
      target: { value: "Configuração inicial" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/image-model-pair");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(String(init.body));
    expect(body.operationId).toBe("ui-operation-id");
    expect(body.reason).toBe("Configuração inicial");
    expect(body.primaryModel).toBe("gpt-image-2.5-sunburst");
    expect(body.fallbackModel).toBe("gpt-image-2");

    expect(await screen.findByText("Configuração salva com auditoria.")).toBeInTheDocument();
    expect(screen.getByText("Esta configuração NÃO está ativa em produção.")).toBeInTheDocument();
  });

  it("reutiliza o operationId no retry e o renova ao editar", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "falha" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ config: { success: true } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ config: { success: true } }) });
    render(<ImageModelPairConfigForm view={EMPTY_VIEW} />);
    const reason = screen.getByLabelText("Motivo da alteração");
    fireEvent.change(reason, { target: { value: "retry" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    const first = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    const retry = JSON.parse(String(mockFetch.mock.calls[1][1].body));
    expect(retry.operationId).toBe(first.operationId);

    fireEvent.change(reason, { target: { value: "novo payload" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(mockFetch.mock.calls[2][1].body)).operationId).not.toBe(first.operationId);
  });

  it("exibe a cobertura parcial do par em rascunho como aviso âmbar sem desabilitar o Salvar", () => {
    render(
      <ImageModelPairConfigForm
        view={{
          ...CONFIGURED_VIEW,
          targetCoverageByPair: targetCoverageMap({
            "gpt-image-2.5-sunburst|medium": "partial",
            "gpt-image-2|medium": "partial",
          }),
        }}
      />,
    );
    expect(screen.getByText(/Cobertura de pricing Parcial/)).toBeInTheDocument();
    expect(screen.getByText(/faltam image_unit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeEnabled();
  });

  it("exibe a cobertura ausente do par em rascunho como aviso âmbar sem desabilitar o Salvar", () => {
    render(
      <ImageModelPairConfigForm
        view={{
          ...CONFIGURED_VIEW,
          targetCoverageByPair: targetCoverageMap({
            "gpt-image-2.5-sunburst|medium": "missing",
            "gpt-image-2|medium": "missing",
          }),
        }}
      />,
    );
    expect(screen.getByText(/Cobertura de pricing Ausente/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeEnabled();
  });

  it("atualiza o aviso de cobertura conforme o par em rascunho muda nos seletores", () => {
    render(
      <ImageModelPairConfigForm
        view={{
          ...CONFIGURED_VIEW,
          targetCoverageByPair: targetCoverageMap({ "gpt-image-2.5-flare|low": "missing" }),
        }}
      />,
    );

    // Par inicial (vigente) completo → sem aviso; Salvar habilitado (warn-not-block).
    expect(screen.queryByText(/Cobertura de pricing/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeEnabled();

    const primary = screen.getByRole("group", { name: "Par principal" });

    // Muda o par principal para um par sem cobertura → o aviso segue o rascunho.
    fireEvent.change(within(primary).getByLabelText("Modelo"), {
      target: { value: "gpt-image-2.5-flare" },
    });
    fireEvent.change(within(primary).getByLabelText("Qualidade"), { target: { value: "low" } });
    expect(screen.getByText(/Cobertura de pricing Parcial/)).toBeInTheDocument();
    expect(screen.getByText(/faltam image_unit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeEnabled();

    // Volta a um par completo → o aviso desaparece; Salvar continua habilitado.
    fireEvent.change(within(primary).getByLabelText("Modelo"), {
      target: { value: "gpt-image-2.5-sunburst" },
    });
    fireEvent.change(within(primary).getByLabelText("Qualidade"), { target: { value: "medium" } });
    expect(screen.queryByText(/Cobertura de pricing/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeEnabled();
  });

  it("mostra erro inline em role=alert com a mensagem de par fora do catálogo", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "model_not_in_catalog" }),
    });
    render(<ImageModelPairConfigForm view={EMPTY_VIEW} />);
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), {
      target: { value: "tentativa inválida" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Modelo ou qualidade fora do catálogo elegível");
  });

  it("não renderiza controles destrutivos ou de reset", () => {
    render(<ImageModelPairConfigForm view={CONFIGURED_VIEW} />);
    expect(screen.queryByText(/Restaurar padrão/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset|restaurar|excluir|apagar/i })).not.toBeInTheDocument();
  });
});
