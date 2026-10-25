// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VisualSignatureAdminConfigView } from "@/lib/visual-signature/admin-config-view";
import type { VisualSignatureGenerationConfig } from "@/lib/visual-signature/model-config";
import { VisualSignatureModelCard } from "./visual-signature-model-card";

const CONFIG_VERSION_ID = "11111111-1111-4111-8111-111111111111";

function dedicatedConfig(
  overrides: Partial<VisualSignatureGenerationConfig> = {},
): VisualSignatureGenerationConfig {
  return {
    orchestratorModel: "gpt-5.5",
    imageModel: "gpt-image-2.5-flare",
    imageQuality: "low",
    imagePreset: "flare_low",
    configVersionId: CONFIG_VERSION_ID,
    ...overrides,
  };
}

const DEDICATED: VisualSignatureAdminConfigView = {
  status: "dedicated",
  config: dedicatedConfig(),
};

const LEGACY: VisualSignatureAdminConfigView = { status: "legacy" };
const ERROR: VisualSignatureAdminConfigView = {
  status: "error",
  code: "read_failed",
};

const mockFetch = vi.fn();

function renderCard(
  view: VisualSignatureAdminConfigView,
  options: { inherited?: string; source?: "selection" | "default" } = {},
) {
  return render(
    <VisualSignatureModelCard
      view={view}
      inheritedOrchestratorModel={options.inherited ?? "gpt-5.5"}
      inheritedOrchestratorSource={options.source ?? "default"}
    />,
  );
}

function currentBlock() {
  return screen.getByRole("region", { name: "Configuração vigente" });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", {
    randomUUID: vi
      .fn()
      .mockReturnValueOnce("op-1")
      .mockReturnValueOnce("op-2")
      .mockReturnValue("op-next"),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("VisualSignatureModelCard — configuração vigente", () => {
  it("dedicated mostra nomes amigáveis e title com o ID completo", () => {
    renderCard(DEDICATED);
    const block = currentBlock();
    expect(within(block).getByText("GPT-5.5")).toHaveAttribute("title", "gpt-5.5");
    expect(within(block).getByText("Flare")).toHaveAttribute("title", "gpt-image-2.5-flare");
    expect(within(block).getByText("Low")).toHaveAttribute("title", "low");
  });

  it("legacy mostra orquestrador herdado, origem, imagem padrão e qualidade auto", () => {
    renderCard(LEGACY, { inherited: "gpt-6-luna", source: "selection" });
    const block = currentBlock();
    expect(within(block).getByText("GPT-6-Luna")).toHaveAttribute("title", "gpt-6-luna");
    expect(within(block).getByText("Seleção persistida")).toBeInTheDocument();
    expect(within(block).getByText("Padrão da API")).toBeInTheDocument();
    expect(within(block).getByText("auto")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remover configuração dedicada" }),
    ).toBeDisabled();
  });

  it("legacy sem selection mostra Default do sistema", () => {
    renderCard(LEGACY, { inherited: "gpt-5.5", source: "default" });
    expect(within(currentBlock()).getByText("Default do sistema")).toBeInTheDocument();
  });

  it("error mostra alerta explícito, não textos de legado e reset desabilitado", () => {
    renderCard(ERROR);
    expect(within(currentBlock()).getByRole("alert")).toHaveTextContent(
      "Não foi possível ler a configuração dedicada. O estado atual não é exibido como ausência.",
    );
    expect(within(currentBlock()).queryByText("Padrão da API")).not.toBeInTheDocument();
    expect(within(currentBlock()).queryByText("auto")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remover configuração dedicada" }),
    ).toBeDisabled();
  });

  it("alterar o formulário NÃO altera a vigente antes de salvar", () => {
    renderCard(DEDICATED);
    fireEvent.change(screen.getByLabelText("Orquestrador"), {
      target: { value: "gpt-6-luna" },
    });
    fireEvent.change(screen.getByLabelText("Modelo de imagem"), {
      target: { value: "gpt-image-2.5-sunburst" },
    });
    fireEvent.change(screen.getByLabelText("Qualidade"), {
      target: { value: "medium" },
    });
    const block = currentBlock();
    expect(within(block).getByText("GPT-5.5")).toBeInTheDocument();
    expect(within(block).queryByText("GPT-6-Luna")).not.toBeInTheDocument();
    expect(within(block).getByText("Flare")).toBeInTheDocument();
    expect(within(block).getByText("Low")).toBeInTheDocument();
  });
});

describe("VisualSignatureModelCard — save", () => {
  it("exige motivo sem fetch", () => {
    renderCard(DEDICATED);
    fireEvent.click(screen.getByRole("button", { name: "Salvar conjunto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Motivo obrigatório");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("envia SOMENTE o contrato permitido e valores completos", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        saved: true,
        confirmed: true,
        view: DEDICATED,
      }),
    });
    renderCard(DEDICATED);
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), {
      target: { value: "ajuste" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conjunto" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    expect(mockFetch.mock.calls[0][0]).toBe("/api/admin/visual-signature-model-config");
    expect(mockFetch.mock.calls[0][1].method).toBe("PUT");
    const body = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    expect(Object.keys(body).sort()).toEqual(
      ["imageModel", "imageQuality", "operationId", "orchestratorModel", "reason"].sort(),
    );
    expect(body).toMatchObject({
      orchestratorModel: "gpt-5.5",
      imageModel: "gpt-image-2.5-flare",
      imageQuality: "low",
      reason: "ajuste",
      operationId: "op-1",
    });
  });

  it.each([
    ["gpt-5.5", "gpt-image-2.5-flare", "low"],
    ["gpt-5.5", "gpt-image-2.5-sunburst", "medium"],
    ["gpt-6-luna", "gpt-image-2.5-flare", "medium"],
    ["gpt-6-luna", "gpt-image-2.5-sunburst", "low"],
  ] as const)("envia a combinação %s/%s/%s", async (orchestratorModel, imageModel, imageQuality) => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ saved: true, confirmed: false, warning: "save_confirmation_failed" }),
    });
    renderCard(DEDICATED);
    fireEvent.change(screen.getByLabelText("Orquestrador"), { target: { value: orchestratorModel } });
    fireEvent.change(screen.getByLabelText("Modelo de imagem"), { target: { value: imageModel } });
    fireEvent.change(screen.getByLabelText("Qualidade"), { target: { value: imageQuality } });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "combo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conjunto" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    expect(body).toMatchObject({ orchestratorModel, imageModel, imageQuality });
  });

  it("confirmado promove a vigente, sincroniza o draft e limpa o motivo", async () => {
    const saved: VisualSignatureAdminConfigView = {
      status: "dedicated",
      config: dedicatedConfig({
        orchestratorModel: "gpt-6-luna",
        imageModel: "gpt-image-2.5-sunburst",
        imageQuality: "medium",
        imagePreset: "sunburst_medium",
        configVersionId: "22222222-2222-4222-8222-222222222222",
      }),
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ saved: true, confirmed: true, view: saved }),
    });
    renderCard(DEDICATED);
    fireEvent.change(screen.getByLabelText("Orquestrador"), { target: { value: "gpt-6-luna" } });
    fireEvent.change(screen.getByLabelText("Modelo de imagem"), {
      target: { value: "gpt-image-2.5-sunburst" },
    });
    fireEvent.change(screen.getByLabelText("Qualidade"), { target: { value: "medium" } });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "promover" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conjunto" }));

    await waitFor(() =>
      expect(within(currentBlock()).getByText("GPT-6-Luna")).toBeInTheDocument(),
    );
    expect(within(currentBlock()).getByText("Sunburst")).toBeInTheDocument();
    expect(within(currentBlock()).getByText("Medium")).toBeInTheDocument();
    expect(screen.getByLabelText("Motivo da alteração")).toHaveValue("");
    expect(screen.queryByText(/Salvo, mas não foi possível confirmar/)).not.toBeInTheDocument();
  });

  it("confirmed:false mostra aviso âmbar e NÃO promove o draft a vigente", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        saved: true,
        confirmed: false,
        warning: "save_confirmation_mismatch",
        view: LEGACY,
      }),
    });
    renderCard(DEDICATED);
    fireEvent.change(screen.getByLabelText("Orquestrador"), { target: { value: "gpt-6-luna" } });
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conjunto" }));

    expect(
      await screen.findByText("Salvo, mas não foi possível confirmar a exibição. Recarregue a página."),
    ).toBeInTheDocument();
    const block = currentBlock();
    expect(within(block).getByText("GPT-5.5")).toBeInTheDocument();
    expect(within(block).queryByText("GPT-6-Luna")).not.toBeInTheDocument();
  });

  it("erro allowlisted não ecoa mensagem crua", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "unexpected_error" }),
    });
    renderCard(DEDICATED);
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conjunto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir a operação.",
    );
  });

  it("retry mantém o mesmo operationId; editar regenera", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ saved: true, confirmed: false, warning: "save_confirmation_failed" }),
    });
    renderCard(DEDICATED);
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "retry" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conjunto" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Salvar conjunto" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    const first = JSON.parse(String(mockFetch.mock.calls[0][1].body)).operationId;
    const retry = JSON.parse(String(mockFetch.mock.calls[1][1].body)).operationId;
    expect(retry).toBe(first);

    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conjunto" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(mockFetch.mock.calls[2][1].body)).operationId).not.toBe(first);
  });
});

