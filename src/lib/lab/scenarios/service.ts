import "server-only";

import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";

import { SCENARIO_SLUG_PATTERN, parseLabScenarioContent } from "./schema";
import type { LabScenarioContent } from "./schema";

/**
 * Serviço dos cenários controlados do laboratório (F48.1, D4/D8/D17).
 *
 * Responsabilidades:
 *  - listar e carregar as fixtures versionadas de `fixtures/lab/scenarios/<slug>/`;
 *  - resolver os data URLs das imagens controladas **server-side** (nunca no
 *    cliente), a partir do MIME **real** detectado no binário;
 *  - calcular o `content_hash` SHA-256 do JSON **canônico** (ordenação recursiva
 *    de chaves) — determinístico e verificável no snapshot de cada run;
 *  - materializar `lab_scenarios` + `lab_scenario_versions` de forma
 *    **idempotente** e **imutável** (hash igual ⇒ nada; hash diferente ⇒ nova
 *    versão `max + 1`, jamais sobrescrevendo a anterior).
 *
 * Toda leitura de disco é confinada ao diretório de fixtures: slug whitelisted,
 * caminho resolvido verificado (inclusive após `realpath`, bloqueando symlink
 * para fora) e imagem ausente recusada antes de qualquer run.
 */

/** Diretório versionado das fixtures, relativo à raiz do projeto. */
export const SCENARIOS_FIXTURES_DIR = "fixtures/lab/scenarios";

/** Caminho de cenário/imagem que escapa do diretório permitido. */
export const INVALID_SCENARIO_PATH = "invalid_scenario_path";

/** Imagem controlada referenciada pela fixture e ausente no disco. */
export const MISSING_SCENARIO_IMAGE = "missing_scenario_image";

/** Slug válido sem fixture correspondente no corpus. */
export const SCENARIO_NOT_FOUND = "scenario_not_found";

// ─── Canonicalização + hash ──────────────────────────────────────────────────

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Ordena recursivamente as chaves de objeto; arrays preservam a ordem. */
function sortJsonValue(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map((entry) => sortJsonValue(entry));
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortJsonValue(record[key]);
    }
    return sorted;
  }
  return value as JsonValue;
}

/**
 * Serialização determinística do conteúdo do cenário: mesma informação ⇒ mesma
 * string, independentemente da ordem das chaves no arquivo de fixture.
 */
export function canonicalizeScenarioContent(content: LabScenarioContent): string {
  return JSON.stringify(sortJsonValue(content));
}

/** SHA-256 (hex) do JSON canônico — a identidade verificável da versão. */
export function computeScenarioContentHash(content: LabScenarioContent): string {
  return createHash("sha256").update(canonicalizeScenarioContent(content), "utf8").digest("hex");
}

// ─── Confinamento de caminho (anti path traversal / symlink) ─────────────────

function scenariosFixturesRoot(): string {
  return path.resolve(process.cwd(), SCENARIOS_FIXTURES_DIR);
}

/**
 * Verifica **lexicalmente** que o caminho resolvido é um descendente estrito do
 * diretório permitido. Rejeita `..`, caminho absoluto e o próprio diretório raiz.
 */
function assertWithinRoot(candidate: string, root: string, label: string): string {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${INVALID_SCENARIO_PATH}:${label}`);
  }
  return resolved;
}

/** Resolve o diretório do cenário validando slug, confinamento e symlinks. */
async function resolveScenarioDir(root: string, slug: string): Promise<string> {
  if (!SCENARIO_SLUG_PATTERN.test(slug)) {
    throw new Error(`${INVALID_SCENARIO_PATH}:${slug}`);
  }

  const candidate = assertWithinRoot(path.resolve(root, slug), root, slug);

  let realRoot: string;
  try {
    realRoot = await fsp.realpath(root);
  } catch {
    throw new Error(`${SCENARIO_NOT_FOUND}:${slug}`);
  }

  let realDir: string;
  try {
    realDir = await fsp.realpath(candidate);
  } catch {
    throw new Error(`${SCENARIO_NOT_FOUND}:${slug}`);
  }

  const relative = path.relative(realRoot, realDir);
  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${INVALID_SCENARIO_PATH}:${slug}`);
  }

  return realDir;
}

// ─── Imagens controladas → data URL ─────────────────────────────────────────

/** MIME detectado nos magic bytes do arquivo (nunca pela extensão). */
function detectImageMime(buffer: Buffer): string {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return "application/octet-stream";
}

