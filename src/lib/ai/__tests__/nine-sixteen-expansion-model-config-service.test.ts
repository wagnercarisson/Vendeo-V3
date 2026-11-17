// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// O client global é um objeto que LANÇA ao ser usado: qualquer leitura que
// dependa dele (em vez do client injetado) falha de forma observável.
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("global supabaseAdmin must not be touched");
      },
    },
  ),
}));

import {
  NINE_SIXTEEN_EXPANSION_CONFIG_READ_FAILED,
  NineSixteenExpansionConfigService,
  invalidateNineSixteenExpansionConfigCache,
  readNineSixteenExpansionConfig,
} from "../nine-sixteen-expansion-model-config-service";
import type { NineSixteenExpansionConfigRow } from "../nine-sixteen-expansion-model-config";

const CONFIG_VERSION_ID = "11111111-1111-4111-8111-111111111111";

const VALID_ROW: NineSixteenExpansionConfigRow = {
  scope: "expansion",
  model: "gpt-image-2.5-flare",
  quality: "medium",
  config_version_id: CONFIG_VERSION_ID,
  reason: "troca aprovada",
  updated_by: "33333333-3333-4333-8333-333333333333",
  updated_at: "2026-11-17T00:00:00.000Z",
  created_at: "2026-11-17T00:00:00.000Z",
};

type ReadResponse = {
  data: NineSixteenExpansionConfigRow | null;
  error: { message: string } | null;
};

/**
 * Fake do query builder de leitura (`from(table).select("*").eq("scope",
 * "expansion").maybeSingle()`). Registra as tabelas consultadas; nenhum
 * banco/rede real.
 */
function fakeClient(
  handler: () => ReadResponse | Promise<ReadResponse> = () => ({
    data: VALID_ROW,
    error: null,
  }),
) {
  const tables: string[] = [];
  const maybeSingle = vi.fn(async () => handler());
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string) => {
    tables.push(table);
    return { select };
  });

  return {
    client: { from },
    from,
    select,
    eq,
    maybeSingle,
    tables,
    getReads: () => maybeSingle.mock.calls.length,
  };
}

describe("NineSixteenExpansionConfigService — leitura estrita (found/absent/invalid/read_failed)", () => {
  it("linha vigente → found com origem configured", async () => {
    const fake = fakeClient();
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    const result = await service.readNineSixteenExpansionConfig();

    expect(result).toEqual({
      kind: "found",
      selection: {
        model: "gpt-image-2.5-flare",
        quality: "medium",
        configVersionId: CONFIG_VERSION_ID,
        origin: "configured",
      },
    });
    expect(fake.from).toHaveBeenCalledWith("nine_sixteen_expansion_model_config");
    expect(fake.select).toHaveBeenCalledWith("*");
    expect(fake.eq).toHaveBeenCalledWith("scope", "expansion");
  });

  it("linha nula SEM erro → absent (ausência comprovada)", async () => {
    const fake = fakeClient(() => ({ data: null, error: null }));
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    await expect(service.readNineSixteenExpansionConfig()).resolves.toEqual({
      kind: "absent",
    });
  });

  it("linha PRESENTE mas incompleta → invalid (nunca absent)", async () => {
    const incomplete = { ...VALID_ROW, config_version_id: "" };
    const fake = fakeClient(() => ({
      data: incomplete as NineSixteenExpansionConfigRow,
      error: null,
    }));
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    const result = await service.readNineSixteenExpansionConfig();

    expect(result.kind).toBe("invalid");
    expect(result.kind).not.toBe("absent");
  });

  it("erro de leitura NUNCA vira absent", async () => {
    const fake = fakeClient(() => ({ data: null, error: { message: "connection refused" } }));
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    const result = await service.readNineSixteenExpansionConfig();

    expect(result.kind).toBe("read_failed");
    expect(result.kind).not.toBe("absent");
    if (result.kind === "read_failed") {
      expect(result.reason).toContain(NINE_SIXTEEN_EXPANSION_CONFIG_READ_FAILED);
      expect(result.reason).toContain("connection refused");
    }
  });

  it("exceção do client → read_failed (nunca absent)", async () => {
    const fake = fakeClient(() => {
      throw new Error("socket hang up");
    });
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    const result = await service.readNineSixteenExpansionConfig();

    expect(result.kind).toBe("read_failed");
    if (result.kind === "read_failed") {
      expect(result.reason).toContain("socket hang up");
    }
  });

  it("modelo fora da lista fechada → invalid (distinto de absent/read_failed)", async () => {
    const fake = fakeClient(() => ({
      data: { ...VALID_ROW, model: "gpt-image-2" },
      error: null,
    }));
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    const result = await service.readNineSixteenExpansionConfig();

    expect(result.kind).toBe("invalid");
    expect(result.kind).not.toBe("absent");
    expect(result.kind).not.toBe("read_failed");
    if (result.kind === "invalid") {
      expect(result.reason).toContain("nine_sixteen_expansion_model_not_eligible");
    }
  });

  it("qualidade fora da lista → invalid sem correção silenciosa", async () => {
    const fake = fakeClient(() => ({
      data: { ...VALID_ROW, quality: "high" },
      error: null,
    }));
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    const result = await service.readNineSixteenExpansionConfig();

    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") {
      expect(result.reason).toContain("quality");
    }
  });

  it("versão de configuração divergente → invalid", async () => {
    const fake = fakeClient(() => ({
      data: { ...VALID_ROW, config_version_id: "stale" },
      error: null,
    }));
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    await expect(service.readNineSixteenExpansionConfig()).resolves.toMatchObject({
      kind: "invalid",
    });
  });
});

