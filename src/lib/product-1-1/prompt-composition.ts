import {
  PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS,
} from "./background-direction";
import { PROMPT_BASE_VERSION } from "./prompt-base";
import {
  PRODUCT_PROMPT_BLOCK_LABELS,
  type ProductPromptBlockLabel,
  type ProductPromptCompositionBriefing,
  type PromptPolicyContribution,
} from "./policies/types";
import { resolveProductOneToOnePromptPolicies } from "./policies/registry";

export const COMPOSER_VERSION = "48.2.4-prompt-composer-v5";

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

export interface ProductPromptCompositionInput {
  readonly briefing: ProductPromptCompositionBriefing;
  /** The selected baseline text is preserved verbatim. */
  readonly promptBase: string;
  readonly references?: readonly string[];
  /** Extra non-dimensional blocks (for example, identity/typography context). */
  readonly contributions?: readonly PromptPolicyContribution[];
}

export interface ProductPromptComposition {
  readonly text: string;
  readonly blocks: Readonly<Record<string, string>>;
  readonly composerVersion: typeof COMPOSER_VERSION;
  readonly promptBaseVersion: typeof PROMPT_BASE_VERSION;
  readonly policyVersions: Readonly<Record<string, string>>;
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
): string[] {
  const lines: string[] = [];
  if (briefing.product.name.trim()) {
    const name = briefing.product.name.trim();
    const separator = name.endsWith(".") ? "" : ".";
    pushLine(
      lines,
      "Nome obrigatório na arte",
      `${name}${separator} Inclua todas as palavras, números e unidades; capitalização, quebras de linha e arranjo livres.`,
    );
  }
  pushLine(lines, "Descrição", briefing.product.description);
  if (references && references.length > 0) {
    lines.push(`Imagens de referência: ${references.length}`);
  }
  return lines;
}

function commercialLines(briefing: ProductPromptCompositionBriefing): string[] {
  const lines: string[] = [];
  pushLine(
    lines,
    "Direção de fundo",
    PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS[
      briefing.backgroundDirection
    ],
  );
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
): ProductPromptComposition {
  const {
    briefing,
    promptBase,
    references,
    contributions = [],
  } = input;
  const resolvedPolicies = resolveProductOneToOnePromptPolicies({
    briefing,
    references,
  });

  const dataLines: Partial<Record<PromptBlockLabel, string[]>> = {
    [PROMPT_BLOCK_LABELS.product]: productLines(briefing, references),
    [PROMPT_BLOCK_LABELS.commercial]: commercialLines(briefing),
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
    composerVersion: COMPOSER_VERSION,
    promptBaseVersion: PROMPT_BASE_VERSION,
    policyVersions: Object.freeze({ ...resolvedPolicies.versions }),
  };
}
