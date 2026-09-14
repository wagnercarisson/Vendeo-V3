import { describe, expect, it, vi } from "vitest";
import {
  AiModelCatalogService,
  catalogTupleKey,
} from "../ai-model-catalog-service";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "catalog-1",
  capability: "campaign_copy",
  segment: "text",
  provider: "openai",
  model: "gpt-4o",
  protocol: "chat-completions",
  label: "GPT-4o",
  status: "active",
  source_note: null,
  validated_at: null,
  created_at: "2026-09-14T00:00:00Z",
  updated_at: "2026-09-14T00:00:00Z",
  ...overrides,
});

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const select = vi.fn().mockResolvedValue(result);
  return [{ from: vi.fn(() => ({ select })) }, select] as const;
}

describe("AiModelCatalogService", () => {
  it("faz uma leitura bulk e mantém deprecated disponível no mapa", async () => {
    const [client, select] = fakeClient({
      data: [row(), row({ id: "catalog-2", status: "deprecated", model: "gpt-4o-old" })],
      error: null,
    });
    const service = new AiModelCatalogService(client as never);

    const map = await service.getCatalogMap();
    expect(map.size).toBe(2);
    expect(map.get(catalogTupleKey("campaign_copy", "openai", "gpt-4o-old", "chat-completions"))?.status).toBe("deprecated");
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("filtra active sem uma nova consulta", async () => {
    const [client, select] = fakeClient({ data: [row(), row({ id: "catalog-2", status: "deprecated" })], error: null });
    const service = new AiModelCatalogService(client as never);

    expect(await service.getActiveCatalogRows()).toHaveLength(1);
    expect(await service.getActiveCatalogRows()).toHaveLength(1);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("falha open quando a leitura falha e invalidação força nova leitura", async () => {
    const select = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "offline" } })
      .mockResolvedValueOnce({ data: [row()], error: null });
    const client = { from: vi.fn(() => ({ select })) };
    const service = new AiModelCatalogService(client as never);

    expect(await service.getCatalogRows()).toEqual([]);
    service.invalidateModelCatalogCache();
    expect(await service.getCatalogRows()).toHaveLength(1);
    expect(select).toHaveBeenCalledTimes(2);
  });
});
