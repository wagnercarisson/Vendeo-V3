import type { ProductOneToOneBackgroundDirection } from "../background-direction";
import type { ProductOneToOneIntent } from "../intent-selection";

export const PRODUCT_PROMPT_BLOCK_LABELS = Object.freeze({
  identity: "IDENTIDADE E DIREÇÃO VISUAL",
  typography: "DIREÇÃO TIPOGRÁFICA",
  product: "PRODUTO E IMAGENS DE REFERÊNCIA",
  commercial: "CONDIÇÕES COMERCIAIS",
  intent: "INTENÇÃO E FORMATO",
  promptBase: "INSTRUÇÕES DO PROMPT-BASE",
  constraints: "RESTRIÇÕES E TEXTOS OBRIGATÓRIOS",
} as const);

export type ProductPromptBlockLabel =
  (typeof PRODUCT_PROMPT_BLOCK_LABELS)[keyof typeof PRODUCT_PROMPT_BLOCK_LABELS];

export interface PromptPolicyContribution {
  readonly block: ProductPromptBlockLabel;
  readonly lines: readonly string[];
}

export interface ProductPromptCompositionBriefing {
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  readonly product: {
    readonly name: string;
    readonly description: string | null;
  };
  readonly commercial: {
    readonly intent: ProductOneToOneIntent;
    readonly originalPriceText: string | null;
    readonly discountedPriceText: string | null;
    readonly badge: string | null;
    readonly validity: string | null;
  };
  readonly constraints: {
    readonly mandatoryArtworkText: string | null;
  };
}

export interface ProductPromptPolicyContext {
  readonly briefing: ProductPromptCompositionBriefing;
  readonly references?: readonly string[];
}

export type ProductPromptPolicyDimension =
  | "intencao"
  | "formato"
  | "tipoConteudo"
  | "estrutura"
  | "tema";

export interface ProductPromptPolicy {
  readonly id: string;
  readonly dimension: ProductPromptPolicyDimension;
  readonly value: string;
  readonly version: string;
  contributions(
    context: ProductPromptPolicyContext,
  ): readonly PromptPolicyContribution[];
}

export type ProductPromptPolicyResolutionInput = ProductPromptPolicyContext;

export type ProductPromptPolicyRegistry = Readonly<
  Partial<
    Record<
      ProductPromptPolicyDimension,
      Readonly<Record<string, ProductPromptPolicy>>
    >
  >
>;

export interface ResolvedProductPromptPolicies {
  readonly contributions: readonly PromptPolicyContribution[];
  readonly versions: Readonly<Record<string, string>>;
}
