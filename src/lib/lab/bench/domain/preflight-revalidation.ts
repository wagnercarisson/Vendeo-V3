import type { BenchExperimentalBriefing } from "./experimental-briefing";
import type { BenchIdentityReference } from "./resolve-bench-identity";
import type { BenchConfig } from "./schemas";
import { buildBrandingPromptContributions } from "./branding-prompt-mapping";
import { buildIdentityDirectionContributions } from "./identity-direction";
import { resolveBenchPromptPolicies } from "./policies/resolve-bench-prompt-policies";
import { composePromptBlocks, type BenchPromptComposition } from "./prompt-composer";

/**
 * **Revalidação server-side do preflight** da bancada (F48.2.4, D11; spec
 * `lab-bench-prompt-preflight`).
 *
 * Módulo **puro e sem IA** — sem I/O, sem variáveis de ambiente, sem provider e
 * sem client Supabase. Antes de qualquer chamada paga, o servidor:
 *
 *  1. **recompõe** o prompt a partir das entradas atuais de forma determinística
 *     (`recomposeBenchPrompt`) — o mesmo núcleo + políticas + branding mapping +
 *     orientação de identidade da composição aprovada;
 *  2. exige que o texto recomposto seja **idêntico** ao `promptCompiled` aprovado
 *     (`assertPreflightCompositionMatches`) — divergência ⇒ `approval_invalidated`;
 *  3. exige que a **evidência textual aprovada** (`policyVersions`,
 *     `promptBaseVersion`, `composerVersion` e `identityReference`) coincida,
 *     **campo a campo e sem hash persistido**, com os valores **resolvidos no
 *     servidor** (`assertPreflightEvidenceMatches`) — QUALQUER divergência ⇒
 *     `approval_invalidated` (409).
 *
 * **Separação aprovação ↔ configuração de execução (correção de UAT):** o
 * `presetId` e `modelo`/`qualidade` **NÃO** participam da composição textual e,
 * portanto, **não** integram a evidência textual nem a comparação de aprovação.
 * Eles são **configuração de execução**: validados server-side
 * (`resolveBenchPreset`/`resolveBenchConfig`) e persistidos no run
 * (`provider`/`model`/`quality`/`size`). Trocar de preset/modelo/qualidade usa o
 * **mesmo prompt aprovado byte a byte** e exige apenas **nova estimativa e nova
 * confirmação financeira** — nunca nova composição/aprovação.
 *
 * A **persistência usa sempre os valores resolvidos no servidor**
 * (`resolveServerResolvedEvidence`); a evidência do preflight do cliente serve
 * **apenas** para a comparação — nunca para persistência. Nenhuma transformação
 * ocorre após a aprovação: a revalidação compara a recomposição com o compilado
 * aprovado, e o texto enviado permanece o aprovado byte a byte.
 */

// ─── Erro determinístico (409 na rota) ───────────────────────────────────────

export type BenchPreflightRevalidationErrorCode = "approval_invalidated";

/**
 * Lançado quando a aprovação do preflight é inválida: composição divergente ou
 * qualquer campo da evidência divergente dos valores resolvidos no servidor.
 * A rota (`POST /runs`) mapeia para `409 approval_invalidated` **antes** do CAS
 * (`draft → pending`) e de qualquer chamada paga.
 */
export class BenchPreflightRevalidationError extends Error {
  readonly code: BenchPreflightRevalidationErrorCode = "approval_invalidated";
  /** Motivo determinístico (qual comparação falhou) — sem dado sensível. */
  readonly reason: string;

  constructor(reason: string) {
    super(`approval_invalidated:${reason}`);
    this.name = "BenchPreflightRevalidationError";
    this.code = "approval_invalidated";
    this.reason = reason;
  }
}

// ─── Recomposição determinística ─────────────────────────────────────────────

export interface RecomposeBenchPromptInput {
  /** Briefing experimental estruturado — entrada canônica do compositor. */
  briefing: BenchExperimentalBriefing;
  /** Prompt-base manual efetivamente usado (preservado verbatim). */
  promptBase: string;
  /** Referências de imagem do run (paths locais). */
  references?: readonly string[];
  /** Configuração multidimensional **resolvida no servidor**. */
  config: BenchConfig;
  /** Referência canônica de identidade **resolvida no servidor** (ou `null`). */
  identityReference: BenchIdentityReference | null;
}

/**
 * Recompõe o prompt determinístico a partir das entradas atuais: núcleo
 * (`composePromptBlocks`) + políticas versionadas (`resolveBenchPromptPolicies`) +
 * branding mapping (`buildBrandingPromptContributions`) + orientação de identidade
 * (`buildIdentityDirectionContributions`). Devolve a composição completa
 * (`text`/`blocks`/`composerVersion`/`policyVersions`). Pura e determinística:
 * mesma entrada ⇒ mesma saída.
 */
