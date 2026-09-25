import "server-only";

import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";

import { parsePromptDiagnostics } from "./schema";
import type { LabPromptDiagnostics } from "./schema";

/**
 * Serviço do diagnóstico versionado das evidências do Diretor (F48.2.1, D3).
 *
 * Responsabilidades:
 *  - listar e carregar as versões imutáveis de
 *    `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v{N}.json`;
 *  - calcular o `contentHash` SHA-256 do JSON **canônico** (ordenação recursiva
 *    de chaves) **excluindo o próprio campo `contentHash`** (não autorreferente);
 *  - usar a maior `diagnosticVersion` disponível e expor a versão usada para
 *    registro no experimento.
 *
 * Toda leitura de disco é confinada ao diretório de fixtures: o nome do arquivo
 * é validado por padrão, o caminho resolvido é verificado (inclusive após
 * `realpath`, bloqueando symlink para fora) e um escape é recusado com
 * `invalid_diagnostics_path` antes de qualquer leitura (T-48-2-1-09).
 */

/** Diretório versionado das fixtures de diagnóstico, relativo à raiz do projeto. */
export const DIAGNOSTICS_FIXTURES_DIR = "fixtures/lab/diagnostics";

/** Diretório da evidência F37 (uma versão por arquivo). */
export const DIAGNOSTICS_F37_DIR = "fixtures/lab/diagnostics/f37";

/** Nome canônico de cada versão: `f37-prompt-diagnostics.v{N}.json`. */
export const DIAGNOSTICS_FILE_PATTERN = /^f37-prompt-diagnostics\.v(\d+)\.json$/;

/** Caminho de diagnóstico que escapa do diretório permitido. */
export const INVALID_DIAGNOSTICS_PATH = "invalid_diagnostics_path";

/** Versão de diagnóstico válida sem arquivo correspondente. */
export const PROMPT_DIAGNOSTICS_NOT_FOUND = "prompt_diagnostics_not_found";

/** `contentHash` gravado diverge do recalculado (arquivo alterado). */
export const DIAGNOSTICS_HASH_MISMATCH = "diagnostics_hash_mismatch";

// ─── Canonicalização + hash (não autorreferente) ─────────────────────────────

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
 * Remove o campo `contentHash` do diagnóstico antes de canonicalizar — o hash
 * **não é autorreferente**: o próprio campo nunca entra no cálculo.
 */
function omitContentHash(content: LabPromptDiagnostics): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...content };
  delete clone.contentHash;
  return clone;
}

/**
 * Serialização determinística do diagnóstico: mesma informação ⇒ mesma string,
 * independentemente da ordem das chaves no arquivo, **sem** o próprio
 * `contentHash`.
 */
export function canonicalizeDiagnostics(content: LabPromptDiagnostics): string {
  return JSON.stringify(sortJsonValue(omitContentHash(content)));
}

/** SHA-256 (hex) do JSON canônico excluindo o campo `contentHash`. */
export function computeDiagnosticsContentHash(content: LabPromptDiagnostics): string {
  return createHash("sha256").update(canonicalizeDiagnostics(content), "utf8").digest("hex");
}

/**
 * Confere o `contentHash` gravado contra o recalculado. Qualquer divergência
 * (um byte alterado no conteúdo) ⇒ `diagnostics_hash_mismatch`.
 */
export function verifyDiagnosticsHash(content: LabPromptDiagnostics): void {
  const computed = computeDiagnosticsContentHash(content);
  if (computed !== content.contentHash) {
    throw new Error(`${DIAGNOSTICS_HASH_MISMATCH}:v${content.diagnosticVersion}`);
  }
}

// ─── Confinamento de caminho (anti path traversal / symlink) ─────────────────

function diagnosticsRoot(): string {
  return path.resolve(process.cwd(), DIAGNOSTICS_FIXTURES_DIR);
}

/**
 * Verifica **lexicalmente** que o caminho resolvido é um descendente estrito do
 * diretório permitido. Rejeita `..`, caminho absoluto e o próprio diretório raiz.
 */
