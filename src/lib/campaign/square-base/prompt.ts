/**
 * F60.4 — Composição do prompt da base quadrada a partir do conteúdo CONGELADO.
 *
 * Módulo puro: sem `server-only`, sem banco/armazenamento, sem processamento de
 * imagem. Replica EXATAMENTE a montagem do Produto 1:1
 * (`generation-orchestrator.ts`): referências de produto derivadas das seleções
 * (excluindo a identidade) ou do campo legado `references`, contribuição de
 * identidade como bloco próprio e anexos na ordem produto → referências →
 * identidade. Não cria prompt, política nem versão nova: delega a
 * `composeProductPrompt` com `PRODUCT_1_1_PROMPT_BASE`.
 */

import {
  PROMPT_BLOCK_LABELS,
  composeProductPrompt,
  type ProductPromptAttachment,
  type ProductPromptComposition,
  type ProductPromptCompositionInput,
} from "@/lib/product-1-1/prompt-composition";
import {
  PRODUCT_1_1_PROMPT_BASE,
} from "@/lib/product-1-1/prompt-base";
import type { ProductPromptCompositionBriefing } from "@/lib/product-1-1/policies/types";
import type { ProductOneToOneEvidenceReference } from "@/lib/product-1-1/snapshot/persist-snapshot";
import type { PromptPolicyContribution } from "@/lib/product-1-1/policies/types";

/**
 * Conteúdo mínimo necessário para compor o prompt. É um subconjunto estrutural de
 * `FrozenContentPayload` — as versões entram no payload DEPOIS da composição
 * (é a composição que as define).
 */
export interface SquareBasePromptContent {
  readonly briefing: ProductPromptCompositionBriefing;
  readonly identityDirective: string | null;
  readonly referenceSelections: readonly ProductOneToOneEvidenceReference[];
  readonly references?: readonly string[];
}

/**
 * Dependências de composição. `promptBase` existe SOMENTE aqui (teste/integração),
 * nunca em `SquareBaseInput`; sem injeção a base é a do contrato 1:1.
 */
export interface SquareBasePromptDeps {
  readonly promptBase?: string;
}

/**
 * Mesma regra de `productReferenceIds` do 1:1: seleções não-identidade quando
 * existem; senão o campo legado `references` (fallback da task OpenSpec 3.1).
 */
function referenceIds(
  content: SquareBasePromptContent,
): readonly string[] | undefined {
  if (content.referenceSelections.length > 0) {
    return content.referenceSelections
      .filter((selection) => selection.kind !== "identity")
      .map((selection) => selection.id);
  }
  return content.references;
}

/** Mesma regra de `identityContributions` do 1:1: bloco só com directive não vazia. */
function identityContributions(
  content: SquareBasePromptContent,
): readonly PromptPolicyContribution[] {
  const directive = content.identityDirective?.trim();
  if (!directive) return [];
  return [{ block: PROMPT_BLOCK_LABELS.identity, lines: [directive] }];
}

/**
 * Mesma ordem REAL de `productPromptAttachments` do 1:1: produto (primeiro),
 * referências adicionais e, por último, o ativo de identidade.
 */
function promptAttachments(
  content: SquareBasePromptContent,
): readonly ProductPromptAttachment[] {
  const productCount =
    content.referenceSelections.length > 0
      ? content.referenceSelections.filter(
          (selection) => selection.kind !== "identity",
        ).length
      : (content.references?.length ?? 0);

  const products: ProductPromptAttachment[] = Array.from(
    { length: productCount },
    (_unused, index) => ({
      kind: index === 0 ? ("product" as const) : ("reference" as const),
    }),
  );

  const hasIdentity = content.referenceSelections.some(
    (selection) => selection.kind === "identity",
  );

  return hasIdentity ? [...products, { kind: "identity" as const }] : products;
}

/**
 * Monta o input de composição equivalente ao 1:1. Nunca passa `options.resolver`
 * nem sobrescreve `composerVersion`.
 */
export function buildSquareBasePromptInput(
  content: SquareBasePromptContent,
  deps: SquareBasePromptDeps = {},
): ProductPromptCompositionInput {
  const references = referenceIds(content);

  return {
    briefing: content.briefing,
    promptBase: deps.promptBase ?? PRODUCT_1_1_PROMPT_BASE.content,
    ...(references === undefined ? {} : { references }),
    contributions: identityContributions(content),
    attachments: promptAttachments(content),
  };
}

/** Compõe o prompt congelado com `composeProductPrompt` (sem opções extras). */
export function composeSquareBasePrompt(
  content: SquareBasePromptContent,
  deps: SquareBasePromptDeps = {},
): ProductPromptComposition {
  return composeProductPrompt(buildSquareBasePromptInput(content, deps));
}