export function recomposeBenchPrompt(input: RecomposeBenchPromptInput): BenchPromptComposition {
  const { contributions, versions } = resolveBenchPromptPolicies(input.config);
  const branding = buildBrandingPromptContributions(input.briefing);
  const identity = buildIdentityDirectionContributions(input.identityReference);

  return composePromptBlocks({
    briefing: input.briefing,
    promptBase: input.promptBase,
    references: input.references,
    // Ordem determinística: políticas do recorte → branding → orientação de identidade.
    contributions: [...contributions, ...branding, ...identity],
    policyVersions: versions,
  });
}

// ─── Comparação da composição (texto) ────────────────────────────────────────

/**
 * Exige igualdade entre o texto recomposto e o `promptCompiled` aprovado.
 * Divergência ⇒ `approval_invalidated` (a execução é recusada antes da chamada
 * paga; composição idêntica prossegue).
 */
export function assertPreflightCompositionMatches(params: {
  recomposed: string;
  promptCompiled: string;
}): void {
  if (params.recomposed !== params.promptCompiled) {
    throw new BenchPreflightRevalidationError("composition_diverged");
  }
}

// ─── Comparação da evidência (campo a campo, sem hash persistido) ────────────

/**
 * Visão da **evidência textual** do preflight usada na comparação. Os campos são
 * os **resolvidos no servidor no momento atual** (para persistência) ou os
 * registrados na aprovação do cliente (apenas para comparação).
 *
 * **Não** inclui `presetId`/`modelo`/`qualidade`: são configuração de execução,
 * não participam da composição textual e não invalidam a aprovação.
 */
export interface BenchPreflightEvidenceView {
  policyVersions: Readonly<Record<string, string>> | null;
  promptBaseVersion: string | null;
  composerVersion: string | null;
  identityReference: BenchIdentityReference | null;
}

function versionsEqual(
  left: Readonly<Record<string, string>> | null,
  right: Readonly<Record<string, string>> | null,
): boolean {
  if (left === null || right === null) return left === right;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

function identityEquals(
  left: BenchIdentityReference | null,
  right: BenchIdentityReference | null,
): boolean {
  if (left === null || right === null) return left === right;
  return (
    left.kind === right.kind &&
    left.variantType === right.variantType &&
    left.storagePath === right.storagePath
  );
}

/**
 * Compara a **evidência textual** aprovada com os valores **resolvidos no
 * servidor** no momento atual, **campo a campo** (`policyVersions`,
 * `promptBaseVersion`, `composerVersion` e `identityReference`). QUALQUER
 * divergência ⇒ `approval_invalidated` — inclusive quando o asset de logo muda
 * mantendo `kind=logo`. **Sem hash persistido**: a comparação é entre valores já
 * existentes.
 *
 * **`presetId`/`modelo`/`qualidade` NÃO são comparados aqui** (correção de UAT):
 * são configuração de execução, validados/persistidos separadamente no run. O
 * mesmo prompt aprovado pode ser reutilizado byte a byte com outro preset/modelo,
 * exigindo apenas nova estimativa e nova confirmação financeira.
 */
export function assertPreflightEvidenceMatches(params: {
  approved: BenchPreflightEvidenceView;
  current: BenchPreflightEvidenceView;
}): void {
  const { approved, current } = params;

  if (!versionsEqual(approved.policyVersions, current.policyVersions)) {
    throw new BenchPreflightRevalidationError("policy_versions_diverged");
  }
  if (approved.promptBaseVersion !== current.promptBaseVersion) {
    throw new BenchPreflightRevalidationError("prompt_base_version_diverged");
  }
  if (approved.composerVersion !== current.composerVersion) {
    throw new BenchPreflightRevalidationError("composer_version_diverged");
  }
  if (!identityEquals(approved.identityReference, current.identityReference)) {
    throw new BenchPreflightRevalidationError("identity_reference_diverged");
  }
}

/**
 * Monta a visão da **evidência textual** a partir dos valores **resolvidos no
 * servidor**: versões das políticas e do compositor vêm da recomposição; versão
 * do prompt-base padrão e referência de identidade vêm da resolução atual do
 * servidor. É o que a rota **persiste** — nunca a evidência do cliente.
 *
 * **`presetId`/`modelo`/`qualidade` não integram esta evidência**: são
 * configuração de execução, validados/persistidos separadamente no run.
 */
export function resolveServerResolvedEvidence(params: {
  recomposition: BenchPromptComposition;
  promptBaseVersion: string | null;
  identityReference: BenchIdentityReference | null;
}): BenchPreflightEvidenceView {
  return {
    policyVersions: { ...params.recomposition.policyVersions },
    promptBaseVersion: params.promptBaseVersion,
    composerVersion: params.recomposition.composerVersion,
    identityReference: params.identityReference ? { ...params.identityReference } : null,
  };
}
