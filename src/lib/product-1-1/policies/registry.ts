import type { ProductOneToOneIntent } from "../intent-selection";
import { destaquePolicy } from "./destaque";
import { exclusivoPolicy } from "./exclusivo";
import { formato11Policy } from "./formato-1-1";
import {
  GENERAL_INTEGRITY_POLICY_VERSION,
  productOneToOneGeneralIntegrityPolicy,
} from "./general-integrity";
import { ofertaPolicy } from "./oferta";
import { produtoPolicy } from "./produto";
import {
  PRODUCT_PROMPT_BLOCK_LABELS,
  type ProductPromptPolicy,
  type ProductPromptPolicyDimension,
  type ProductPromptPolicyRegistry,
  type ProductPromptPolicyResolutionInput,
  type ResolvedProductPromptPolicies,
} from "./types";

export const PRODUCT_PROMPT_POLICY_DIMENSIONS = Object.freeze([
  "intencao",
  "formato",
  "tipoConteudo",
  "estrutura",
  "tema",
] as const satisfies readonly ProductPromptPolicyDimension[]);

const pecaUnicaPolicy: ProductPromptPolicy = Object.freeze({
  id: "policy.estrutura.peca-unica",
  dimension: "estrutura",
  value: "peca-unica",
  version: "48.2.4-peca-unica-v1",
  contributions() {
    return [
      {
        block: PRODUCT_PROMPT_BLOCK_LABELS.intent,
        lines: ["Estrutura: peça única."],
      },
    ];
  },
});

const temaNenhumPolicy: ProductPromptPolicy = Object.freeze({
  id: "policy.tema.nenhum",
  dimension: "tema",
  value: "nenhum",
  version: "48.2.4-tema-nenhum-v1",
  contributions() {
    return [];
  },
});

/** Frozen product-owned registry; no mutable bench registry is imported. */
export const PRODUCT_1_1_PROMPT_POLICY_REGISTRY: ProductPromptPolicyRegistry =
  Object.freeze({
    intencao: Object.freeze({
      oferta: ofertaPolicy,
      destaque: destaquePolicy,
      exclusivo: exclusivoPolicy,
    }),
    formato: Object.freeze({ "1:1": formato11Policy }),
    tipoConteudo: Object.freeze({ produto: produtoPolicy }),
    estrutura: Object.freeze({ "peca-unica": pecaUnicaPolicy }),
    tema: Object.freeze({ nenhum: temaNenhumPolicy }),
  });

const REQUIRED_ENABLED_VALUES: ReadonlyArray<{
  dimension: ProductPromptPolicyDimension;
  value: string;
}> = [
  { dimension: "intencao", value: "oferta" },
  { dimension: "intencao", value: "destaque" },
  { dimension: "intencao", value: "exclusivo" },
  { dimension: "formato", value: "1:1" },
  { dimension: "tipoConteudo", value: "produto" },
  { dimension: "estrutura", value: "peca-unica" },
  { dimension: "tema", value: "nenhum" },
];

export function validateProductOneToOnePromptPolicyRegistry(
  registry: ProductPromptPolicyRegistry = PRODUCT_1_1_PROMPT_POLICY_REGISTRY,
): void {
  for (const { dimension, value } of REQUIRED_ENABLED_VALUES) {
    const policy = registry[dimension]?.[value];
    if (
      !policy ||
      !policy.id ||
      !policy.version ||
      policy.dimension !== dimension ||
      policy.value !== value
    ) {
      throw new Error(
        `[product-1-1-prompt-policy-registry] missing or invalid policy: ${dimension}=${value}`,
      );
    }
  }
}

const INTENT_POLICY_VALUES: Readonly<Record<ProductOneToOneIntent, string>> = {
  offer: "oferta",
  spotlight: "destaque",
  exclusive: "exclusivo",
};

/** Resolves dimension policies and the always-on general integrity policy. */
export function resolveProductOneToOnePromptPolicies(
  input: ProductPromptPolicyResolutionInput,
  registry: ProductPromptPolicyRegistry = PRODUCT_1_1_PROMPT_POLICY_REGISTRY,
): ResolvedProductPromptPolicies {
  validateProductOneToOnePromptPolicyRegistry(registry);

  const values: ReadonlyArray<{
    dimension: ProductPromptPolicyDimension;
    value: string;
  }> = [
    {
      dimension: "intencao",
      value: INTENT_POLICY_VALUES[input.briefing.commercial.intent],
    },
    { dimension: "formato", value: "1:1" },
    { dimension: "tipoConteudo", value: "produto" },
    { dimension: "estrutura", value: "peca-unica" },
    { dimension: "tema", value: "nenhum" },
  ];

  const contributions = [];
  const versions: Record<string, string> = {};
  for (const { dimension, value } of values) {
    const policy = registry[dimension]?.[value];
    if (!policy) {
      throw new Error(
        `[product-1-1-prompt-policy-registry] missing policy: ${dimension}=${value}`,
      );
    }
    versions[dimension] = policy.version;
    contributions.push(...policy.contributions(input));
  }

  // F48.2.5 applies this non-dimensional policy once to every valid composition.
  contributions.push(...productOneToOneGeneralIntegrityPolicy.contributions());
  versions.geral = GENERAL_INTEGRITY_POLICY_VERSION;

  return { contributions, versions };
}

validateProductOneToOnePromptPolicyRegistry();
