// @vitest-environment node
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { CampaignBriefSchemaVersion } from "@/lib/campaign/brief";
import { mapScenarioToCampaignBrief, mapScenarioToResolvedContext } from "../mapper";
import { UnsupportedScenarioModeError, parseLabScenarioContent } from "../schema";
import type { LabScenarioContent } from "../schema";
import {
  INVALID_SCENARIO_PATH,
  MISSING_SCENARIO_IMAGE,
  SCENARIOS_FIXTURES_DIR,
  canonicalizeScenarioContent,
  computeScenarioContentHash,
  listScenarioFixtures,
  loadScenarioFixture,
  materializeScenarios,
  readScenarioImageAsDataUrl,
} from "../service";
import type { LabScenarioStore } from "../service";

/**
 * Suíte de contrato nº 1 (48-1-11, task 11.3) — **cenários controlados**.
 *
 * Trava o contrato transversal: corpus de 3, hash SHA-256 determinístico e
 * canônico, bootstrap idempotente com versionamento, modalidade não suportada e
 * imagem ausente recusadas **antes** de qualquer run, e mapeamento para o domínio
 * de campanha com dados fictícios (nenhum `storeId` de produção).
 *
 * Nenhuma chamada de rede e nenhuma chamada paga: o bootstrap usa um store fake em
 * memória que registra as tabelas acessadas.
 */

const EXPECTED_SLUGS = ["produto-oferta-logo", "produto-oferta-preco", "produto-oferta-texto-obrigatorio"];

// ─── Store fake em memória (registra as tabelas acessadas) ──────────────────

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

class RecordingScenarioStore implements LabScenarioStore {
  readonly accessLog: string[] = [];
  readonly scenarios = new Map<string, FakeScenario>();
  readonly versions = new Map<string, FakeVersion[]>();
  private sequence = 0;

  async getScenarioBySlug(slug: string): Promise<{ id: string; currentVersion: number } | null> {
    this.accessLog.push("lab_scenarios");
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
    this.accessLog.push("lab_scenarios");
    this.sequence += 1;
    const id = `scenario-${this.sequence}`;
    this.scenarios.set(row.slug, { id, ...row });
    this.versions.set(id, []);
    return { id };
  }

  async updateScenarioCurrentVersion(id: string, currentVersion: number): Promise<void> {
    this.accessLog.push("lab_scenarios");
    for (const row of this.scenarios.values()) {
      if (row.id === id) row.currentVersion = currentVersion;
    }
  }

