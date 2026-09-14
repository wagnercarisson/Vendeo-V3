import { describe, expect, it, vi } from "vitest";
import { AiModelSelectionService } from "../ai-model-selection-service";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const selection = (capability = "campaign_copy") => ({
  id: `${capability}-selection`,
  capability,
  provider: "openai",
  model: "gpt-4o",
  protocol: "chat-completions",
  fallback_provider: null,
  fallback_model: null,
  fallback_protocol: null,
  reason: "test",
  updated_by: null,
  updated_at: "2026-09-14T00:00:00Z",
});

describe("AiModelSelectionService", () => {
  it("não repopula o cache com uma leitura in-flight iniciada antes da invalidação", async () => {
    let resolveFirst!: (value: { data: unknown; error: null }) => void;
    let resolveSecond!: (value: { data: unknown; error: null }) => void;
    const firstRead = new Promise<{ data: unknown; error: null }>((resolve) => {
      resolveFirst = resolve;
    });
    const secondRead = new Promise<{ data: unknown; error: null }>((resolve) => {
      resolveSecond = resolve;
    });
    const select = vi
      .fn()
      .mockReturnValueOnce(firstRead)
      .mockReturnValueOnce(secondRead);
    const client = { from: vi.fn(() => ({ select })) };
    const service = new AiModelSelectionService(client as never);

    const staleRead = service.getSelectionMap();
    service.invalidateModelSelectionCache();
    const freshRead = service.getSelectionMap();
    resolveFirst({ data: [selection()], error: null });
    await staleRead;
    resolveSecond({ data: [selection("campaign_image")], error: null });
    expect((await freshRead).get("campaign_image")?.capability).toBe("campaign_image");
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("carrega o mapa completo uma vez dentro do TTL de 30 segundos", async () => {
    let now = 1_000;
    const select = vi.fn().mockResolvedValue({ data: [selection(), selection("campaign_image")], error: null });
    const client = { from: vi.fn(() => ({ select })) };
    const service = new AiModelSelectionService(client as never, 30_000, () => now);

    expect((await service.getSelectionMap()).size).toBe(2);
    now += 29_999;
    expect((await service.getSelectionMap()).size).toBe(2);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("expira após 30 segundos e invalidação local força a próxima leitura", async () => {
    let now = 1_000;
    const select = vi
      .fn()
      .mockResolvedValueOnce({ data: [selection()], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [selection("campaign_image")], error: null });
    const client = { from: vi.fn(() => ({ select })) };
    const service = new AiModelSelectionService(client as never, 30_000, () => now);

    await service.getSelectionMap();
    now += 30_000;
    expect(await service.getSelections()).toEqual([]);
    service.invalidateModelSelectionCache();
    expect(await service.getSelections()).toHaveLength(1);
    expect(select).toHaveBeenCalledTimes(3);
  });

  it("retorna mapa vazio quando Supabase falha sem lançar", async () => {
    const select = vi.fn().mockRejectedValue(new Error("offline"));
    const client = { from: vi.fn(() => ({ select })) };
    const service = new AiModelSelectionService(client as never);

    await expect(service.getSelectionMap()).resolves.toEqual(new Map());
  });
});
