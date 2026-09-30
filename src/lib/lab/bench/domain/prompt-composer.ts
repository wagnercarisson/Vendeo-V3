import type { BenchExperimentalBriefing } from "./experimental-briefing";
import type { BenchPromptContribution } from "./policies/types";

/**
 * **Núcleo** determinístico do compositor de prompt da bancada (F48.2.4, D1/D7).
 *
 * Módulo **puro e sem IA** — sem I/O, sem variáveis de ambiente, sem provider e
 * sem client Supabase. Apenas **coleta, ordena e serializa** dados estruturados
 * (briefing experimental + snapshot fiel) e as **contribuições de política**
 * recebidas, além do prompt-base manual, nos 7 blocos canônicos travados.
 *
 * ## Separação núcleo × políticas (D1)
 *
 * O núcleo **não contém regra alguma específica de dimensão** (intenção, formato,
 * tipo de conteúdo, estrutura ou tema) — não emite valores crus de configuração.
 * As regras de dimensão vivem **apenas** nas políticas versionadas
 * (`policies/**`), que produzem as contribuições consumidas aqui. Acrescentar
 * dimensões futuras = adicionar políticas + habilitar valores, **sem alterar o
 * núcleo**.
 *
 * Garantias (spec `lab-bench-prompt-preflight` + D19):
 *  - **não** reescreve o prompt-base, **não** interpreta criatividade, **não**
 *    avalia qualidade, **não** faz deduplicação semântica, **não** chama provider
 *    e **não** promove nada;
 *  - **um dado → um bloco**; **blocos vazios são omitidos**; a ordem canônica é
 *    travada;
 *  - o prompt-base é incluído **verbatim** em `[INSTRUÇÕES DO PROMPT-BASE]` —
 *    nenhuma filtragem/reescrita lexical (palavras legítimas do operador são
 *    preservadas) e ele fica **fora** de qualquer deduplicação;
 *  - os rótulos fixos e os templates dos blocos **gerados** não introduzem
 *    contexto de laboratório, experimento, baseline, comparação de variantes ou
 *    avaliação: a proibição incide sobre a **origem** do conteúdo gerado pelo
 *    compositor, **não** é blacklist lexical sobre o prompt completo;
 *  - determinístico: mesma entrada → mesma saída (inclui `composerVersion` e
 *    `policyVersions`).
 */

/** Versão estática do compositor — evidência do preflight (D20). */
export const COMPOSER_VERSION = "48.2.4-prompt-composer-v1";

// ─── Blocos canônicos (travados — D19) ───────────────────────────────────────

export const PROMPT_BLOCK_LABELS = {
  identity: "IDENTIDADE E DIREÇÃO VISUAL",
  typography: "DIREÇÃO TIPOGRÁFICA",
  product: "PRODUTO E IMAGENS DE REFERÊNCIA",
  commercial: "CONDIÇÕES COMERCIAIS",
  intent: "INTENÇÃO E FORMATO",
  promptBase: "INSTRUÇÕES DO PROMPT-BASE",
  constraints: "RESTRIÇÕES E TEXTOS OBRIGATÓRIOS",
} as const;

export type BenchPromptBlockLabel =
  (typeof PROMPT_BLOCK_LABELS)[keyof typeof PROMPT_BLOCK_LABELS];

/** Ordem canônica travada dos blocos. */
export const PROMPT_BLOCK_ORDER: readonly BenchPromptBlockLabel[] = [
  PROMPT_BLOCK_LABELS.identity,
  PROMPT_BLOCK_LABELS.typography,
  PROMPT_BLOCK_LABELS.product,
  PROMPT_BLOCK_LABELS.commercial,
  PROMPT_BLOCK_LABELS.intent,
  PROMPT_BLOCK_LABELS.promptBase,
  PROMPT_BLOCK_LABELS.constraints,
];

// ─── Entrada / saída ─────────────────────────────────────────────────────────

export interface BenchPromptCompositionInput {
  /** Briefing experimental estruturado — entrada canônica do compositor. */
  briefing: BenchExperimentalBriefing;
  /** Prompt-base manual do operador — preservado **verbatim**. */
  promptBase: string;
  /** Referências de imagem anexadas ao run (paths locais). Opcional. */
  references?: readonly string[];
  /**
   * Contribuições resolvidas das políticas versionadas (via
   * `resolveBenchPromptPolicies`). O núcleo apenas as mescla por bloco.
   */
  contributions?: readonly BenchPromptContribution[];
  /** Versões das políticas resolvidas (evidência). Opcional. */
  policyVersions?: Readonly<Record<string, string>>;
}

