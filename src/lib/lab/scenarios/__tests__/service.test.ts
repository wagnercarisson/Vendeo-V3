// @vitest-environment node
import { describe, it, expect } from "vitest";

import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";
import { mapScenarioToCampaignBrief, mapScenarioToResolvedContext } from "../mapper";
import { parseLabScenarioContent } from "../schema";
import type { LabScenarioContent } from "../schema";
import {
  canonicalizeScenarioContent,
  computeScenarioContentHash,
  listScenarioFixtures,
  loadScenarioFixture,
  materializeScenarios,
} from "../service";
import type { LabScenarioStore } from "../service";

/**
 * Serviço dos cenários controlados (F48.1, D4).
 *
 * Determinismo do hash canônico, leitura confinada das fixtures, data URLs
 * resolvidos server-side e materialização idempotente. Nenhuma rede e nenhuma
 * chamada paga: a materialização usa um store em memória.
 */

// ─── Store fake em memória (sem rede) ───────────────────────────────────────

interface FakeScenario {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "active";
  currentVersion: number;
}

interface FakeVersion {
  version: number;
  content: LabScenarioContent;
  contentHash: string;
  fixturePath: string;
  notes: string | null;
}

class FakeScenarioStore implements LabScenarioStore {
  readonly scenarios = new Map<string, FakeScenario>();
  readonly versions = new Map<string, FakeVersion[]>();
  private sequence = 0;

  async getScenarioBySlug(slug: string): Promise<{ id: string; currentVersion: number } | null> {
    const row = this.scenarios.get(slug);
    return row ? { id: row.id, currentVersion: row.currentVersion } : null;
  }

  async insertScenario(row: {
    slug: string;
    name: string;
    description: string | null;
    status: "active";
    currentVersion: number;
  }): Promise<{ id: string }> {
    this.sequence += 1;
    const id = `scenario-${this.sequence}`;
    this.scenarios.set(row.slug, { id, ...row });
    this.versions.set(id, []);
    return { id };
  }

  async updateScenarioCurrentVersion(id: string, currentVersion: number): Promise<void> {
    for (const row of this.scenarios.values()) {
      if (row.id === id) row.currentVersion = currentVersion;
    }
  }

  async listScenarioVersionHashes(
    scenarioId: string,
  ): Promise<Array<{ version: number; contentHash: string }>> {
    return (this.versions.get(scenarioId) ?? []).map((version) => ({
      version: version.version,
      contentHash: version.contentHash,
    }));
  }

  async insertScenarioVersion(row: {
    scenarioId: string;
    version: number;
    content: LabScenarioContent;
    contentHash: string;
    fixturePath: string;
    notes: string | null;
  }): Promise<void> {
    const list = this.versions.get(row.scenarioId) ?? [];
    list.push({
      version: row.version,
      content: row.content,
      contentHash: row.contentHash,
      fixturePath: row.fixturePath,
      notes: row.notes,
    });
    this.versions.set(row.scenarioId, list);
  }

  /** Quantidade de versões gravadas para um slug. */
  versionCount(slug: string): number {
    const scenario = this.scenarios.get(slug);
    return scenario ? (this.versions.get(scenario.id) ?? []).length : 0;
  }
}

// ─── Hash canônico ──────────────────────────────────────────────────────────

function scenarioContent(overrides: Record<string, unknown> = {}): LabScenarioContent {
  return parseLabScenarioContent({
    slug: "produto-oferta-preco",
    name: "Oferta com preço",
    intent: "offer",
    format: "1:1",
    locale: "pt-BR",
    mediaKinds: ["image"],
    brief: {
      product: { name: "Cesta Aurora" },
      offer: { originalPriceCents: 12990, discountedPriceCents: 9990 },
    },
    store: { name: "Empório Aurora", segment: "mercados-mercearias", brandColor: "#16A34A" },
    identity: { state: "text_only" },
    images: [{ id: "produto", role: "primary", path: "images/produto.jpg" }],
    fictitious: true,
    ...overrides,
  });
}