describe("cache curto, dedupe in-flight e invalidação", () => {
  it("duas leituras dentro do TTL fazem uma única chamada", async () => {
    const fake = fakeClient();
    let now = 1_000;
    const service = new NineSixteenExpansionConfigService(
      fake.client as never,
      30_000,
      () => now,
    );

    const first = await service.readNineSixteenExpansionConfig();
    now += 29_999;
    const second = await service.readNineSixteenExpansionConfig();

    expect(fake.getReads()).toBe(1);
    expect(second).toEqual(first);
  });

  it("após o TTL a leitura volta ao client", async () => {
    const fake = fakeClient();
    let now = 1_000;
    const service = new NineSixteenExpansionConfigService(
      fake.client as never,
      30_000,
      () => now,
    );

    await service.readNineSixteenExpansionConfig();
    now += 30_000;
    await service.readNineSixteenExpansionConfig();

    expect(fake.getReads()).toBe(2);
  });

  it("invalidação explícita força releitura", async () => {
    const fake = fakeClient();
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    await service.readNineSixteenExpansionConfig();
    service.invalidateNineSixteenExpansionConfigCache();
    await service.readNineSixteenExpansionConfig();

    expect(fake.getReads()).toBe(2);
  });

  it("chamadas concorrentes compartilham a mesma promise", async () => {
    let resolveRead!: (value: ReadResponse) => void;
    const pending = new Promise<ReadResponse>((resolve) => {
      resolveRead = resolve;
    });
    const maybeSingle = vi.fn(() => pending);
    const client = {
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })),
    };
    const service = new NineSixteenExpansionConfigService(client as never);

    const first = service.readNineSixteenExpansionConfig();
    const second = service.readNineSixteenExpansionConfig();
    resolveRead({ data: VALID_ROW, error: null });

    const [a, b] = await Promise.all([first, second]);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a.kind).toBe("found");
  });

  it("invalidação durante o voo não popula cache obsoleto", async () => {
    let resolveFirst!: (value: ReadResponse) => void;
    let resolveSecond!: (value: ReadResponse) => void;
    const firstRead = new Promise<ReadResponse>((resolve) => {
      resolveFirst = resolve;
    });
    const secondRead = new Promise<ReadResponse>((resolve) => {
      resolveSecond = resolve;
    });
    const maybeSingle = vi
      .fn()
      .mockReturnValueOnce(firstRead)
      .mockReturnValueOnce(secondRead);
    const client = {
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })),
    };
    const service = new NineSixteenExpansionConfigService(client as never);

    const stale = service.readNineSixteenExpansionConfig();
    service.invalidateNineSixteenExpansionConfigCache();
    const fresh = service.readNineSixteenExpansionConfig();

    resolveFirst({ data: { ...VALID_ROW, config_version_id: "stale" }, error: null });
    await stale;
    resolveSecond({
      data: { ...VALID_ROW, config_version_id: "22222222-2222-4222-8222-222222222222" },
      error: null,
    });

    const freshResult = await fresh;
    expect(freshResult.kind).toBe("found");
    if (freshResult.kind === "found") {
      expect(freshResult.selection.configVersionId).toBe(
        "22222222-2222-4222-8222-222222222222",
      );
    }

    // A leitura antiga não re-populou o cache: a próxima leitura usa o cache da
    // leitura nova (2 chamadas no total, nenhuma adicional e nenhum valor stale).
    const after = await service.readNineSixteenExpansionConfig();
    expect(maybeSingle).toHaveBeenCalledTimes(2);
    expect(after).toEqual(freshResult);
  });

  it("read_failed não é cacheado", async () => {
    const fake = fakeClient(() => ({ data: null, error: { message: "boom" } }));
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    const first = await service.readNineSixteenExpansionConfig();
    const second = await service.readNineSixteenExpansionConfig();

    expect(first.kind).toBe("read_failed");
    expect(second.kind).toBe("read_failed");
    expect(fake.getReads()).toBe(2);
  });

  it("invalid não é cacheado", async () => {
    const fake = fakeClient(() => ({
      data: { ...VALID_ROW, model: "dall-e-3" },
      error: null,
    }));
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    await service.readNineSixteenExpansionConfig();
    await service.readNineSixteenExpansionConfig();

    expect(fake.getReads()).toBe(2);
  });

  it("absent é cacheado dentro do TTL", async () => {
    const fake = fakeClient(() => ({ data: null, error: null }));
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    await service.readNineSixteenExpansionConfig();
    await service.readNineSixteenExpansionConfig();

    expect(fake.getReads()).toBe(1);
  });
});

