// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const { mockBuildView, mockRefresh } = vi.hoisted(() => ({
  mockBuildView: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("@/lib/ai/nine-sixteen-expansion-model-config-view", () => ({
  buildNineSixteenExpansionConfigView: (...args: unknown[]) => mockBuildView(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import type {
  NineSixteenExpansionConfigView,
  NineSixteenExpansionCoverageStatus,
} from "@/lib/ai/nine-sixteen-expansion-model-config-view";
import { NineSixteenExpansionModelSection } from "./nine-sixteen-expansion-model-section";
import { NineSixteenExpansionModelForm } from "./nine-sixteen-expansion-model-form";

const CONFIG_VERSION_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "admin@vendeo.test";

const MODELS = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"];
const QUALITIES = ["low", "medium"];

function status(
  model: string,
  quality: string,
  coverage: NineSixteenExpansionCoverageStatus["pricingCoverage"],
): NineSixteenExpansionCoverageStatus {
  return {
    model: model as NineSixteenExpansionCoverageStatus["model"],
    quality: quality as NineSixteenExpansionCoverageStatus["quality"],
    pricingCoverage: coverage,
    missingComponents: coverage === "complete" ? [] : ["imageTokenUsdPer1M"],
  };
}

function coverageMap(
  overrides: Partial<Record<string, NineSixteenExpansionCoverageStatus["pricingCoverage"]>> = {},
): Record<string, NineSixteenExpansionCoverageStatus> {
  const map: Record<string, NineSixteenExpansionCoverageStatus> = {};
  for (const model of MODELS) {
    for (const quality of QUALITIES) {
      const key = `${model}|${quality}`;
      map[key] = status(model, quality, overrides[key] ?? "complete");
    }
  }
  return map;
}

const EMPTY_VIEW: NineSixteenExpansionConfigView = {
  eligibleModels: MODELS as NineSixteenExpansionConfigView["eligibleModels"],
  eligibleQualities: QUALITIES as NineSixteenExpansionConfigView["eligibleQualities"],
  state: "absent",
  configured: false,
  current: null,
  configVersionId: null,
  updatedBy: null,
  updatedAt: null,
  reason: null,
  targetCoverageByCombination: {},
  readError: null,
};

const CONFIGURED_VIEW: NineSixteenExpansionConfigView = {
  ...EMPTY_VIEW,
  state: "configured",
  configured: true,
  current: {
    model: "gpt-image-2.5-flare",
    quality: "medium",
    configVersionId: CONFIG_VERSION_ID,
    origin: "configured",
  },
  configVersionId: CONFIG_VERSION_ID,
  updatedBy: ADMIN_ID,
  updatedAt: "2026-11-17T12:00:00.000Z",
  reason: "Troca aprovada pela operação",
  targetCoverageByCombination: coverageMap(),
};

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  const randomUUID = vi
    .fn()
    .mockReturnValueOnce("ui-operation-id")
    .mockReturnValue("ui-operation-id-next");
  vi.stubGlobal("crypto", { randomUUID });
});

afterEach(() => vi.unstubAllGlobals());

async function renderSection(view: NineSixteenExpansionConfigView) {
  mockBuildView.mockResolvedValue(view);
  const ui = await NineSixteenExpansionModelSection();
  return render(ui);
}

describe("NineSixteenExpansionModelSection — estado vigente", () => {
  it("renderiza heading, eyebrow, banner de escopo e card com metadados exatos", async () => {
    await renderSection(CONFIGURED_VIEW);

    expect(
      screen.getByRole("heading", { name: "Imagem de campanhas — Expansão 9:16" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Operação de IA")).toBeInTheDocument();
    expect(screen.getByText("Escopo da expansão 9:16")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Esta configuração afeta somente novas operações de expansão 9:16. Não altera a base quadrada nem o fluxo Produto 1:1, e operações já iniciadas continuam usando a seleção congelada na abertura.",
      ),
    ).toBeInTheDocument();
    // Banner não é dismissível.
    expect(screen.queryByRole("button", { name: /fechar|dismiss/i })).not.toBeInTheDocument();

    expect(screen.getByText("gpt-image-2.5-flare · medium")).toBeInTheDocument();
    expect(screen.getByText("Configurada")).toBeInTheDocument();
    expect(screen.getByText(CONFIG_VERSION_ID)).toBeInTheDocument();
    expect(screen.getByText(ADMIN_ID)).toBeInTheDocument();
    expect(screen.getByText("Troca aprovada pela operação")).toBeInTheDocument();
    expect(mockBuildView).toHaveBeenCalledTimes(1);
  });

  it("formulário está presente na seção com a seleção vigente", async () => {
    await renderSection(CONFIGURED_VIEW);
    expect(
      screen.getByRole("heading", { name: "Configuração da expansão" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo")).toHaveValue("gpt-image-2.5-flare");
    expect(screen.getByLabelText("Qualidade")).toHaveValue("medium");
  });
});

describe("NineSixteenExpansionModelSection — ausência, invalidez e falha de leitura", () => {
  it("absent → EmptyState de configuração ausente e formulário visível", async () => {
    await renderSection(EMPTY_VIEW);

    expect(screen.getByText("Nenhuma configuração registrada")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Não há configuração de expansão 9:16 registrada. Enquanto ela estiver ausente, novas expansões não são iniciadas. Defina a combinação abaixo para regularizar.",
      ),
    ).toBeInTheDocument();
    // Nenhum valor de fallback exibido como vigente.
    expect(screen.queryByText("gpt-image-2.5-sunburst · low")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeInTheDocument();
  });

  it("invalid → EmptyState e formulário visível", async () => {
    await renderSection({ ...EMPTY_VIEW, state: "invalid" });

    expect(screen.getByText("Nenhuma configuração registrada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeInTheDocument();
  });

  it("read_failed → ErrorState próprio, nunca o empty state, com formulário visível", async () => {
    await renderSection({
      ...EMPTY_VIEW,
      state: "read_failed",
      readError: "nine_sixteen_expansion_config_read_failed:db_down",
    });

    expect(screen.getByText("Falha ao carregar a configuração")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Não foi possível ler a configuração da expansão 9:16. Isso não significa ausência de configuração. Recarregue a página.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma configuração registrada")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeInTheDocument();
  });
});

describe("NineSixteenExpansionModelSection — cobertura das quatro combinações", () => {
  it("renderiza quatro linhas com badge derivado apenas de pricingCoverage", async () => {
    await renderSection({
      ...CONFIGURED_VIEW,
      targetCoverageByCombination: coverageMap({
        "gpt-image-2.5-flare|low": "partial",
        "gpt-image-2.5-sunburst|low": "missing",
      }),
    });

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(4);

    const rowOf = (model: string, quality: string) =>
      rows.find(
        (row) => row.textContent?.includes(model) && row.textContent?.includes(`· ${quality}`),
      );

    expect(within(rowOf("gpt-image-2.5-flare", "medium")!).getByText("Completa")).toBeInTheDocument();
    expect(within(rowOf("gpt-image-2.5-flare", "low")!).getByText("Parcial")).toBeInTheDocument();
    expect(within(rowOf("gpt-image-2.5-sunburst", "low")!).getByText("Ausente")).toBeInTheDocument();
    expect(within(rowOf("gpt-image-2.5-sunburst", "medium")!).getByText("Completa")).toBeInTheDocument();
    expect(screen.queryByText(/image_unit_usd/)).not.toBeInTheDocument();
  });

  it("combinação sem chave no mapa não renderiza badge nem 'Completa'", async () => {
    const map = coverageMap();
    delete map["gpt-image-2.5-sunburst|low"];

    await renderSection({ ...CONFIGURED_VIEW, targetCoverageByCombination: map });

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    const row = rows.find(
      (item) =>
        item.textContent?.includes("gpt-image-2.5-sunburst") &&
        item.textContent?.includes("· low"),
    )!;
    expect(within(row).queryByText("Completa")).not.toBeInTheDocument();
    expect(within(row).queryByText("Parcial")).not.toBeInTheDocument();
    expect(within(row).queryByText("Ausente")).not.toBeInTheDocument();
  });
});

describe("NineSixteenExpansionModelForm — opções fechadas", () => {
  it("oferece exatamente Flare/Sunburst × low/medium", () => {
    render(<NineSixteenExpansionModelForm view={CONFIGURED_VIEW} />);

    const modelValues = within(screen.getByLabelText("Modelo"))
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);
    expect(modelValues).toEqual(["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"]);

    const qualityValues = within(screen.getByLabelText("Qualidade"))
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);
    expect(qualityValues).toEqual(["low", "medium"]);

    expect(screen.queryByText(/gpt-image-2$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fallback|Par principal|Par fallback/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset|restaurar|excluir|apagar/i })).not.toBeInTheDocument();
  });
});

describe("NineSixteenExpansionModelForm — prefill", () => {
  it("pré-preenche modelo e qualidade da seleção vigente e deixa o motivo vazio", () => {
    render(<NineSixteenExpansionModelForm view={CONFIGURED_VIEW} />);

    expect(screen.getByLabelText("Modelo")).toHaveValue("gpt-image-2.5-flare");
    expect(screen.getByLabelText("Qualidade")).toHaveValue("medium");
    expect(screen.getByLabelText("Motivo da alteração")).toHaveValue("");
  });

  it("sem configuração usa placeholders vazios sem pré-selecionar Sunburst low", () => {
    render(<NineSixteenExpansionModelForm view={EMPTY_VIEW} />);

    expect(screen.getByLabelText("Modelo")).toHaveValue("");
    expect(screen.getByLabelText("Qualidade")).toHaveValue("");
    const modelPlaceholder = within(screen.getByLabelText("Modelo")).getByRole("option", {
      name: "Selecione o modelo",
    });
    expect(modelPlaceholder).toBeDisabled();
    expect(modelPlaceholder).toHaveValue("");
    const qualityPlaceholder = within(screen.getByLabelText("Qualidade")).getByRole("option", {
      name: "Selecione a qualidade",
    });
    expect(qualityPlaceholder).toBeDisabled();
    expect(qualityPlaceholder).toHaveValue("");
  });
});

describe("NineSixteenExpansionModelForm — cobertura do rascunho", () => {
  it("recalcula o aviso ao trocar modelo e qualidade e usa a copy exata", () => {
    render(
      <NineSixteenExpansionModelForm
        view={{
          ...CONFIGURED_VIEW,
          targetCoverageByCombination: coverageMap({
            "gpt-image-2.5-sunburst|low": "missing",
            "gpt-image-2.5-sunburst|medium": "partial",
          }),
        }}
      />,
    );

    // Seleção vigente completa → sem aviso.
    expect(screen.queryByText(/Cobertura de pricing/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Modelo"), {
      target: { value: "gpt-image-2.5-sunburst" },
    });
    expect(screen.getByText(/Cobertura de pricing Parcial/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cobertura de pricing Parcial: faltam imageTokenUsdPer1M. Você pode salvar, mas novas expansões exigem cobertura completa para o modelo e a qualidade selecionados.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Qualidade"), { target: { value: "low" } });
    expect(screen.getByText(/Cobertura de pricing Ausente/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Qualidade"), { target: { value: "medium" } });
    expect(screen.getByText(/Cobertura de pricing Parcial/)).toBeInTheDocument();
  });

  it("cobertura desconhecida (chave ausente) não renderiza nada nem 'Completa'", () => {
    const map = coverageMap();
    delete map["gpt-image-2.5-flare|low"];

    render(
      <NineSixteenExpansionModelForm
        view={{ ...CONFIGURED_VIEW, targetCoverageByCombination: map }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Modelo"), {
      target: { value: "gpt-image-2.5-flare" },
    });
    fireEvent.change(screen.getByLabelText("Qualidade"), { target: { value: "low" } });

    expect(screen.queryByText(/Cobertura de pricing/)).not.toBeInTheDocument();
    expect(screen.queryByText("Completa")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configuração" })).toBeEnabled();
  });
});

describe("NineSixteenExpansionModelForm — validação e idempotência", () => {
  it("bloqueia sem motivo com 'Motivo obrigatório' e nenhum fetch", () => {
    render(<NineSixteenExpansionModelForm view={CONFIGURED_VIEW} />);

    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Motivo obrigatório");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("envia PUT com o corpo completo e mantém o operationId em retry, renovando após edição", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "falha" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ config: { success: true } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ config: { success: true } }) });

    render(<NineSixteenExpansionModelForm view={CONFIGURED_VIEW} />);
    const reason = screen.getByLabelText("Motivo da alteração");
    fireEvent.change(reason, { target: { value: "ajuste operacional" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/nine-sixteen-expansion-model-config");
    expect(init.method).toBe("PUT");
    const first = JSON.parse(String(init.body));
    expect(first).toEqual({
      model: "gpt-image-2.5-flare",
      quality: "medium",
      reason: "ajuste operacional",
      operationId: "ui-operation-id",
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const retry = JSON.parse(String(mockFetch.mock.calls[1][1].body));
    expect(retry.operationId).toBe(first.operationId);

    fireEvent.change(reason, { target: { value: "outro motivo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(mockFetch.mock.calls[2][1].body)).operationId).not.toBe(
      first.operationId,
    );
  });
});

describe("NineSixteenExpansionModelForm — feedback", () => {
  it("sucesso exibe a copy auditada com role=status e atualiza a página", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ config: { success: true } }) });

    render(<NineSixteenExpansionModelForm view={CONFIGURED_VIEW} />);
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), {
      target: { value: "configuração inicial" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));

    expect(
      await screen.findByText("Configuração da expansão salva com auditoria."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Configuração da expansão salva com auditoria.",
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("conflito exibe copy própria em role=alert e mantém o rascunho", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "operation_id_conflict" }),
    });

    render(<NineSixteenExpansionModelForm view={CONFIGURED_VIEW} />);
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), {
      target: { value: "rascunho preservado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta operação já foi registrada com outro conteúdo. Recarregue a página e tente novamente.",
    );
    expect(screen.getByLabelText("Motivo da alteração")).toHaveValue("rascunho preservado");
  });
});

describe("não-ativação (D7)", () => {
  it("não renderiza marcador ou rótulo de ativação", async () => {
    const { container } = await renderSection(CONFIGURED_VIEW);
    const text = container.textContent ?? "";

    expect(text).not.toContain("productionActive");
    expect(text).not.toMatch(/\bAtiva\b|\bAtivo\b|\bInativa\b/);
  });
});

describe("page.tsx — composição", () => {
  it("monta a seção da expansão depois do 1:1, mantém force-dynamic e não lê a view", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/app/(app)/admin/ai-model-selection/page.tsx"),
      "utf8",
    );
    const oneToOne = source.indexOf("<ProductOneToOneImageModelSection />");
    const expansion = source.indexOf("<NineSixteenExpansionModelSection />");

    expect(oneToOne).toBeGreaterThan(-1);
    expect(expansion).toBeGreaterThan(oneToOne);
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).not.toContain("buildNineSixteenExpansionConfigView");
  });
});
