import {
  PRODUCT_1_1_BACKGROUND_COMMON_ORIENTATION,
  PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS,
  isRecreatedBackgroundDirection,
} from "./background-direction";
import { PROMPT_BASE_VERSION } from "./prompt-base";
import {
  PRODUCT_PROMPT_BLOCK_LABELS,
  type ProductPromptBlockLabel,
  type ProductPromptCompositionBriefing,
  type ProductPromptPolicyResolutionInput,
  type PromptPolicyContribution,
  type ResolvedProductPromptPolicies,
} from "./policies/types";
import { resolveProductOneToOnePromptPolicies } from "./policies/registry";

export const COMPOSER_VERSION = "48.2.4-prompt-composer-v7";

/**
 * F59 — `options` é uma extensão aditiva: sem ela, a saída é byte-idêntica ao
 * contrato 1:1. O vertical fornece `resolver` explícito e `composerVersion`
 * própria, sem alterar `COMPOSER_VERSION` nem o texto de qualquer bloco 1:1.
 */

/**
 * Orientação fixa da instrução de nome. Fica separada da lógica de composição
 * (que apenas interpola o nome dinâmico) para ser serializada em linha própria,
 * abaixo da linha `Nome obrigatório na arte: "<nome>"`.
 */
const NAME_ARTWORK_GUIDANCE =
  "Inclua todas as palavras, números e unidades - nenhuma informação do nome deve ser omitida, as aspas não fazem parte do nome; capitalização, quebras de linha e arranjo livres.";

export const PROMPT_BLOCK_LABELS = PRODUCT_PROMPT_BLOCK_LABELS;
export type PromptBlockLabel = ProductPromptBlockLabel;

export const PROMPT_BLOCK_ORDER: readonly PromptBlockLabel[] = Object.freeze([
  PROMPT_BLOCK_LABELS.identity,
  PROMPT_BLOCK_LABELS.typography,
  PROMPT_BLOCK_LABELS.product,
  PROMPT_BLOCK_LABELS.commercial,
  PROMPT_BLOCK_LABELS.intent,
  PROMPT_BLOCK_LABELS.promptBase,
  PROMPT_BLOCK_LABELS.constraints,
]);

export interface ProductPromptAttachment {
  /** Papel do anexo na ordem REAL enviada ao provider. */
  readonly kind: "product" | "reference" | "identity";
}

export interface ProductPromptCompositionInput {
  readonly briefing: ProductPromptCompositionBriefing;
  /** The selected baseline text is preserved verbatim. */
  readonly promptBase: string;
  readonly references?: readonly string[];
  /** Extra non-dimensional blocks (for example, identity/typography context). */
  readonly contributions?: readonly PromptPolicyContribution[];
  /**
   * Ordem REAL dos anexos enviados ao provider. Aditivo: consumido somente por
   * compositores que optarem por descrever os anexos (F59 vertical). O 1:1 ignora.
   */
  readonly attachments?: readonly ProductPromptAttachment[];
}

export interface ProductPromptComposition {
  readonly text: string;
  readonly blocks: Readonly<Record<string, string>>;
  readonly composerVersion: string;
  readonly promptBaseVersion: typeof PROMPT_BASE_VERSION;
  readonly policyVersions: Readonly<Record<string, string>>;
}

/**
 * Extensão ADITIVA do compositor (F59). Sem opções, o comportamento é
 * byte-idêntico ao Produto 1:1 aprovado; o vertical injeta seu próprio resolvedor
 * explícito e sua própria versão de compositor.
 */
export interface ComposeProductPromptOptions {
  readonly resolver?: (
    input: ProductPromptPolicyResolutionInput,
  ) => ResolvedProductPromptPolicies;
  readonly composerVersion?: string;
  /** F59 vertical: omite a contagem genérica de referências (substituída por anexos). */
  readonly omitReferenceCount?: boolean;
  /**
   * F59 vertical: linha de contraste do bloco comercial. `undefined` preserva a
   * linha 1:1; `null` remove; string substitui pelo texto do vertical.
   */
  readonly commercialIdentityLine?: string | null;
}

function pushLine(
  lines: string[],
  label: string,
  value: string | null | undefined,
): void {
  if (value === null || value === undefined) return;
  const trimmed = value.trim();
  if (trimmed.length === 0) return;
  lines.push(`${label}: ${trimmed}`);
}