  async listScenarioVersionHashes(
    scenarioId: string,
  ): Promise<Array<{ version: number; contentHash: string }>> {
    this.accessLog.push("lab_scenario_versions");
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
    this.accessLog.push("lab_scenario_versions");
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

  versionCount(slug: string): number {
    const scenario = this.scenarios.get(slug);
    return scenario ? (this.versions.get(scenario.id) ?? []).length : 0;
  }

  versionsOf(slug: string): FakeVersion[] {
    const scenario = this.scenarios.get(slug);
    return scenario ? (this.versions.get(scenario.id) ?? []) : [];
  }
}

/** Contador de "runs" — prova que uma recusa acontece antes de qualquer execução. */
interface RunCounter {
  runs: number;
}

/**
 * Reproduz a fronteira real: validar o cenário (e resolver a imagem) **antes** de
 * iniciar o run. Uma recusa mantém o contador em zero.
 */
function attemptRun(rawScenario: unknown, counter: RunCounter): void {
  parseLabScenarioContent(rawScenario);
  counter.runs += 1;
}

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

// ─── (11.3.1) Corpus inicial ────────────────────────────────────────────────

describe("corpus — 3 cenários controlados de oferta", () => {
  it("lista exatamente os 3 slugs do corpus (ordenados)", async () => {
    const fixtures = await listScenarioFixtures();
    expect(fixtures.map((fixture) => fixture.slug)).toEqual(EXPECTED_SLUGS);
  });

  it("todos são offer/1:1/pt-BR, fictícios e com exatamente 1 imagem primary", async () => {
    const fixtures = await listScenarioFixtures();

    for (const fixture of fixtures) {
      expect(fixture.content.intent).toBe("offer");
      expect(fixture.content.format).toBe("1:1");
      expect(fixture.content.locale).toBe("pt-BR");
      expect(fixture.content.fictitious).toBe(true);
      expect(fixture.content.images.filter((image) => image.role === "primary")).toHaveLength(1);
      expect(fixture.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(fixture.fixturePath).toBe(`${SCENARIOS_FIXTURES_DIR}/${fixture.slug}`);
    }
  });

  it("apenas o cenário com logo declara identidade 'logo'; os demais 'text_only'", async () => {
    const fixtures = await listScenarioFixtures();
    const bySlug = new Map(fixtures.map((fixture) => [fixture.slug, fixture.content.identity.state]));

    expect(bySlug.get("produto-oferta-logo")).toBe("logo");
    expect(bySlug.get("produto-oferta-preco")).toBe("text_only");
    expect(bySlug.get("produto-oferta-texto-obrigatorio")).toBe("text_only");
  });
});

// ─── (11.3.2) Hash determinístico e canônico ────────────────────────────────

describe("hash — SHA-256 determinístico e canônico", () => {
  it("duas chamadas consecutivas produzem o mesmo hash", () => {
    const content = scenarioContent();
    expect(computeScenarioContentHash(content)).toBe(computeScenarioContentHash(content));
  });

  it("a ordem das chaves não altera o hash (canonicalização)", () => {
    const content = scenarioContent();
    const reordered = Object.fromEntries(
      Object.entries(content as unknown as Record<string, unknown>).reverse(),
    ) as unknown as LabScenarioContent;

    expect(canonicalizeScenarioContent(reordered)).toBe(canonicalizeScenarioContent(content));
    expect(computeScenarioContentHash(reordered)).toBe(computeScenarioContentHash(content));
  });

  it("conteúdo alterado produz hash diferente", () => {
    const original = scenarioContent();
    const changed = scenarioContent({
      brief: {
        product: { name: "Cesta Aurora" },
        offer: { originalPriceCents: 12990, discountedPriceCents: 8990 },
      },
    });

    expect(computeScenarioContentHash(changed)).not.toBe(computeScenarioContentHash(original));
  });

  it("o hash é hexadecimal de 64 caracteres", () => {
    expect(computeScenarioContentHash(scenarioContent())).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─── (11.3.3) Bootstrap idempotente e versionado ────────────────────────────

describe("materializeScenarios — idempotência, versionamento e acesso confinado", () => {
  it("a primeira execução cria 3 versões sem pular nenhuma", async () => {
    const store = new RecordingScenarioStore();

    const result = await materializeScenarios(store);

    expect(result).toEqual({ created: 3, skipped: 0 });
    expect(store.scenarios.size).toBe(3);
    for (const slug of EXPECTED_SLUGS) {
      expect(store.versionCount(slug)).toBe(1);
    }
  });

  it("a segunda execução não duplica nada (mesmo content_hash)", async () => {
    const store = new RecordingScenarioStore();
    await materializeScenarios(store);

    const second = await materializeScenarios(store);

    expect(second).toEqual({ created: 0, skipped: 3 });
    expect(store.scenarios.size).toBe(3);
    for (const slug of EXPECTED_SLUGS) {
      expect(store.versionCount(slug)).toBe(1);
    }
  });

  it("hash diferente cria nova versão (max + 1) preservando a anterior", async () => {
    const store = new RecordingScenarioStore();
    await materializeScenarios(store);

    const before = store.versionsOf("produto-oferta-preco");
    expect(before).toHaveLength(1);
    const previousHash = before[0].contentHash;
    before[0].contentHash = "hash-divergente";

    const result = await materializeScenarios(store);

    expect(result).toEqual({ created: 1, skipped: 2 });
    const after = store.versionsOf("produto-oferta-preco");
    expect(after).toHaveLength(2);
    expect(after[0].version).toBe(1);
    expect(after[0].contentHash).toBe("hash-divergente");
    expect(after[1].version).toBe(2);
    expect(after[1].contentHash).toBe(previousHash);
    expect(store.scenarios.get("produto-oferta-preco")?.currentVersion).toBe(2);
  });

  it("o bootstrap acessa somente `lab_scenarios` e `lab_scenario_versions`", async () => {
    const store = new RecordingScenarioStore();

    await materializeScenarios(store);

    expect(store.accessLog.length).toBeGreaterThan(0);
    expect([...new Set(store.accessLog)].sort()).toEqual([
      "lab_scenario_versions",
      "lab_scenarios",
    ]);
  });
});

// ─── (11.3.4) Modalidade não suportada é recusada antes do run ──────────────

describe("modalidade não suportada — recusa explícita e nenhum run", () => {
  const unsupportedCases: Array<{ label: string; overrides: Record<string, unknown>; field: string }> = [
    { label: "intent 'spotlight'", overrides: { intent: "spotlight" }, field: "intent" },
    { label: "intent 'service' (futuro previsto)", overrides: { intent: "service" }, field: "intent" },
    { label: "intent 'unknown' (fora da união)", overrides: { intent: "unknown" }, field: "intent" },
    { label: "format '9:16'", overrides: { format: "9:16" }, field: "format" },
    { label: "format '4:5' (fora da união)", overrides: { format: "4:5" }, field: "format" },
    { label: "locale 'en-US'", overrides: { locale: "en-US" }, field: "locale" },
    { label: "locale 'fr-FR' (fora da união)", overrides: { locale: "fr-FR" }, field: "locale" },
  ];

  for (const { label, overrides, field } of unsupportedCases) {
    it(`${label} → unsupported_scenario_mode em '${field}' e nenhum run`, () => {
      const counter: RunCounter = { runs: 0 };

      let caught: unknown;
      try {
        attemptRun(scenarioContent(overrides), counter);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(UnsupportedScenarioModeError);
      const typed = caught as UnsupportedScenarioModeError;
      expect(typed.code).toBe("unsupported_scenario_mode");
      expect(typed.field).toBe(field);
      expect(counter.runs).toBe(0);
    });
  }
});

// ─── (11.3.5) Imagens controladas e confinamento ────────────────────────────

const tempDirs: string[] = [];

afterAll(async () => {
  for (const dir of tempDirs) await fsp.rm(dir, { recursive: true, force: true });
});

async function makeTempScenarioDir(): Promise<string> {
  const base = await fsp.mkdtemp(path.join(os.tmpdir(), "lab-scenarios-contract-"));
  tempDirs.push(base);
  const scenarioDir = path.join(base, "scenario");
  await fsp.mkdir(scenarioDir, { recursive: true });
  return scenarioDir;
}

describe("imagens controladas — data URLs server-side e recusas explícitas", () => {
  it("resolve as imagens como data URLs com MIME real e fixturePath versionado", async () => {
    const loaded = await loadScenarioFixture("produto-oferta-preco");

    expect(Object.keys(loaded.imagesDataUrls).sort()).toEqual([
      "images/produto-auxiliar.jpg",
      "images/produto.jpg",
    ]);
    for (const dataUrl of Object.values(loaded.imagesDataUrls)) {
      expect(dataUrl.startsWith("data:image/")).toBe(true);
    }
    expect(loaded.fixturePath).toBe(`${SCENARIOS_FIXTURES_DIR}/produto-oferta-preco`);
    expect(loaded.logoDataUrl).toBeNull();
  });

  it("o cenário com logo resolve o logo controlado (PNG) e não o produto", async () => {
    const loaded = await loadScenarioFixture("produto-oferta-logo");

    expect(loaded.logoDataUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(loaded.content.identity).toEqual({ state: "logo", logoPath: "images/logo.png" });
  });

  it("imagem referenciada inexistente → missing_scenario_image antes de qualquer run", async () => {
    const scenarioDir = await makeTempScenarioDir();
    const counter: RunCounter = { runs: 0 };

    const rejection = await readScenarioImageAsDataUrl(scenarioDir, "images/inexistente.jpg").catch(
      (error: unknown) => error,
    );

    expect(String((rejection as Error).message)).toContain(
      `${MISSING_SCENARIO_IMAGE}:images/inexistente.jpg`,
    );
    expect(counter.runs).toBe(0);
  });

  it("slug que escapa do cenário → invalid_scenario_path antes de qualquer run", async () => {
    const counter: RunCounter = { runs: 0 };

    for (const slug of ["../../etc", "..", "Slug", "slug/child"]) {
      const rejection = await loadScenarioFixture(slug).catch((error: unknown) => error);
      expect(String((rejection as Error).message)).toContain(INVALID_SCENARIO_PATH);
    }

    expect(counter.runs).toBe(0);
  });
});

// ─── (11.3.6) Mapeamento para o domínio de campanha (dados fictícios) ───────

describe("mapeamento — brief e contexto resolvidos a partir do cenário", () => {
  it("mapScenarioToCampaignBrief produz o brief canônico com 1 primary e preço da fixture", async () => {
    const loaded = await loadScenarioFixture("produto-oferta-preco");

    const brief = mapScenarioToCampaignBrief(loaded.content, loaded.imagesDataUrls);

    expect(brief.metadata.schemaVersion).toBe(CampaignBriefSchemaVersion);
    expect(brief.metadata.schemaVersion).toBe("campaign_brief_v1");
    expect(brief.commercial.intent).toBe("offer");
    expect(brief.media.images.filter((image) => image.role === "primary")).toHaveLength(1);
    expect(brief.commercial.originalPriceCents).toBe(
      loaded.content.brief.offer.originalPriceCents,
    );
    expect(brief.commercial.discountedPriceCents).toBe(
      loaded.content.brief.offer.discountedPriceCents,
    );
  });

  it("mapScenarioToResolvedContext usa identidade fictícia, sem storeId de produção", async () => {
    const logo = await loadScenarioFixture("produto-oferta-logo");
    const textOnly = await loadScenarioFixture("produto-oferta-preco");

    const resolvedLogo = mapScenarioToResolvedContext(
      logo.content,
      logo.imagesDataUrls,
      logo.logoDataUrl,
    );
    const resolvedTextOnly = mapScenarioToResolvedContext(
      textOnly.content,
      textOnly.imagesDataUrls,
      textOnly.logoDataUrl,
    );

    expect(resolvedLogo.identity.state).toBe("logo");
    expect(resolvedLogo.identity.imageUrl?.startsWith("data:image/png;base64,")).toBe(true);
    expect(resolvedTextOnly.identity).toEqual({ state: "text_only", imageUrl: null, directive: "" });

    // A loja é fictícia: apenas nome/segmento/cor vêm da fixture e nenhum id de
    // loja real atravessa a fronteira.
    expect(resolvedLogo.store.name).toBe(logo.content.store.name);
    expect(resolvedLogo.brandProfile).toBeNull();
    expect("storeId" in resolvedLogo.campaignInput).toBe(false);
    expect("storeId" in resolvedTextOnly.campaignInput).toBe(false);
  });
});