function assertWithinRoot(candidate: string, root: string, label: string): string {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${INVALID_DIAGNOSTICS_PATH}:${label}`);
  }
  return resolved;
}

/** Resolve o diretório F37 validando confinamento e symlinks. */
async function resolveF37Dir(): Promise<string> {
  const root = diagnosticsRoot();
  const candidate = assertWithinRoot(path.resolve(root, "f37"), root, "f37");

  let realRoot: string;
  try {
    realRoot = await fsp.realpath(root);
  } catch {
    throw new Error(`${PROMPT_DIAGNOSTICS_NOT_FOUND}:${DIAGNOSTICS_F37_DIR}`);
  }

  let realDir: string;
  try {
    realDir = await fsp.realpath(candidate);
  } catch {
    throw new Error(`${PROMPT_DIAGNOSTICS_NOT_FOUND}:${DIAGNOSTICS_F37_DIR}`);
  }

  const relative = path.relative(realRoot, realDir);
  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${INVALID_DIAGNOSTICS_PATH}:f37`);
  }

  return realDir;
}

/**
 * Resolve o arquivo de uma versão validando o padrão do nome, o confinamento e
 * symlinks — `realpath` é resolvido **antes** de qualquer leitura (T-48-2-1-09).
 */
async function resolveDiagnosticsFile(fileName: string): Promise<string> {
  if (!DIAGNOSTICS_FILE_PATTERN.test(fileName)) {
    throw new Error(`${INVALID_DIAGNOSTICS_PATH}:${fileName}`);
  }

  const dir = await resolveF37Dir();
  const candidate = assertWithinRoot(path.resolve(dir, fileName), dir, fileName);

  let realFile: string;
  let realDir: string;
  try {
    [realFile, realDir] = await Promise.all([fsp.realpath(candidate), fsp.realpath(dir)]);
  } catch {
    throw new Error(`${PROMPT_DIAGNOSTICS_NOT_FOUND}:${fileName}`);
  }

  const relative = path.relative(realDir, realFile);
  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${INVALID_DIAGNOSTICS_PATH}:${fileName}`);
  }

  return realFile;
}

// ─── Listagem e carregamento ────────────────────────────────────────────────

/** Nome canônico do arquivo de uma versão. */
export function diagnosticsFileName(version: number): string {
  return `f37-prompt-diagnostics.v${version}.json`;
}

/** Lista as versões disponíveis (números, ordem crescente). */
export async function listDiagnosticVersions(): Promise<number[]> {
  let dir: string;
  try {
    dir = await resolveF37Dir();
  } catch {
    return [];
  }

  let entries: Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const versions: number[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(DIAGNOSTICS_FILE_PATTERN);
    if (!match) continue;
    versions.push(Number.parseInt(match[1], 10));
  }
  return versions.sort((a, b) => a - b);
}

/**
 * Carrega uma versão pelo **nome do arquivo** (confinado ao diretório F37).
 * Usado pelos testes de path traversal e pela resolução por versão.
 */
export async function loadDiagnosticsFile(fileName: string): Promise<LabPromptDiagnostics> {
  const filePath = await resolveDiagnosticsFile(fileName);

  let raw: string;
  try {
    raw = await fsp.readFile(filePath, "utf8");
  } catch {
    throw new Error(`${PROMPT_DIAGNOSTICS_NOT_FOUND}:${fileName}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`invalid_diagnostics_json:${fileName}`);
  }

  const content = parsePromptDiagnostics(parsed);
  verifyDiagnosticsHash(content);
  return content;
}

/** Carrega uma versão específica (valida schema e hash). */
export async function loadDiagnosticsVersion(version: number): Promise<LabPromptDiagnostics> {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`${INVALID_DIAGNOSTICS_PATH}:v${version}`);
  }
  return loadDiagnosticsFile(diagnosticsFileName(version));
}

/**
 * Carrega a maior versão disponível. Ausência de qualquer versão ⇒
 * `prompt_diagnostics_not_found`.
 */
export async function loadCurrentDiagnostics(): Promise<LabPromptDiagnostics> {
  const versions = await listDiagnosticVersions();
  if (versions.length === 0) {
    throw new Error(`${PROMPT_DIAGNOSTICS_NOT_FOUND}:${DIAGNOSTICS_F37_DIR}`);
  }
  const current = versions[versions.length - 1];
  return loadDiagnosticsVersion(current);
}

/** Versão e hash usados — registrados no experimento (D3). */
export async function getDiagnosticsVersionUsed(): Promise<{
  diagnosticVersion: number;
  contentHash: string;
}> {
  const current = await loadCurrentDiagnostics();
  return { diagnosticVersion: current.diagnosticVersion, contentHash: current.contentHash };
}
