// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODEL_REGISTRY } from "@/lib/ai/model-registry";
import type { AiModelSelectionViewModel } from "@/lib/ai/ai-model-selection-view";
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("crypto", { randomUUID: () => "ui-operation-id" });
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
});