describe("computeScenarioContentHash — determinismo (D4)", () => {
  it("é estável para o mesmo conteúdo", () => {
    const content = scenarioContent();
    expect(computeScenarioContentHash(content)).toBe(computeScenarioContentHash(content));
  });

  it("ignora a ordem das chaves (JSON canônico)", () => {
    const a = scenarioContent();
    const b = scenarioContent();

    // Reinsere as mesmas chaves em ordem inversa no objeto bruto.
    const reordered = Object.fromEntries(
      Object.entries(b as unknown as Record<string, unknown>).reverse(),
    ) as unknown as LabScenarioContent;

    expect(canonicalizeScenarioContent(reordered)).toBe(canonicalizeScenarioContent(a));
    expect(computeScenarioContentHash(reordered)).toBe(computeScenarioContentHash(a));
  });

  it("preserva a ordem dos arrays (imagens são posicionais)", () => {
    const withTwo = scenarioContent({
      images: [
        { id: "produto", role: "primary", path: "images/produto.jpg" },
        { id: "aux", role: "reference", path: "images/produto-auxiliar.jpg" },
      ],
    });
    const reversed = scenarioContent({
      images: [
        { id: "aux", role: "reference", path: "images/produto-auxiliar.jpg" },
        { id: "produto", role: "primary", path: "images/produto.jpg" },
      ],
    });

    expect(computeScenarioContentHash(withTwo)).not.toBe(computeScenarioContentHash(reversed));
  });

  it("gera hash de 64 caracteres hexadecimais", () => {
    expect(computeScenarioContentHash(scenarioContent())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes dos 3 cenários reais são distintos", async () => {
    const fixtures = await listScenarioFixtures();
    const hashes = new Set(fixtures.map((fixture) => fixture.contentHash));
    expect(hashes.size).toBe(3);
  });
});

// ─── Listagem e carregamento das fixtures reais ─────────────────────────────

describe("listScenarioFixtures — corpus inicial (D4)", () => {
  it("lista exatamente 3 cenários, todos offer/1:1/pt-BR", async () => {
    const fixtures = await listScenarioFixtures();

    expect(fixtures).toHaveLength(3);
    expect(fixtures.map((fixture) => fixture.slug)).toEqual([
      "produto-oferta-logo",
      "produto-oferta-preco",
      "produto-oferta-texto-obrigatorio",
    ]);
    for (const fixture of fixtures) {
      expect(fixture.content.intent).toBe("offer");
      expect(fixture.content.format).toBe("1:1");
      expect(fixture.content.locale).toBe("pt-BR");
      expect(fixture.content.fictitious).toBe(true);
      expect(fixture.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(fixture.fixturePath).toBe(`fixtures/lab/scenarios/${fixture.slug}`);
    }
  });
});

describe("loadScenarioFixture — imagens controladas e confinamento", () => {
  it("resolve os data URLs das imagens com o MIME real", async () => {
    const loaded = await loadScenarioFixture("produto-oferta-preco");

    expect(Object.keys(loaded.imagesDataUrls).sort()).toEqual([
      "images/produto-auxiliar.jpg",
      "images/produto.jpg",
    ]);
    for (const dataUrl of Object.values(loaded.imagesDataUrls)) {
      expect(dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    }
    expect(loaded.logoDataUrl).toBeNull();
  });

  it("resolve o logo controlado como PNG no cenário com logo", async () => {
    const loaded = await loadScenarioFixture("produto-oferta-logo");

    expect(loaded.logoDataUrl).not.toBeNull();
    expect(loaded.logoDataUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(loaded.content.identity).toEqual({ state: "logo", logoPath: "images/logo.png" });
  });

  it("mapeia a fixture de texto obrigatório para brief/contexto coerentes", async () => {
    const loaded = await loadScenarioFixture("produto-oferta-texto-obrigatorio");
    const brief = mapScenarioToCampaignBrief(loaded.content, loaded.imagesDataUrls);
    const resolved = mapScenarioToResolvedContext(
      loaded.content,
      loaded.imagesDataUrls,
      loaded.logoDataUrl,
    );

    expect(brief.commercial.validity?.enabled).toBe(true);
    expect(brief.commercial.legalNotice?.enabled).toBe(true);
    expect(brief.commercial.legalNotice?.text).toContain(ILLUSTRATIVE_NOTICE_TEXT);
    expect(brief.media.images.filter((image) => image.role === "primary")).toHaveLength(1);
    expect(resolved.identity).toEqual({ state: "text_only", imageUrl: null, directive: "" });
    expect(resolved.campaignInput.inputValidationOverride).toEqual({
      productImageCheck: "brief_review_confirmed",
    });
  });

  it("recusa slug com path traversal (invalid_scenario_path)", async () => {
    await expect(loadScenarioFixture("../../etc")).rejects.toThrowError("invalid_scenario_path");
    await expect(loadScenarioFixture("..")).rejects.toThrowError("invalid_scenario_path");
    await expect(loadScenarioFixture("Slug")).rejects.toThrowError("invalid_scenario_path");
  });

  it("recusa slug válido sem fixture (scenario_not_found)", async () => {
    await expect(loadScenarioFixture("cenario-inexistente")).rejects.toThrowError(
      "scenario_not_found",
    );
  });
});

// ─── Materialização idempotente ─────────────────────────────────────────────

describe("materializeScenarios — idempotência e imutabilidade (D4)", () => {
  it("primeira execução cria 3 versões e nenhuma é pulada", async () => {
    const store = new FakeScenarioStore();
    const result = await materializeScenarios(store);

    expect(result).toEqual({ created: 3, skipped: 0 });
    expect(store.scenarios.size).toBe(3);
    for (const scenario of store.scenarios.values()) {
      expect(scenario.status).toBe("active");
      expect(scenario.currentVersion).toBe(1);
    }
    expect(store.versionCount("produto-oferta-preco")).toBe(1);
    expect(store.versionCount("produto-oferta-logo")).toBe(1);
    expect(store.versionCount("produto-oferta-texto-obrigatorio")).toBe(1);
  });

  it("segunda execução não cria versão nova (created 0)", async () => {
    const store = new FakeScenarioStore();
    await materializeScenarios(store);

    const second = await materializeScenarios(store);

    expect(second).toEqual({ created: 0, skipped: 3 });
    expect(store.scenarios.size).toBe(3);
    for (const slug of store.scenarios.keys()) {
      expect(store.versionCount(slug)).toBe(1);
    }
  });

  it("cria nova versão (max + 1) quando o content_hash muda, preservando a anterior", async () => {
    const store = new FakeScenarioStore();
    await materializeScenarios(store);

    // Simula mudança de conteúdo: a versão 1 registrada deixa de casar o hash.
    const target = store.scenarios.get("produto-oferta-preco");
    if (!target) throw new Error("fixture ausente no fake");
    const versions = store.versions.get(target.id);
    if (!versions) throw new Error("versões ausentes no fake");
    versions[0].contentHash = "hash-divergente";

    const result = await materializeScenarios(store);

    expect(result).toEqual({ created: 1, skipped: 2 });
    const after = store.versions.get(target.id) ?? [];
    expect(after).toHaveLength(2);
    // Versão anterior preservada (imutabilidade — nunca sobrescrita).
    expect(after[0].version).toBe(1);
    expect(after[0].contentHash).toBe("hash-divergente");
    // Nova versão = max + 1, com o hash real da fixture.
    expect(after[1].version).toBe(2);
    expect(after[1].contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(after[1].contentHash).not.toBe("hash-divergente");
    expect(store.scenarios.get("produto-oferta-preco")?.currentVersion).toBe(2);
  });

  it("grava fixture_path relativo e notes em cada versão criada", async () => {
    const store = new FakeScenarioStore();
    await materializeScenarios(store);

    const scenario = store.scenarios.get("produto-oferta-logo");
    if (!scenario) throw new Error("fixture ausente no fake");
    const versions = store.versions.get(scenario.id) ?? [];

    expect(versions).toHaveLength(1);
    expect(versions[0].fixturePath).toBe("fixtures/lab/scenarios/produto-oferta-logo");
    expect(versions[0].notes).toContain("F48.1");
    expect(versions[0].content.slug).toBe("produto-oferta-logo");
  });
});
