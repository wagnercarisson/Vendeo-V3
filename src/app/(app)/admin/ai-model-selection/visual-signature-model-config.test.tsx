// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VisualSignatureConfigForm } from "./visual-signature-form";
import type { VisualSignatureModelConfigView } from "@/lib/ai/visual-signature-model-config-view";

const VIEW: VisualSignatureModelConfigView = {
  orchestrators: ["gpt-5.5", "gpt-6-luna"],
  presets: [
    { preset: "flare_low", label: "Flare · Low", model: "gpt-image-2.5-flare", quality: "low" },
    { preset: "flare_medium", label: "Flare · Medium", model: "gpt-image-2.5-flare", quality: "medium" },
    { preset: "sunburst_low", label: "Sunburst · Low", model: "gpt-image-2.5-sunburst", quality: "low" },
    { preset: "sunburst_medium", label: "Sunburst · Medium", model: "gpt-image-2.5-sunburst", quality: "medium" },
  ],
  combinations: ["flare_low", "flare_medium", "sunburst_low", "sunburst_medium"].flatMap((imagePreset) =>
    ["gpt-5.5", "gpt-6-luna"].map((orchestratorModel) => ({
      orchestratorModel: orchestratorModel as "gpt-5.5" | "gpt-6-luna",
      imagePreset: imagePreset as "flare_low" | "flare_medium" | "sunburst_low" | "sunburst_medium",
      model: imagePreset.startsWith("flare") ? "gpt-image-2.5-flare" : "gpt-image-2.5-sunburst",
      quality: imagePreset.endsWith("low") ? ("low" as const) : ("medium" as const),
    })),
  ),
  configured: true,
  current: {
    orchestratorModel: "gpt-6-luna",
    imagePreset: "sunburst_medium",
    imageModel: "gpt-image-2.5-sunburst",
    imageQuality: "medium",
    reasoningEffort: "low",
    configVersionId: "11111111-1111-4111-8111-111111111111",
    updatedBy: "22222222-2222-4222-8222-222222222222",
    updatedAt: "2026-10-22T12:00:00.000Z",
    reason: "decisão local",
    instanceIdentity: "127.0.0.1:57781",
  },
  inherited: {
    provider: "openai",
    model: "gpt-5.5",
    protocol: "responses",
    origin: "default",
    catalogStatus: "active",
    eligible: true,
  },
  pricingByPreset: {
    flare_low: { status: "complete", missingRates: [], historicalReferenceUsd: 0.036, pricingVersion: "p1" },
    flare_medium: { status: "partial", missingRates: ["image.imageTokenUsdPer1M"], historicalReferenceUsd: 0.044, pricingVersion: "p2" },
    sunburst_low: { status: "complete", missingRates: [], historicalReferenceUsd: 0.036, pricingVersion: "p3" },
    sunburst_medium: { status: "missing", missingRates: ["image.imageTokenUsdPer1M"], historicalReferenceUsd: 0.044, pricingVersion: null },
  },
  readError: null,
};

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("ui-operation-id") });
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ config: {} }) });
});

afterEach(() => vi.unstubAllGlobals());

describe("F47.1 — card da Assinatura Visual", () => {
  it("exibe dois orquestradores, quatro presets, oito combinações e a configuração vigente", () => {
    render(<VisualSignatureConfigForm view={VIEW} />);

    const orchestrators = screen.getByLabelText("Orquestrador da Assinatura Visual");
    const presets = screen.getByLabelText("Preset de imagem da Assinatura Visual");
    expect(orchestrators.querySelectorAll("option")).toHaveLength(2);
    expect(presets.querySelectorAll("option")).toHaveLength(4);
    expect(screen.getByText(/8 combinações/)).toBeInTheDocument();
    expect(screen.getByText(/Sunburst · Medium →/)).toBeInTheDocument();
    expect(screen.getByText("11111111-1111-4111-8111-111111111111")).toBeInTheDocument();
    expect(screen.getByText("decisão local")).toBeInTheDocument();
    expect(screen.getAllByText("low").length).toBeGreaterThan(0);
  });

  it("mostra a seleção herdada somente leitura", () => {
    render(<VisualSignatureConfigForm view={VIEW} />);

    expect(screen.getByRole("heading", { name: "Seleção herdada — somente leitura" })).toBeInTheDocument();
    expect(screen.getAllByText("gpt-5.5").length).toBeGreaterThan(0);
    expect(screen.getByText("responses")).toBeInTheDocument();
    expect(screen.getByText("Default do sistema")).toBeInTheDocument();
  });

  it("não grava nada no mount", () => {
    render(<VisualSignatureConfigForm view={VIEW} />);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("motivo é obrigatório e bloqueia save/reset sem chamar a API", () => {
    render(<VisualSignatureConfigForm view={VIEW} />);

    fireEvent.click(screen.getByRole("button", { name: "Salvar Assinatura Visual" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Motivo obrigatório");
    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Voltar à seleção herdada" }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("salva apenas no endpoint dedicado, sem enviar modelo/qualidade/reasoning", async () => {
    render(<VisualSignatureConfigForm view={VIEW} />);

    fireEvent.change(screen.getByLabelText("Orquestrador da Assinatura Visual"), {
      target: { value: "gpt-5.5" },
    });
    fireEvent.change(screen.getByLabelText("Preset de imagem da Assinatura Visual"), {
      target: { value: "flare_medium" },
    });
    fireEvent.change(screen.getByLabelText("Motivo da alteração da Assinatura Visual"), {
      target: { value: "ajuste local" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Assinatura Visual" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/visual-signature-model-config");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      orchestratorModel: "gpt-5.5",
      imagePreset: "flare_medium",
      reason: "ajuste local",
      operationId: "ui-operation-id",
    });
    expect(body).not.toHaveProperty("imageModel");
    expect(body).not.toHaveProperty("imageQuality");
    expect(body).not.toHaveProperty("reasoningEffort");
    expect(screen.getByText(/salva com auditoria/)).toBeInTheDocument();
  });

  it("reset usa DELETE com motivo e operationId", async () => {
    render(<VisualSignatureConfigForm view={VIEW} />);
    fireEvent.change(screen.getByLabelText("Motivo da alteração da Assinatura Visual"), {
      target: { value: "voltar ao herdado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Voltar à seleção herdada" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/visual-signature-model-config");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({
      reason: "voltar ao herdado",
      operationId: "ui-operation-id",
    });
  });

  it("aviso de pricing parcial/missing não bloqueia o salvamento", async () => {
    render(<VisualSignatureConfigForm view={VIEW} />);
    fireEvent.change(screen.getByLabelText("Preset de imagem da Assinatura Visual"), {
      target: { value: "sunburst_medium" },
    });
    expect(screen.getByText(/Pricing ausente/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Motivo da alteração da Assinatura Visual"), {
      target: { value: "manter mesmo sem pricing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Assinatura Visual" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  });
});
