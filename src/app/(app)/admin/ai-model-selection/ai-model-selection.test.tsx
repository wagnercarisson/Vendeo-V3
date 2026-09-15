// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODEL_REGISTRY } from "@/lib/ai/model-registry";
import { ALL_CAPABILITIES } from "@/lib/ai/model-registry";
import type { AiModelSelectionViewModel } from "@/lib/ai/ai-model-selection-view";
import type { CapacityPricingStatus } from "@/lib/ai-cost/model-capability-pricing";
import { AiModelSelectionForm } from "./form";

const target = (provider: "openai" | "gemini", model: string, protocol: "chat-completions" | "responses" | "images" | "gemini", catalogStatus: "active" | "deprecated" | "missing" = "active") => ({ provider, model, protocol, catalogStatus });

const VIEW = {
  catalog: [
    { id: "copy-primary", capability: "campaign_copy", segment: "text", provider: "openai", model: "gpt-4o", protocol: "chat-completions", label: "GPT-4o", status: "active", source_note: null, validated_at: null, created_at: "", updated_at: "" },
    { id: "copy-fallback", capability: "campaign_copy", segment: "text", provider: "gemini", model: "gemini-3.1-flash-lite", protocol: "gemini", label: "Gemini", status: "active", source_note: null, validated_at: null, created_at: "", updated_at: "" },
    { id: "edit-primary", capability: "campaign_image_edit", segment: "image", provider: "openai", model: "gpt-image-2", protocol: "images", label: "GPT Image", status: "active", source_note: null, validated_at: null, created_at: "", updated_at: "" },
  ],
  selections: [],
  defaults: MODEL_REGISTRY,
  capabilities: [
    { capability: "campaign_copy", segment: "text", source: "default", current: { primary: target("openai", "gpt-4o", "chat-completions"), fallback: target("gemini", "gemini-3.1-flash-lite", "gemini") }, default: { primary: target("openai", "gpt-4o", "chat-completions"), fallback: target("gemini", "gemini-3.1-flash-lite", "gemini") }, configured: null, selection: null },
    { capability: "campaign_image", segment: "image", source: "default", current: { primary: target("openai", "gpt-5.5", "responses"), fallback: null }, default: { primary: target("openai", "gpt-5.5", "responses"), fallback: null }, configured: null, selection: null },
    { capability: "campaign_image_edit", segment: "image", source: "default", current: { primary: target("openai", "gpt-image-2", "images"), fallback: null }, default: { primary: target("openai", "gpt-image-2", "images"), fallback: null }, configured: null, selection: null },
  ],
} as AiModelSelectionViewModel;