function productLines(
  briefing: ProductPromptCompositionBriefing,
  references: readonly string[] | undefined,
  omitReferenceCount: boolean,
): string[] {
  const lines: string[] = [];
  if (briefing.product.name.trim()) {
    const name = briefing.product.name.trim();
    pushLine(lines, "Nome obrigatório na arte", `"${name}"`);
    lines.push(NAME_ARTWORK_GUIDANCE);
  }
  pushLine(lines, "Descrição", briefing.product.description);
  if (!omitReferenceCount && references && references.length > 0) {
    lines.push(`Imagens de referência: ${references.length}`);
  }
  return lines;
}

function commercialLines(
  briefing: ProductPromptCompositionBriefing,
  options: ComposeProductPromptOptions,
): string[] {
  const lines: string[] = [];
  pushLine(
    lines,
    "Direção de fundo",
    PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS[
      briefing.backgroundDirection
    ],
  );
  // Orientação comum de contraste — emitida UMA única vez e SOMENTE quando o
  // fundo é recriado (estúdio/ambientado). Não é emitida para `original`.
  if (isRecreatedBackgroundDirection(briefing.backgroundDirection)) {
    if (options.commercialIdentityLine === null) {
      // O vertical sem ativo não menciona logo/assinatura.
      lines.push(
        "Garanta contraste para destacar o produto.",
      );
    } else {
      lines.push(
        options.commercialIdentityLine ??
          PRODUCT_1_1_BACKGROUND_COMMON_ORIENTATION,
      );
    }
  }
  pushLine(lines, "Preço original", briefing.commercial.originalPriceText);
  pushLine(lines, "Preço de venda", briefing.commercial.discountedPriceText);
  pushLine(lines, "Selo", briefing.commercial.badge);
  pushLine(lines, "Validade", briefing.commercial.validity);
  return lines;
}

function promptBaseLines(promptBase: string): string[] {
  if (promptBase.trim().length === 0) return [];
  return [promptBase];
}

function constraintsLines(briefing: ProductPromptCompositionBriefing): string[] {
  const lines: string[] = [];
  pushLine(
    lines,
    "Informações obrigatórias na arte",
    briefing.constraints.mandatoryArtworkText,
  );
  return lines;
}

/** Pure deterministic serializer for the frozen Product 1:1 prompt contract. */
export function composeProductPrompt(
  input: ProductPromptCompositionInput,
  options: ComposeProductPromptOptions = {},
): ProductPromptComposition {
  const {
    briefing,
    promptBase,
    references,
    contributions = [],
  } = input;
  const resolvedPolicies = (
    options.resolver ?? resolveProductOneToOnePromptPolicies
  )({
    briefing,
    references,
  });

  const dataLines: Partial<Record<PromptBlockLabel, string[]>> = {
    [PROMPT_BLOCK_LABELS.product]: productLines(
      briefing,
      references,
      options.omitReferenceCount === true,
    ),
    [PROMPT_BLOCK_LABELS.commercial]: commercialLines(briefing, options),
    [PROMPT_BLOCK_LABELS.promptBase]: promptBaseLines(promptBase),
    [PROMPT_BLOCK_LABELS.constraints]: constraintsLines(briefing),
  };

  const contributionLines = new Map<PromptBlockLabel, string[]>();
  for (const contribution of [
    ...resolvedPolicies.contributions,
    ...contributions,
  ]) {
    const existing = contributionLines.get(contribution.block) ?? [];
    existing.push(...contribution.lines);
    contributionLines.set(contribution.block, existing);
  }

  const blocks: Record<string, string> = {};
  const parts: string[] = [];
  for (const label of PROMPT_BLOCK_ORDER) {
    const lines = [
      ...(dataLines[label] ?? []),
      ...(contributionLines.get(label) ?? []),
    ];
    const content = lines.join("\n");
    if (content.length === 0) continue;
    blocks[label] = content;
    parts.push(`[${label}]\n${content}`);
  }

  return {
    text: parts.join("\n\n"),
    blocks: Object.freeze(blocks),
    composerVersion: options.composerVersion ?? COMPOSER_VERSION,
    promptBaseVersion: PROMPT_BASE_VERSION,
    policyVersions: Object.freeze({ ...resolvedPolicies.versions }),
  };
}