describe("independência do par 1:1 e da base quadrada", () => {
  it("consulta somente nine_sixteen_expansion_model_config", async () => {
    const fake = fakeClient();
    const service = new NineSixteenExpansionConfigService(fake.client as never);

    await service.readNineSixteenExpansionConfig();

    expect(fake.tables).toEqual(["nine_sixteen_expansion_model_config"]);
    expect(fake.tables).not.toContain("image_model_pair_config");
    expect(fake.tables).not.toContain("ai_model_selection");
    expect(fake.tables).not.toContain("image_generation_config_snapshots");
  });

  it("o módulo não referencia tabelas do 1:1/base", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/ai/nine-sixteen-expansion-model-config-service.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/image_model_pair_config/);
    expect(source).not.toMatch(/ai_model_selection/);
    expect(source).not.toMatch(/image_generation_config_snapshots/);
    expect(source).toMatch(/^import "server-only";/m);
  });
});

describe("client injetado — mesma instância, global intocado", () => {
  it("readNineSixteenExpansionConfig({ client }) usa exatamente o client recebido", async () => {
    const fake = fakeClient();

    const result = await readNineSixteenExpansionConfig({ client: fake.client as never });

    expect(result.kind).toBe("found");
    expect(fake.from).toHaveBeenCalledTimes(1);
  });

  it("sem client, o default é o global — aqui ele lança e vira read_failed (nunca absent)", async () => {
    invalidateNineSixteenExpansionConfigCache();

    const result = await readNineSixteenExpansionConfig();

    expect(result.kind).toBe("read_failed");
    if (result.kind === "read_failed") {
      expect(result.reason).toContain("global supabaseAdmin must not be touched");
    }
  });
});
