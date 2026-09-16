// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { LabModelTarget } from "../schemas";
import {
  LAB_PRIMARY_CAPABILITY,
  ModelTargetNotInCatalogError,
  validateModelTargetAgainstCatalog,
} from "../model-target";

/**
 * Validação do alvo de modelo contra o catálogo F47 (F48.1, D5/D6).
 *
 * Trava: somente linha **ativa** de `campaign_image` é aceita, o alvo recusado
 * carrega o erro determinístico e o catálogo é acessado **apenas para leitura**
 * (nenhum `insert`/`update`/`delete`/`upsert`/`rpc` chega ao cliente).
 */

const ACTIVE_TARGET: LabModelTarget = {
  provider: "openai",
  model: "gpt-5.5",
  protocol: "responses",
};

interface CatalogRow {
  id: string;
  capability: string;
  provider: string;
  model: string;
  protocol: string;
  status: string;
}

/** Linha ativa real do catálogo para `campaign_image` (F47 seed). */
function catalogRow(overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    capability: LAB_PRIMARY_CAPABILITY,
    provider: "openai",
    model: "gpt-5.5",
    protocol: "responses",
    status: "active",
    ...overrides,
  };
}

/**
 * Cliente fake em memória: filtra as linhas do catálogo pelos `eq` recebidos e
 * registra **todas** as chamadas para provar que nenhuma escrita é emitida.
 */
class FakeCatalogClient {
  readonly calls: string[] = [];

  constructor(private readonly rows: CatalogRow[]) {}

  from(table: string) {
    const calls = this.calls;
    const rows = this.rows;
    calls.push(`from:${table}`);

    const filters: Array<[string, unknown]> = [];
    const builder = {
      select(columns: string) {
        calls.push(`select:${columns}`);
        return builder;
      },
      eq(column: string, value: unknown) {
        calls.push(`eq:${column}`);
        filters.push([column, value]);
        return builder;
      },
      async maybeSingle() {
        calls.push("maybeSingle");
        const match = rows.find((row) =>
          filters.every(
            ([column, value]) =>
              (row as unknown as Record<string, unknown>)[column] === value,
          ),
        );
        return { data: match ? { id: match.id } : null, error: null };
      },
    };

    return builder;
  }
}

/** Cliente fake que sempre devolve erro de leitura. */
class FailingCatalogClient {
  readonly calls: string[] = [];

  from(table: string) {
    const calls = this.calls;
    calls.push(`from:${table}`);

    const builder = {
      select(columns: string) {
        calls.push(`select:${columns}`);
        return builder;
      },
      eq(column: string) {
        calls.push(`eq:${column}`);
        return builder;
      },
      async maybeSingle() {
        calls.push("maybeSingle");
        return { data: null, error: { message: "db unavailable" } };
      },
    };

    return builder;
  }
}

function asClient(fake: FakeCatalogClient | FailingCatalogClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

function captureError(fn: () => Promise<unknown>): Promise<unknown> {
  return fn().then(
    () => null,
    (caught) => caught,
  );
}

describe("validateModelTargetAgainstCatalog", () => {
  it("aceita alvo com linha ativa para campaign_image", async () => {
    const fake = new FakeCatalogClient([catalogRow()]);

    await expect(
      validateModelTargetAgainstCatalog(ACTIVE_TARGET, asClient(fake)),
    ).resolves.toEqual({ ok: true });
  });

  it("recusa alvo com modelo diferente do catálogo", async () => {
    const fake = new FakeCatalogClient([catalogRow()]);
    const target: LabModelTarget = { ...ACTIVE_TARGET, model: "gpt-4o" };

    const error = (await captureError(() =>
      validateModelTargetAgainstCatalog(target, asClient(fake)),
    )) as ModelTargetNotInCatalogError;

    expect(error).toBeInstanceOf(ModelTargetNotInCatalogError);
    expect(error.code).toBe("model_target_not_in_catalog");
    expect(error.target).toEqual(target);
  });

  it("recusa alvo com protocolo diferente do catálogo", async () => {
    const fake = new FakeCatalogClient([catalogRow()]);
    const target: LabModelTarget = { ...ACTIVE_TARGET, protocol: "images" };

    const error = (await captureError(() =>
      validateModelTargetAgainstCatalog(target, asClient(fake)),
    )) as ModelTargetNotInCatalogError;

    expect(error).toBeInstanceOf(ModelTargetNotInCatalogError);
  });

  it("recusa alvo com provider diferente do catálogo", async () => {
    const fake = new FakeCatalogClient([catalogRow()]);
    const target: LabModelTarget = { ...ACTIVE_TARGET, provider: "gemini" };

    await expect(
      captureError(() => validateModelTargetAgainstCatalog(target, asClient(fake))),
    ).resolves.toBeInstanceOf(ModelTargetNotInCatalogError);
  });

  it("recusa linha existente porém deprecated (status diferente de active)", async () => {
    const fake = new FakeCatalogClient([catalogRow({ status: "deprecated" })]);

    const error = (await captureError(() =>
      validateModelTargetAgainstCatalog(ACTIVE_TARGET, asClient(fake)),
    )) as ModelTargetNotInCatalogError;

    expect(error).toBeInstanceOf(ModelTargetNotInCatalogError);
  });

  it("recusa quando o catálogo está vazio", async () => {
    const fake = new FakeCatalogClient([]);

    await expect(
      captureError(() => validateModelTargetAgainstCatalog(ACTIVE_TARGET, asClient(fake))),
    ).resolves.toBeInstanceOf(ModelTargetNotInCatalogError);
  });

  it("fail-closed: erro de leitura do catálogo não libera o alvo", async () => {
    const fake = new FailingCatalogClient();

    const error = (await captureError(() =>
      validateModelTargetAgainstCatalog(ACTIVE_TARGET, asClient(fake)),
    )) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ModelTargetNotInCatalogError);
    expect(error.message).toContain("model_target_catalog_read_failed");
  });

  it("consulta apenas campaign_image e filtra status active", async () => {
    const fake = new FakeCatalogClient([catalogRow()]);

    await validateModelTargetAgainstCatalog(ACTIVE_TARGET, asClient(fake));

    expect(fake.calls).toContain("from:ai_model_catalog");
    expect(fake.calls).toContain("select:id");
    expect(fake.calls).toContain("eq:capability");
    expect(fake.calls).toContain("eq:status");
    expect(fake.calls).toContain("maybeSingle");
  });

  it("não emite nenhuma escrita ao cliente (somente leitura)", async () => {
    const fake = new FakeCatalogClient([catalogRow()]);

    await validateModelTargetAgainstCatalog(ACTIVE_TARGET, asClient(fake));

    const allowed = /^(from:|select:|eq:|maybeSingle$)/;
    const unexpected = fake.calls.filter((call) => !allowed.test(call));
    expect(unexpected).toEqual([]);
    expect(fake.calls.every((call) => !/insert|update|delete|upsert|rpc/.test(call))).toBe(true);
  });
});