describe("VisualSignatureModelCard — reset", () => {
  it("exige motivo sem fetch", () => {
    renderCard(DEDICATED);
    fireEvent.click(screen.getByRole("button", { name: "Remover configuração dedicada" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Motivo obrigatório");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("envia SOMENTE { expectedConfigVersionId, reason, operationId }", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ removed: true, confirmed: true, view: { status: "legacy" } }),
    });
    renderCard(DEDICATED);
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "remover" } });
    fireEvent.click(screen.getByRole("button", { name: "Remover configuração dedicada" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
    const body = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    expect(Object.keys(body).sort()).toEqual(
      ["expectedConfigVersionId", "operationId", "reason"].sort(),
    );
    expect(body).toMatchObject({
      expectedConfigVersionId: CONFIG_VERSION_ID,
      reason: "remover",
      operationId: "op-1",
    });
  });

  it("confirmado volta a vigente para legacy e draft padrão", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ removed: true, confirmed: true, view: { status: "legacy" } }),
    });
    renderCard(DEDICATED);
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "remover" } });
    fireEvent.click(screen.getByRole("button", { name: "Remover configuração dedicada" }));

    await waitFor(() =>
      expect(within(currentBlock()).getByText("Padrão da API")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Remover configuração dedicada" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Motivo da alteração")).toHaveValue("");
  });

  it("não confirmado mostra aviso e preserva a vigente dedicada", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        removed: true,
        confirmed: false,
        warning: "reset_confirmation_mismatch",
        view: { status: "dedicated", config: dedicatedConfig() },
      }),
    });
    renderCard(DEDICATED);
    fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "remover" } });
    fireEvent.click(screen.getByRole("button", { name: "Remover configuração dedicada" }));

    expect(
      await screen.findByText("Removido, mas não foi possível confirmar a exibição. Recarregue a página."),
    ).toBeInTheDocument();
    expect(within(currentBlock()).getByText("GPT-5.5")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remover configuração dedicada" }),
    ).toBeDisabled();
  });
});
