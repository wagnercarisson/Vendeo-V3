import { sanitizePromptText } from "@/lib/image-generation/services/art-director-briefing";

import type { BenchCampaignSnapshot } from "./campaign-snapshot";
import type { BenchExperimentalBriefing } from "./experimental-briefing";

/**
 * Compositor determinístico mínimo do prompt da bancada (F48.2.3, D17/D19/D20).
 *
 * Módulo **puro e sem IA** — sem I/O, sem variáveis de ambiente, sem provider e
 * sem client Supabase. Apenas **serializa** dados estruturados (briefing
 * experimental do Plano 05 + snapshot fiel do Plano 04) e o prompt-base manual
 * em blocos canônicos travados.
 *
 * Garantias (spec `lab-bench-prompt-preflight` + D19):
 *  - **não** reescreve o prompt-base, **não** interpreta criatividade, **não**
 *    avalia qualidade, **não** faz deduplicação semântica, **não** chama
 *    provider e **não** promove nada;
 *  - **um dado → um bloco** (sem repetição deliberada do mesmo campo em vários
 *    blocos); **blocos vazios são omitidos**;
 *  - o prompt-base é incluído **verbatim** em `[INSTRUÇÕES DO PROMPT-BASE]` —
 *    nenhuma filtragem/reescrita lexical (palavras legítimas como "teste",
 *    "comparação" ou "avaliação" fornecidas pelo operador são preservadas);
 *  - os rótulos fixos e os templates dos blocos **gerados** não introduzem
 *    contexto de laboratório, experimento, baseline, comparação de variantes ou
 *    avaliação, nem um bloco dedicado ao objetivo do experimento: a proibição
 *    incide sobre a **origem** do conteúdo gerado pelo compositor, **não** é uma
 *    blacklist lexical sobre o prompt completo e nunca filtra o prompt-base do
 *    operador;
 *  - `typography_direction` integra `[DIREÇÃO TIPOGRÁFICA]`;
 *    `preserveImageContext` integra `[PRODUTO E IMAGENS DE REFERÊNCIA]`;
 *  - determinístico: mesma entrada → mesma saída.
 *
 * Este compositor **não** substitui o futuro template criativo de Oferta 1:1
 * (F48.2.4); é uma primeira versão avaliável, não arquitetura definitiva.
 */

/** Versão estática do compositor — evidência do preflight (D20). */
export const COMPOSER_VERSION = "48.2.3-prompt-composer-v1";

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
  /** Briefing experimental estruturado (Plano 05) — entrada canônica do compositor. */
  briefing: BenchExperimentalBriefing;
  /** Snapshot fiel de produto/campanha (Plano 04) — fornece o texto da oferta. */
  snapshot: BenchCampaignSnapshot;
  /** Prompt-base manual do operador — preservado **verbatim**. */
  promptBase: string;
  /** Referências de imagem anexadas ao run (paths locais). Opcional. */
  references?: readonly string[];
}

export interface BenchPromptComposition {
  /** Texto completo do prompt compilado (blocos não vazios, na ordem canônica). */
  text: string;
  /** Blocos estruturados utilizados (rótulo → conteúdo, sem os vazios). */
  blocks: Record<string, string>;
}

// ─── Helpers de serialização ─────────────────────────────────────────────────

/** Acrescenta `Rótulo: valor` quando o valor (trimado) é não vazio. */
function pushLine(lines: string[], label: string, value: string | null | undefined): void {
  if (value === null || value === undefined) return;
  const trimmed = value.trim();
  if (trimmed.length === 0) return;
  lines.push(`${label}: ${trimmed}`);
}

function identityLines(briefing: BenchExperimentalBriefing): string[] {
  const lines: string[] = [];
  pushLine(lines, "Loja", briefing.storeName);
  pushLine(lines, "Segmento", briefing.segment);
  pushLine(lines, "Cor da marca", briefing.brandColor);
  const direction = briefing.visualDirection;
  pushLine(lines, "Brief da marca", direction.campaignBrief);
  pushLine(lines, "Diretrizes de campanha", direction.campaignGuidelines);
  pushLine(lines, "Estilo visual", direction.visualStyle);
  pushLine(lines, "Tom visual", direction.visualTone);
  pushLine(lines, "Personalidade da marca", direction.brandPersonality);
  return lines;
}

function typographyLines(briefing: BenchExperimentalBriefing): string[] {
  const lines: string[] = [];
  pushLine(lines, "Direção tipográfica", briefing.typographyDirection);
  return lines;
}

function productLines(
  briefing: BenchExperimentalBriefing,
  offerText: string,
  references: readonly string[] | undefined,
): string[] {
  const lines: string[] = [];
  pushLine(lines, "Produto", briefing.product.name);
  pushLine(lines, "Descrição", briefing.product.description);
  pushLine(lines, "Oferta", offerText);
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

function intentLines(briefing: BenchExperimentalBriefing): string[] {
  const lines: string[] = [];
  pushLine(lines, "Intenção", briefing.commercial.intent);
  pushLine(lines, "Formato", briefing.config.formato);
  pushLine(lines, "Tipo de conteúdo", briefing.config.tipoConteudo);
  pushLine(lines, "Estrutura", briefing.config.estrutura);
  pushLine(lines, "Tema", briefing.config.tema);
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
 * prompt-base verbatim. Determinístico e sem efeitos colaterais.
 */
export function composePromptBlocks(input: BenchPromptCompositionInput): BenchPromptComposition {
  const { briefing, snapshot, promptBase, references } = input;

  // Texto da oferta vindo do snapshot fiel; apenas escapa placeholders `{{ }}`.
  const offerText = sanitizePromptText((snapshot.offer?.text ?? "").trim());

  const ordered: Array<{ label: BenchPromptBlockLabel; lines: string[] }> = [
    { label: PROMPT_BLOCK_LABELS.identity, lines: identityLines(briefing) },
    { label: PROMPT_BLOCK_LABELS.typography, lines: typographyLines(briefing) },
    { label: PROMPT_BLOCK_LABELS.product, lines: productLines(briefing, offerText, references) },
    { label: PROMPT_BLOCK_LABELS.commercial, lines: commercialLines(briefing) },
    { label: PROMPT_BLOCK_LABELS.intent, lines: intentLines(briefing) },
    { label: PROMPT_BLOCK_LABELS.promptBase, lines: promptBaseLines(promptBase) },
    { label: PROMPT_BLOCK_LABELS.constraints, lines: constraintsLines(briefing) },
  ];

  const blocks: Record<string, string> = {};
  const parts: string[] = [];

  for (const { label, lines } of ordered) {
    const content = lines.join("\n");
    if (content.length === 0) continue;
    blocks[label] = content;
    parts.push(`[${label}]\n${content}`);
  }

  return { text: parts.join("\n\n"), blocks };
}

/**
 * Serializa o prompt compilado em um único texto estável (blocos canônicos na
 * ordem travada). Nenhuma transformação após a composição.
 */
export function composePrompt(input: BenchPromptCompositionInput): string {
  return composePromptBlocks(input).text;
}
