import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  ImageModelPairConfigMissingError,
  ImageModelPairConfigDivergentError,
  ImageModelPairConfigReadError,
  ImageModelPairConfigService,
  IMAGE_MODEL_PAIR_CONFIG_MISSING,
  IMAGE_MODEL_PAIR_CONFIG_DIVERGENT,
  IMAGE_MODEL_PAIR_CONFIG_READ_FAILED,
  resolveImageModelPairConfig,
  type ImageModelPairConfigRow,
} from "../image-model-pair-config-service";
import { buildImageModelPairConfigView } from "../image-model-pair-config-view";
import { INITIAL_IMAGE_MODEL_PAIR } from "../image-model-pair";
import type { ImagePairCapacityPricingStatus } from "@/lib/ai-cost/types";

// `server-only` é aliasado no vitest.config.ts; o client real nunca é usado.
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const VALID_ROW: ImageModelPairConfigRow = {
  scope: "new_flow",
  primary_model: "gpt-image-2.5-sunburst",
  primary_quality: "medium",
  fallback_model: "gpt-image-2",
  fallback_quality: "medium",
  config_version_id: "22222222-2222-4222-8222-222222222222",
  reason: "decisão inicial expressa",
  updated_by: "33333333-3333-4333-8333-333333333333",
  updated_at: "2026-10-06T00:00:00.000Z",
  created_at: "2026-10-06T00:00:00.000Z",
};

/**
 * Fake do query builder de leitura (`from("image_model_pair_config")
 * .select("*").eq("scope","new_flow").maybeSingle()`). Nenhum banco/rede real.
 */
function fakeServiceClient(options: {
  row?: ImageModelPairConfigRow | null;
  error?: { message: string } | null;
} = {}) {
  let reads = 0;
  const maybeSingle = vi.fn(async () => {
    reads += 1;
    return { data: options.row ?? null, error: options.error ?? null };
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, getReads: () => reads, from, select, eq, maybeSingle };
}

function coverage(
  primary: "complete" | "partial" | "missing",
  fallback: "complete" | "partial" | "missing",
): ImagePairCapacityPricingStatus {
  return {
    primary: {
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      components: [],
      missingComponents: primary === "complete" ? [] : ["image_unit"],
      pricingCoverage: primary,
    },
    fallback: {
      model: "gpt-image-2",
      quality: "medium",
      components: [],
      missingComponents: fallback === "complete" ? [] : ["image_unit"],
      pricingCoverage: fallback,
    },
    missingComponents: [],
    pricingCoverage:
      primary === "complete" && fallback === "complete" ? "complete" : "partial",
  };
}

describe("ImageModelPairConfigService — leitura server-only e cache curto (D-05)", () => {
  it("lê a linha singleton vigente escopada em new_flow via service_role", async () => {
    const fake = fakeServiceClient({ row: VALID_ROW });
    const service = new ImageModelPairConfigService(fake.client as never);

    const row = await service.getImageModelPairConfig();

    expect(fake.from).toHaveBeenCalledWith("image_model_pair_config");
    expect(fake.select).toHaveBeenCalledWith("*");
    expect(fake.eq).toHaveBeenCalledWith("scope", "new_flow");
    expect(row?.config_version_id).toBe(VALID_ROW.config_version_id);
  });

  it("reutiliza a leitura dentro do TTL e re-lê após o TTL (now/TTL injetáveis)", async () => {
    let now = 1_000;
    const fake = fakeServiceClient({ row: VALID_ROW });
    const service = new ImageModelPairConfigService(fake.client as never, 30_000, () => now);

    await service.getImageModelPairConfig();
    now += 29_999;
    await service.getImageModelPairConfig();
    expect(fake.getReads()).toBe(1);

    now += 1;
    await service.getImageModelPairConfig();
    expect(fake.getReads()).toBe(2);
  });

  it("invalidação explícita força a próxima leitura a consultar o banco", async () => {
    const fake = fakeServiceClient({ row: VALID_ROW });
    const service = new ImageModelPairConfigService(fake.client as never);

    await service.getImageModelPairConfig();
    service.invalidateImageModelPairConfigCache();
    await service.getImageModelPairConfig();

    expect(fake.getReads()).toBe(2);
  });

  it("não repopula o cache com uma leitura in-flight iniciada antes da invalidação", async () => {
    let resolveFirst!: (value: { data: ImageModelPairConfigRow | null; error: null }) => void;
    let resolveSecond!: (value: { data: ImageModelPairConfigRow | null; error: null }) => void;
    const firstRead = new Promise<{ data: ImageModelPairConfigRow | null; error: null }>((resolve) => {
      resolveFirst = resolve;
    });
    const secondRead = new Promise<{ data: ImageModelPairConfigRow | null; error: null }>((resolve) => {
      resolveSecond = resolve;
    });
    const maybeSingle = vi.fn().mockReturnValueOnce(firstRead).mockReturnValueOnce(secondRead);
    const client = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })) };
    const service = new ImageModelPairConfigService(client as never);

    const staleRead = service.getImageModelPairConfig();
    service.invalidateImageModelPairConfigCache();
    const freshRead = service.getImageModelPairConfig();
    resolveFirst({ data: { ...VALID_ROW, config_version_id: "stale" }, error: null });
    await staleRead;
    resolveSecond({ data: { ...VALID_ROW, config_version_id: "fresh" }, error: null });

    await expect(freshRead).resolves.toMatchObject({ config_version_id: "fresh" });
    expect(maybeSingle).toHaveBeenCalledTimes(3); // 2 leituras + releitura pós-invalidação
  });

  it("falha de leitura é fail-closed: erro tipado, nunca null silencioso", async () => {
    const fake = fakeServiceClient({ error: { message: "connection refused" } });
    const service = new ImageModelPairConfigService(fake.client as never);

    const error = await service.getImageModelPairConfig().catch((err) => err);

    expect(error).toBeInstanceOf(ImageModelPairConfigReadError);
    expect(error.code).toBe(IMAGE_MODEL_PAIR_CONFIG_READ_FAILED);
  });
});

