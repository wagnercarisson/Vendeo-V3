import "server-only";

import { createHash } from "node:crypto";

import { PromptLoader } from "@/lib/image-generation/prompt-loader";

/**
 * Snapshots de prompt do Laboratório de IA (F48.1, D5/D8).
 *
 * O prompt sob teste nesta fase é o diretor de arte de oferta (intent `offer`).
 * A comparação é **prompt-only**: o baseline é o conteúdo **oficial atual** do
 * arquivo versionado (`source: "official"`) e a candidata é o override enviado
 * pelo admin (`source: "override"`), congelado apenas no snapshot.
 *
 * Garantias:
 *  - **Somente leitura** do prompt oficial: nada é escrito em `prompts/`
 *    (T-48-1-27). O arquivo é lido pelo `PromptLoader` e nunca alterado.
 *  - O snapshot guarda `name`, `content` e `contentHash` (SHA-256 hex) — a
 *    identidade verificável do conteúdo congelado no run (D8).
 *  - Nenhum secret, chave ou URL entra no snapshot (D15): baseline e candidata
 *    são validados e o conteúdo sensível é **recusado** com
 *    `sensitive_prompt_content` antes de qualquer persistência — nunca
 *    sanitizado silenciosamente (sanitizar mudaria o prompt e o seu hash).
 */

/**
 * Nome do prompt oficial sob teste (intent `offer`). Constante única: qualquer
 * outro prompt é recusado pela candidata com `unsupported_prompt_under_test`.
 */
export const PROMPT_UNDER_TEST = "campaign-image-director-offer";

/** Erro determinístico para prompt fora do escopo da F48.1. */
export const UNSUPPORTED_PROMPT_UNDER_TEST = "unsupported_prompt_under_test";

export interface LabPromptSnapshot {
  name: string;
  content: string;
  contentHash: string;
  source: "official" | "override";
}

/** Baseline: conteúdo oficial atual do prompt versionado. */
export type BaselinePromptSnapshot = LabPromptSnapshot & { source: "official" };

/** Candidata: override do prompt sob teste. */
export type CandidatePromptSnapshot = LabPromptSnapshot & { source: "override" };

/** SHA-256 (hex, 64 chars) do conteúdo do prompt. */
export function computePromptContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

// ─── Recusa de conteúdo sensível (D15) ───────────────────────────────────────

/** Categorias de conteúdo sensível recusadas em qualquer snapshot de prompt. */
export const SENSITIVE_PROMPT_KINDS = ["bearer_token", "api_key", "url"] as const;
export type SensitivePromptKind = (typeof SENSITIVE_PROMPT_KINDS)[number];

/** Campo do snapshot avaliado (diagnóstico sem expor conteúdo). */
export type PromptSnapshotField = "baseline" | "candidate";

/** Código determinístico da recusa. */
export const SENSITIVE_PROMPT_CONTENT = "sensitive_prompt_content";

/**
 * Padrões de conteúdo sensível (D15). **Não** usam a flag global — o `lastIndex`
 * com estado tornaria o detector dependente da ordem das chamadas.
 */
const SENSITIVE_PROMPT_PATTERNS: ReadonlyArray<{ kind: SensitivePromptKind; pattern: RegExp }> = [
  { kind: "bearer_token", pattern: /\bbearer\s+[A-Za-z0-9._~+/-]{8,}/i },
  { kind: "api_key", pattern: /\bsk-[A-Za-z0-9_-]{8,}/ },
  { kind: "api_key", pattern: /\bAIza[A-Za-z0-9_-]{8,}/ },
  { kind: "url", pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s"')]+/i },
];

/** Detecta a categoria do conteúdo sensível, ou `null` quando o conteúdo é limpo. */
export function findSensitivePromptContent(content: string): SensitivePromptKind | null {
  for (const { kind, pattern } of SENSITIVE_PROMPT_PATTERNS) {
    if (pattern.test(content)) return kind;
  }
  return null;
}

/**
 * Recusa determinística de conteúdo sensível no snapshot (D15).
 *
 * A mensagem expõe apenas o campo e a categoria — **nunca** o conteúdo, a chave
 * ou a URL. O conteúdo **não** é sanitizado silenciosamente: alterá-lo mudaria o
 * prompt e o seu hash (o snapshot deve refletir exatamente o que foi congelado).
 */
export class SensitivePromptContentError extends Error {
  readonly code = SENSITIVE_PROMPT_CONTENT;
  readonly field: PromptSnapshotField;
  readonly kind: SensitivePromptKind;

  constructor(field: PromptSnapshotField, kind: SensitivePromptKind) {
    super(`Conteúdo sensível detectado no snapshot de prompt '${field}' (${kind})`);
    this.name = "SensitivePromptContentError";
    this.field = field;
    this.kind = kind;
  }
}

/** Lança `SensitivePromptContentError` quando o conteúdo é sensível. */
function assertPromptContentSafe(content: string, field: PromptSnapshotField): void {
  const kind = findSensitivePromptContent(content);
  if (kind) throw new SensitivePromptContentError(field, kind);
}

/**
 * Congela o baseline a partir do **conteúdo oficial atual**.
 *
 * O loader é injetável para testes; sem argumento usa o `PromptLoader` padrão
 * (diretório `prompts/` do projeto). Nenhum arquivo é escrito. O conteúdo oficial
 * também passa pela recusa de conteúdo sensível antes de virar snapshot (D15).
 */
export function buildBaselinePromptSnapshot(
  promptLoader?: PromptLoader,
): BaselinePromptSnapshot {
  const loader = promptLoader ?? new PromptLoader();
  const content = loader.load(PROMPT_UNDER_TEST);
  assertPromptContentSafe(content, "baseline");

  return {
    name: PROMPT_UNDER_TEST,
    content,
    contentHash: computePromptContentHash(content),
    source: "official",
  };
}

/**
 * Congela a candidata a partir do override do admin.
 *
 * O prompt precisa ser exatamente o prompt sob teste — um nome diferente lança
 * `unsupported_prompt_under_test:<name>` (nada é congelado silenciosamente).
 * Conteúdo com chave/token/URL lança `sensitive_prompt_content` **antes** de
 * qualquer persistência, sem sanitizar o texto (D15).
 */
export function buildCandidatePromptSnapshot(input: {
  promptName: string;
  promptContent: string;
}): CandidatePromptSnapshot {
  if (input.promptName !== PROMPT_UNDER_TEST) {
    throw new Error(`${UNSUPPORTED_PROMPT_UNDER_TEST}:${input.promptName}`);
  }
  assertPromptContentSafe(input.promptContent, "candidate");

  return {
    name: input.promptName,
    content: input.promptContent,
    contentHash: computePromptContentHash(input.promptContent),
    source: "override",
  };
}