const mockFetch = vi.fn();
const FULL_VIEW = {
  ...VIEW,
  capabilities: ALL_CAPABILITIES.map((capability) => {
    const config = MODEL_REGISTRY[capability];
    return {
      capability,
      segment: config.segment,
      source: "default" as const,
      current: { primary: target(config.primary.provider, config.primary.model, config.primary.protocol), fallback: config.fallback ? target(config.fallback.provider, config.fallback.model, config.fallback.protocol) : null },
      default: { primary: target(config.primary.provider, config.primary.model, config.primary.protocol), fallback: config.fallback ? target(config.fallback.provider, config.fallback.model, config.fallback.protocol) : null },
      configured: null,
      selection: null,
    };
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  const randomUUID = vi.fn().mockReturnValueOnce("ui-operation-id").mockReturnValueOnce("ui-operation-id-2").mockReturnValue("ui-operation-id-next");
  vi.stubGlobal("crypto", { randomUUID });
});

afterEach(() => vi.unstubAllGlobals());

describe("AiModelSelectionForm", () => {
  it("agrupa capacidades e oferece fallback somente para campaign_copy", () => {
    render(<AiModelSelectionForm view={VIEW} />);
    expect(screen.getByRole("heading", { name: "Texto" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Imagem" })).toBeInTheDocument();
    expect(screen.getByText("campaign_image_edit")).toBeInTheDocument();
    expect(screen.getByLabelText("Fallback genérico")).toBeInTheDocument();
    expect(screen.queryAllByLabelText("Fallback genérico")).toHaveLength(1);
  });

  it("exige motivo e envia operationId no save", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ selection: { success: true } }) });
    render(<AiModelSelectionForm view={VIEW} />);
    const copyCard = screen.getByText("campaign_copy").closest("article");
    expect(copyCard).not.toBeNull();
    fireEvent.click(within(copyCard!).getByRole("button", { name: "Salvar seleção" }));
    expect(within(copyCard!).getByRole("alert")).toHaveTextContent("Motivo obrigatório");

    fireEvent.change(within(copyCard!).getByLabelText("Motivo da alteração"), { target: { value: "Ajuste operacional" } });
    fireEvent.click(within(copyCard!).getByRole("button", { name: "Salvar seleção" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    expect(body.operationId).toBe("ui-operation-id");
    expect(body.reason).toBe("Ajuste operacional");
  });

  it("expõe fallback atual/default e mantém UUID em retry, renovando ao mudar payload", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "falhou" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ selection: { success: true } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ selection: { success: true } }) });
    render(<AiModelSelectionForm view={VIEW} />);
    expect(screen.getByText("Fallback executado")).toBeInTheDocument();
    expect(screen.getByText("Fallback default")).toBeInTheDocument();
    const copyCard = screen.getByText("campaign_copy").closest("article")!;
    const reason = within(copyCard).getByLabelText("Motivo da alteração");
    fireEvent.change(reason, { target: { value: "retry" } });
    fireEvent.click(within(copyCard).getByRole("button", { name: "Salvar seleção" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(within(copyCard).getByRole("button", { name: "Salvar seleção" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const firstBody = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    const retryBody = JSON.parse(String(mockFetch.mock.calls[1][1].body));
    expect(retryBody.operationId).toBe(firstBody.operationId);
    fireEvent.change(reason, { target: { value: "novo payload" } });
    fireEvent.click(within(copyCard).getByRole("button", { name: "Salvar seleção" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(mockFetch.mock.calls[2][1].body)).operationId).not.toBe(firstBody.operationId);
  });

  it("mostra diagnóstico deprecated/missing e informa reset sem alteração auditada", async () => {
    const diagnosticView = {
      ...VIEW,
      capabilities: VIEW.capabilities.map((item) => item.capability === "campaign_copy" ? {
        ...item,
        configured: {
          primary: target("openai", "deprecated-copy", "chat-completions", "deprecated"),
          fallback: target("openai", "missing-fallback", "chat-completions", "missing"),
        },
      } : item),
    };
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ reset: { reset: false } }) });
    render(<AiModelSelectionForm view={diagnosticView} />);
    expect(screen.getByText(/Fallback persistido: missing-fallback/)).toBeInTheDocument();
    const copyCard = screen.getByText("campaign_copy").closest("article")!;
    fireEvent.change(within(copyCard).getByLabelText("Motivo da alteração"), { target: { value: "reset" } });
    fireEvent.click(within(copyCard).getByRole("button", { name: "Restaurar padrão" }));
    expect(await within(copyCard).findByText(/já estava no padrão/)).toBeInTheDocument();
  });

  it("mantém fallback deprecated vigente selecionado e desabilitado, com ativos disponíveis", () => {
    const fallbackDeprecatedView = {
      ...VIEW,
      capabilities: VIEW.capabilities.map((item) => item.capability === "campaign_copy" ? {
        ...item,
        current: { ...item.current, fallback: target("openai", "deprecated-fallback", "chat-completions", "deprecated") },
        configured: { primary: null, fallback: target("openai", "deprecated-fallback", "chat-completions", "deprecated") },
      } : item),
    };
    render(<AiModelSelectionForm view={fallbackDeprecatedView} />);
    const option = screen.getByRole("option", { name: /deprecated-fallback.*deprecated/ });
    expect(option).toBeDisabled();
    expect(screen.getByLabelText("Fallback genérico")).toHaveValue("openai|deprecated-fallback|chat-completions");
    const fallbackSelect = screen.getByLabelText("Fallback genérico");
    expect(within(fallbackSelect).getAllByRole("option", { name: /gemini-3\.1-flash-lite/ })).toHaveLength(1);
  });

  it("renderiza as 11 capacidades do registry", () => {
    render(<AiModelSelectionForm view={FULL_VIEW} />);
    for (const capability of ALL_CAPABILITIES) expect(screen.getByText(capability)).toBeInTheDocument();
  });

  it("recalcula o aviso de pricing quando o primary em edição muda", () => {
    const pricingOptions: CapacityPricingStatus[] = [
      { capability: "campaign_copy", target: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" }, components: [], missingComponents: [], pricingCoverage: "complete", selectionAllowed: true },
      { capability: "campaign_copy", target: { provider: "openai", model: "custom-no-price", protocol: "chat-completions" }, components: [], missingComponents: ["input_tokens", "output_tokens"], pricingCoverage: "missing", selectionAllowed: true },
      { capability: "campaign_copy", target: { provider: "gemini", model: "custom-no-price-fallback", protocol: "gemini" }, components: [], missingComponents: ["input_tokens", "output_tokens"], pricingCoverage: "missing", selectionAllowed: true },
    ];
    const pricingView: AiModelSelectionViewModel = {
      ...VIEW,
      catalog: [...VIEW.catalog, { id: "custom-copy", capability: "campaign_copy", segment: "text", provider: "openai", model: "custom-no-price", protocol: "chat-completions", label: "Custom", status: "active", source_note: null, validated_at: null, created_at: "", updated_at: "" }],
      capabilities: VIEW.capabilities.map((item) => item.capability === "campaign_copy" ? {
        ...item,
        pricingOptions,
      } : item),
    };
    pricingView.catalog = [...pricingView.catalog, { id: "custom-fallback", capability: "campaign_copy", segment: "text", provider: "gemini", model: "custom-no-price-fallback", protocol: "gemini", label: "Custom fallback", status: "active", source_note: null, validated_at: null, created_at: "", updated_at: "" }];
    render(<AiModelSelectionForm view={pricingView} />);
    const copyCard = screen.getByText("campaign_copy").closest("article")!;
    fireEvent.change(within(copyCard).getByLabelText("Novo primary"), { target: { value: "openai|custom-no-price|chat-completions" } });
    expect(within(copyCard).getByText(/Pricing missing: faltam input_tokens, output_tokens/)).toBeInTheDocument();
    fireEvent.change(within(copyCard).getByLabelText("Fallback genérico"), { target: { value: "gemini|custom-no-price-fallback|gemini" } });
    expect(within(copyCard).getByText(/Pricing do fallback missing: faltam input_tokens, output_tokens/)).toBeInTheDocument();
  });
});
