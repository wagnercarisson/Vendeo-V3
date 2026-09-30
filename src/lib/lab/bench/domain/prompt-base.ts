import {
  BENCH_REGISTRY_DIMENSIONS,
  DEFAULT_BENCH_CONFIG,
  type BenchRecorteConfig,
} from "./config-registry";
import type { BenchConfig } from "./schemas";

/**
 * **Prompt-base padrão versionado e resolvido por configuração** da bancada
 * (F48.2.4, D6; spec `lab-bench-prompt-base`).
 *
 * Módulo **puro e sem IA** — sem I/O, sem variáveis de ambiente, sem provider e
 * sem client Supabase. Apenas conteúdo **estático e versionado**, chaveado pelo
 * **recorte multidimensional** (as dimensões governadas pelo
 * `config-registry.ts`). Hoje existe **somente** o perfil Oferta 1:1; outros
 * recortes futuros podem ganhar seu próprio padrão adicionando uma entrada ao
 * registry, **sem reescrever o módulo**.
 *
 * ## Conteúdo apenas complementar
 *
 * O padrão contém **somente instruções complementares** (acabamento, coerência
 * geral, restrição estética). Ele **não** repete a hierarquia comercial de oferta
 * nem a orientação de formato 1:1 — essas pertencem exclusivamente às políticas
 * (`policies/**`, D3/D4). O compositor preserva o prompt-base (padrão ou editado)
 * **integralmente** e o mantém **fora** de qualquer deduplicação (D7).
 *
 * Nenhuma geração/revisão por IA: o padrão é conteúdo estático e as edições são
 * manuais (D6).
 */

// ─── Versão estável da fase ──────────────────────────────────────────────────

/**
 * Versão estável do prompt-base padrão da fase (evidência da geração — D14).
 * Identifica o perfil Oferta 1:1 deste recorte.
 */
export const BENCH_DEFAULT_PROMPT_BASE_VERSION = "48.2.4-oferta-1-1-v1";

// ─── Tipo do padrão ──────────────────────────────────────────────────────────

/** Prompt-base padrão resolvido: versão + conteúdo efetivamente utilizado. */
export interface BenchDefaultPromptBase {
  readonly version: string;
  readonly content: string;
}

// ─── Conteúdo complementar do perfil Oferta 1:1 ──────────────────────────────

/**
 * Instruções **apenas complementares** do perfil Oferta 1:1 — acabamento,
 * coerência geral e restrição estética. Deliberadamente **não** repete a
 * hierarquia de oferta (preço/selo/validade/textos comerciais) nem o formato
 * 1:1, que vivem nas políticas.
 */
const OFERTA_1_1_PROMPT_BASE_CONTENT = [
  "Acabamento profissional e refinado, com atenção ao resultado final da peça.",
  "Composição visual coerente e equilibrada entre todos os elementos.",
  "Evitar elementos decorativos que poluam a peça ou desviem a atenção.",
  "Manter unidade estética: a peça deve parecer um trabalho único e bem resolvido.",
].join("\n");

/** Padrão do recorte Oferta 1:1 (conteúdo estático e versionado). */
export const BENCH_DEFAULT_PROMPT_BASE: BenchDefaultPromptBase = {
  version: BENCH_DEFAULT_PROMPT_BASE_VERSION,
  content: OFERTA_1_1_PROMPT_BASE_CONTENT,
};

// ─── Resolução por recorte multidimensional ──────────────────────────────────

/** Configuração aceita pela resolução: o recorte (6 dimensões) ou a config completa. */
export type BenchPromptBaseConfig = BenchRecorteConfig | BenchConfig;

/**
 * Assinatura determinística do recorte — as dimensões governadas pelo
 * `config-registry.ts`, na ordem canônica. Mesma assinatura ⇒ mesmo padrão.
 */
function recorteSignature(config: BenchPromptBaseConfig): string {
  return BENCH_REGISTRY_DIMENSIONS.map((dimension) => `${dimension}=${config[dimension]}`).join("|");
}

/**
 * Registry de prompt-base padrão, chaveado pela assinatura do recorte. Nesta fase
 * contém **apenas** o perfil Oferta 1:1 (extensível para outros recortes sem
 * reescrever o módulo).
 */
const BENCH_PROMPT_BASE_REGISTRY: ReadonlyMap<string, BenchDefaultPromptBase> = new Map([
  [recorteSignature(DEFAULT_BENCH_CONFIG), BENCH_DEFAULT_PROMPT_BASE],
]);

// ─── Erro determinístico ─────────────────────────────────────────────────────

/**
 * Lançado quando o recorte não possui prompt-base padrão registrado. Falha
 * determinística (`bench_prompt_base_not_found`) — sem fallback/improvisação.
 */
export class BenchPromptBaseError extends Error {
  readonly code = "bench_prompt_base_not_found" as const;
  readonly signature: string;

  constructor(signature: string) {
    super(`bench_prompt_base_not_found:${signature}`);
    this.name = "BenchPromptBaseError";
    this.signature = signature;
  }
}

// ─── Resolução ───────────────────────────────────────────────────────────────

/**
 * Resolve o prompt-base padrão do recorte informado. Recorte sem padrão
 * registrado ⇒ `BenchPromptBaseError` (`bench_prompt_base_not_found`).
 * Puramente determinístico e sem efeitos colaterais.
 */
export function resolveBenchDefaultPromptBase(
  config: BenchPromptBaseConfig,
): BenchDefaultPromptBase {
  const signature = recorteSignature(config);
  const base = BENCH_PROMPT_BASE_REGISTRY.get(signature);
  if (!base) throw new BenchPromptBaseError(signature);
  return base;
}