async function readImageAsDataUrl(scenarioDir: string, imagePath: string): Promise<string> {
  const candidate = assertWithinRoot(
    path.resolve(scenarioDir, imagePath),
    scenarioDir,
    imagePath,
  );

  let buffer: Buffer;
  try {
    buffer = await fsp.readFile(candidate);
  } catch {
    throw new Error(`${MISSING_SCENARIO_IMAGE}:${imagePath}`);
  }

  // Defesa contra symlink apontando para fora do cenário.
  const [realImage, realDir] = await Promise.all([
    fsp.realpath(candidate).catch(() => candidate),
    fsp.realpath(scenarioDir).catch(() => scenarioDir),
  ]);
  const relative = path.relative(realDir, realImage);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${INVALID_SCENARIO_PATH}:${imagePath}`);
  }

  return `data:${detectImageMime(buffer)};base64,${buffer.toString("base64")}`;
}

// ─── Listagem e carregamento ────────────────────────────────────────────────

export interface ScenarioFixtureSummary {
  slug: string;
  /** Diretório absoluto resolvido da fixture. */
  dir: string;
  /** Caminho relativo versionado (`fixtures/lab/scenarios/<slug>`). */
  fixturePath: string;
  content: LabScenarioContent;
  contentHash: string;
}

export interface LoadedScenarioFixture {
  content: LabScenarioContent;
  contentHash: string;
  /** Caminho relativo versionado (`fixtures/lab/scenarios/<slug>`). */
  fixturePath: string;
  /** Data URL por `path` declarado na fixture (resolvido server-side). */
  imagesDataUrls: Record<string, string>;
  /** Data URL do logo controlado quando `identity.state === "logo"`. */
  logoDataUrl: string | null;
}

/**
 * Carrega uma fixture pelo slug: valida o schema, resolve todos os data URLs e
 * calcula o hash canônico. Imagem ausente ⇒ `missing_scenario_image:<path>` e
 * nenhum run é iniciado.
 */
export async function loadScenarioFixture(slug: string): Promise<LoadedScenarioFixture> {
  const root = scenariosFixturesRoot();
  const dir = await resolveScenarioDir(root, slug);

  let raw: string;
  try {
    raw = await fsp.readFile(path.join(dir, "scenario.json"), "utf8");
  } catch {
    throw new Error(`${SCENARIO_NOT_FOUND}:${slug}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`invalid_scenario_json:${slug}`);
  }

  const content = parseLabScenarioContent(parsed);
  if (content.slug !== slug) {
    throw new Error(`${INVALID_SCENARIO_PATH}:${slug}`);
  }

  const imagesDataUrls: Record<string, string> = {};
  for (const image of content.images) {
    imagesDataUrls[image.path] = await readImageAsDataUrl(dir, image.path);
  }

  const logoDataUrl =
    content.identity.state === "logo"
      ? await readImageAsDataUrl(dir, content.identity.logoPath)
      : null;

  return {
    content,
    contentHash: computeScenarioContentHash(content),
    fixturePath: `${SCENARIOS_FIXTURES_DIR}/${slug}`,
    imagesDataUrls,
    logoDataUrl,
  };
}

/** Lista todas as fixtures do corpus (ordenadas por slug). */
export async function listScenarioFixtures(): Promise<ScenarioFixtureSummary[]> {
  const root = scenariosFixturesRoot();

  let entries: Dirent[];
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    throw new Error(`${SCENARIO_NOT_FOUND}:${SCENARIOS_FIXTURES_DIR}`);
  }

  const slugs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const summaries: ScenarioFixtureSummary[] = [];
  for (const slug of slugs) {
    const loaded = await loadScenarioFixture(slug);
    summaries.push({
      slug,
      dir: path.resolve(root, slug),
      fixturePath: loaded.fixturePath,
      content: loaded.content,
      contentHash: loaded.contentHash,
    });
  }
  return summaries;
}

// ─── Materialização idempotente em lab_scenarios/lab_scenario_versions ──────

/**
 * Porta mínima de persistência exigida pela materialização. O bootstrap local
 * (`scripts/uat/48-local-scenarios.mjs`) implementa a mesma semântica contra o
 * Supabase; os testes usam uma implementação em memória (sem rede).
 */
export interface LabScenarioStore {
  getScenarioBySlug(slug: string): Promise<{ id: string; currentVersion: number } | null>;
  insertScenario(row: {
    slug: string;
    name: string;
    description: string | null;
    status: "active";
    currentVersion: number;
  }): Promise<{ id: string }>;
  updateScenarioCurrentVersion(id: string, currentVersion: number): Promise<void>;
  listScenarioVersionHashes(
    scenarioId: string,
  ): Promise<Array<{ version: number; contentHash: string }>>;
  insertScenarioVersion(row: {
    scenarioId: string;
    version: number;
    content: LabScenarioContent;
    contentHash: string;
    fixturePath: string;
    notes: string | null;
  }): Promise<void>;
}

export interface MaterializeScenariosResult {
  /** Versões de cenário efetivamente criadas. */
  created: number;
  /** Fixtures cujo `content_hash` já existia (nada gravado). */
  skipped: number;
}

const SCENARIO_FIXTURE_NOTES = "fixture local do laboratorio (F48.1)";

/**
 * Materializa o corpus nas tabelas `lab_scenarios`/`lab_scenario_versions`.
 *
 * Idempotente por `content_hash`: reaplicar não cria versão nova. Quando o hash
 * difere, cria a versão `max + 1` e **nunca** sobrescreve a versão existente
 * (imutabilidade — reforçada pelo trigger de banco do 48-1-01).
 */
export async function materializeScenarios(
  store: LabScenarioStore,
): Promise<MaterializeScenariosResult> {
  const fixtures = await listScenarioFixtures();

  let created = 0;
  let skipped = 0;

  for (const fixture of fixtures) {
    const existing = await store.getScenarioBySlug(fixture.slug);
    const scenarioId = existing
      ? existing.id
      : (
          await store.insertScenario({
            slug: fixture.slug,
            name: fixture.content.name,
            description: fixture.content.description ?? null,
            status: "active",
            currentVersion: 1,
          })
        ).id;

    const versions = await store.listScenarioVersionHashes(scenarioId);
    if (versions.some((version) => version.contentHash === fixture.contentHash)) {
      skipped += 1;
      continue;
    }

    const nextVersion = versions.reduce((max, version) => Math.max(max, version.version), 0) + 1;
    await store.insertScenarioVersion({
      scenarioId,
      version: nextVersion,
      content: fixture.content,
      contentHash: fixture.contentHash,
      fixturePath: fixture.fixturePath,
      notes: SCENARIO_FIXTURE_NOTES,
    });
    await store.updateScenarioCurrentVersion(scenarioId, nextVersion);
    created += 1;
  }

  return { created, skipped };
}