export interface BenchPromptComposition {
  /** Texto completo do prompt compilado (blocos não vazios, na ordem canônica). */
  text: string;
  /** Blocos estruturados utilizados (rótulo → conteúdo, sem os vazios). */
  blocks: Record<string, string>;
  /** Versão estática do compositor (evidência). */
  composerVersion: string;
  /** Versões das políticas resolvidas (evidência). */
  policyVersions: Readonly<Record<string, string>>;
}

// ─── Helpers de serialização (dados não-dimensionais) ────────────────────────

/** Acrescenta `Rótulo: valor` quando o valor (trimado) é não vazio. */
function pushLine(lines: string[], label: string, value: string | null | undefined): void {
  if (value === null || value === undefined) return;
  const trimmed = value.trim();
  if (trimmed.length === 0) return;
  lines.push(`${label}: ${trimmed}`);
}

function productLines(
  briefing: BenchExperimentalBriefing,
  references: readonly string[] | undefined,
): string[] {
  const lines: string[] = [];
  pushLine(lines, "Produto", briefing.product.name);
  pushLine(lines, "Descrição", briefing.product.description);
  if (briefing.commercial.preserveImageContext) {
    lines.push("Preservar imagem original: sim");
  }
  if (references && references.length > 0) {
    lines.push(`Imagens de referência: ${references.length}`);
  }
  return lines;
}

function commercialLines(briefing: BenchExperimentalBriefing): string[] {
  const lines: string[] = [];
  pushLine(lines, "Preço original", briefing.commercial.originalPriceText);
  pushLine(lines, "Preço promocional", briefing.commercial.discountedPriceText);
  pushLine(lines, "Selo", briefing.commercial.badge);
  pushLine(lines, "Validade", briefing.commercial.validity);
  return lines;
}

/**
 * Prompt-base manual — preservado **verbatim** (nenhuma filtragem/reescrita).
 * O compositor **não** aplica blacklist lexical sobre este texto: palavras
 * legítimas do operador (ex.: "teste", "comparação", "avaliação") permanecem
 * intactas — a verificação de contexto experimental é **por origem** (blocos
 * gerados), nunca sobre o prompt-base. Bloco omitido apenas quando o prompt-base
 * é vazio/em branco.
 */
function promptBaseLines(promptBase: string): string[] {
  if (promptBase.trim().length === 0) return [];
  return [promptBase];
}

function constraintsLines(briefing: BenchExperimentalBriefing): string[] {
  const lines: string[] = [];
  pushLine(lines, "Informações obrigatórias na arte", briefing.constraints.mandatoryArtworkText);
  return lines;
}

// ─── Composição ──────────────────────────────────────────────────────────────

/**
 * Compõe os blocos canônicos do prompt, omitindo os vazios e preservando o
 * prompt-base verbatim. Mescla as **contribuições de política** por bloco na
 * ordem canônica travada. Determinístico e sem efeitos colaterais.
 */
export function composePromptBlocks(input: BenchPromptCompositionInput): BenchPromptComposition {
  const { briefing, promptBase, references, contributions = [], policyVersions = {} } = input;

  // Linhas de **dados** (não-dimensionais) produzidas pelo núcleo.
  const dataLines: Partial<Record<BenchPromptBlockLabel, string[]>> = {
    [PROMPT_BLOCK_LABELS.product]: productLines(briefing, references),
    [PROMPT_BLOCK_LABELS.commercial]: commercialLines(briefing),
    [PROMPT_BLOCK_LABELS.promptBase]: promptBaseLines(promptBase),
    [PROMPT_BLOCK_LABELS.constraints]: constraintsLines(briefing),
  };

  // Linhas de **política**, agregadas por bloco na ordem recebida.
  const contributionLines = new Map<BenchPromptBlockLabel, string[]>();
  for (const contribution of contributions) {
    const existing = contributionLines.get(contribution.block) ?? [];
    existing.push(...contribution.lines);
    contributionLines.set(contribution.block, existing);
  }

  const blocks: Record<string, string> = {};
  const parts: string[] = [];

  for (const label of PROMPT_BLOCK_ORDER) {
    const lines = [...(dataLines[label] ?? []), ...(contributionLines.get(label) ?? [])];
    const content = lines.join("\n");
    if (content.length === 0) continue;
    blocks[label] = content;
    parts.push(`[${label}]\n${content}`);
  }

  return { text: parts.join("\n\n"), blocks, composerVersion: COMPOSER_VERSION, policyVersions };
}

/**
 * Serializa o prompt compilado em um único texto estável (blocos canônicos na
 * ordem travada). Nenhuma transformação após a composição.
 */
export function composePrompt(input: BenchPromptCompositionInput): string {
  return composePromptBlocks(input).text;
}