describe("resolveImageModelPairConfig — resolução fail-closed (D-06)", () => {
  it("config ausente → erro identificável image_model_pair_config_missing", async () => {
    const fake = fakeServiceClient({ row: null });
    const service = new ImageModelPairConfigService(fake.client as never);

    const error = await service.resolveImageModelPairConfig().catch((err) => err);

    expect(error).toBeInstanceOf(ImageModelPairConfigMissingError);
    expect(error.code).toBe(IMAGE_MODEL_PAIR_CONFIG_MISSING);
  });

  it("config incompleta → mesmo erro de ausência (nunca default)", async () => {
    const fake = fakeServiceClient({
      row: { ...VALID_ROW, fallback_quality: "" as never },
    });
    const service = new ImageModelPairConfigService(fake.client as never);

    await expect(service.resolveImageModelPairConfig()).rejects.toBeInstanceOf(
      ImageModelPairConfigMissingError,
    );
  });

  it("modelo divergente do catálogo → erro identificável image_model_pair_config_divergent (model)", async () => {
    const fake = fakeServiceClient({ row: { ...VALID_ROW, primary_model: "dall-e-3" } });
    const service = new ImageModelPairConfigService(fake.client as never);

    const error = await service.resolveImageModelPairConfig().catch((err) => err);

    expect(error).toBeInstanceOf(ImageModelPairConfigDivergentError);
    expect(error.code).toBe(IMAGE_MODEL_PAIR_CONFIG_DIVERGENT);
    expect(error.field).toBe("model");
  });

  it("qualidade divergente do catálogo → erro identificável (quality)", async () => {
    const fake = fakeServiceClient({ row: { ...VALID_ROW, fallback_quality: "high" } });
    const service = new ImageModelPairConfigService(fake.client as never);

    const error = await service.resolveImageModelPairConfig().catch((err) => err);

    expect(error).toBeInstanceOf(ImageModelPairConfigDivergentError);
    expect(error.field).toBe("quality");
  });

  it("nunca substitui o modelo por default (não devolve o par inicial)", async () => {
    const fake = fakeServiceClient({ row: { ...VALID_ROW, primary_model: "nao-elegivel" } });
    const service = new ImageModelPairConfigService(fake.client as never);

    const result = await service.resolveImageModelPairConfig().catch(() => null);

    expect(result).toBeNull();
    expect(result).not.toEqual(INITIAL_IMAGE_MODEL_PAIR);
  });

  it("config vigente válida → par + versão + origem human_decision", async () => {
    const fake = fakeServiceClient({ row: VALID_ROW });
    const service = new ImageModelPairConfigService(fake.client as never);

    const resolved = await service.resolveImageModelPairConfig();

    expect(resolved.primary).toEqual({ model: "gpt-image-2.5-sunburst", quality: "medium" });
    expect(resolved.fallback).toEqual({ model: "gpt-image-2", quality: "medium" });
    expect(resolved.configVersionId).toBe(VALID_ROW.config_version_id);
    expect(resolved.origin).toBe("human_decision");
    expect(resolved.updatedBy).toBe(VALID_ROW.updated_by);
  });

  it("wrapper `resolveImageModelPairConfig` delega ao serviço singleton", async () => {
    // O singleton usa supabaseAdmin (mockado vazio) — a chamada só precisa existir
    // e propagar o erro fail-closed sem tocar rede real.
    await expect(resolveImageModelPairConfig()).rejects.toBeTruthy();
  });
});

describe("buildImageModelPairConfigView — view admin (D-09/D-23)", () => {
  it("estado vazio não lança e expõe o catálogo elegível completo", async () => {
    const fake = fakeServiceClient({ row: null });
    const service = new ImageModelPairConfigService(fake.client as never);

    const view = await buildImageModelPairConfigView({ service });

    expect(view.configured).toBe(false);
    expect(view.current).toBeNull();
    expect(view.origin).toBeNull();
    expect(view.configVersionId).toBeNull();
    expect(view.pricing).toBeNull();
    expect(view.eligibleModels).toEqual([
      "gpt-image-2",
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
    ]);
    expect(view.eligibleQualities).toEqual(["low", "medium"]);
  });

  it("estado configurado expõe par vigente, origem, versão e cobertura por par", async () => {
    const fake = fakeServiceClient({ row: VALID_ROW });
    const service = new ImageModelPairConfigService(fake.client as never);

    const view = await buildImageModelPairConfigView({
      service,
      pricingResolver: async () => coverage("complete", "missing"),
    });

    expect(view.configured).toBe(true);
    expect(view.current).toEqual({
      primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
      fallback: { model: "gpt-image-2", quality: "medium" },
    });
    expect(view.origin).toBe("human_decision");
    expect(view.configVersionId).toBe(VALID_ROW.config_version_id);
    expect(view.pricingCoverage).toBe("partial");
    expect(view.pricing?.primary.pricingCoverage).toBe("complete");
    expect(view.pricing?.fallback.pricingCoverage).toBe("missing");
    expect(view.productionActive).toBe(false);
  });

  it("config divergente não lança e não calcula pricing (par inelegível)", async () => {
    const fake = fakeServiceClient({ row: { ...VALID_ROW, primary_model: "dall-e-3" } });
    const service = new ImageModelPairConfigService(fake.client as never);
    const pricingResolver = vi.fn(async () => coverage("complete", "complete"));

    const view = await buildImageModelPairConfigView({ service, pricingResolver });

    expect(view.eligible).toBe(false);
    expect(view.pricing).toBeNull();
    expect(pricingResolver).not.toHaveBeenCalled();
  });

  it("erro de leitura não lança: view marca readError e permanece inativa", async () => {
    const fake = fakeServiceClient({ error: { message: "boom" } });
    const service = new ImageModelPairConfigService(fake.client as never);

    const view = await buildImageModelPairConfigView({ service });

    expect(view.configured).toBe(false);
    expect(view.readError).toContain("boom");
  });
});

describe("isolamento server-only (D-05)", () => {
  it("o serviço e a view importam server-only", () => {
    const service = readFileSync(
      path.resolve(process.cwd(), "src/lib/ai/image-model-pair-config-service.ts"),
      "utf8",
    );
    const view = readFileSync(
      path.resolve(process.cwd(), "src/lib/ai/image-model-pair-config-view.ts"),
      "utf8",
    );
    expect(service).toMatch(/^import "server-only";/m);
    expect(view).toMatch(/^import "server-only";/m);
  });
});
