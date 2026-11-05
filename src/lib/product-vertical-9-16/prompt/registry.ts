import { PRODUCT_1_1_BACKGROUND_DIRECTION_VERSION } from "@/lib/product-1-1/background-direction";
import { PRODUCT_1_1_IDENTITY_CONTEXT_VERSION } from "@/lib/product-1-1/identity-context";
import {
  GENERAL_INTEGRITY_POLICY_VERSION,
  productOneToOneGeneralIntegrityPolicy,
} from "@/lib/product-1-1/policies/general-integrity";
import { produtoPolicy } from "@/lib/product-1-1/policies/produto";
import {
  INTENT_POLICY_VALUES,
  PRODUCT_1_1_PROMPT_POLICY_REGISTRY,
  pecaUnicaPolicy,
  temaNenhumPolicy,
} from "@/lib/product-1-1/policies/registry";
import type {
  ProductPromptPolicy,
  ProductPromptPolicyResolutionInput,
  PromptPolicyContribution,
  ResolvedProductPromptPolicies,
} from "@/lib/product-1-1/policies/types";
import { SAFE_AREA_9_16_VERSION } from "../safe-area";
import {
  FORMATO_9_16_POLICY_VERSION,
  formato916Policy,
} from "./policy-formato-9-16";

/**
 * F59 — Resolvedor EXPLÍCITO das políticas do prompt vertical.
 *
 * Não delega ao resolvedor 1:1 nem à validação do registry 1:1: o formato
 * vertical não deve passar pela exigência `formato=1:1` do registry 1:1. As
 * políticas de intenção, produto, estrutura, tema e integridade são os MESMOS
 * objetos do 1:1; apenas o formato e a área segura são verticais.
 */
export const VERTICAL_COMPOSER_VERSION =
  "f59-vertical-9-16-composer-v2" as const;

function pushPolicy(
  contributions: PromptPolicyContribution[],
  versions: Record<string, string>,
  policy: ProductPromptPolicy,
  input: ProductPromptPolicyResolutionInput,
): void {
  versions[policy.dimension] = policy.version;
  contributions.push(...policy.contributions(input));
}

export function resolveVerticalPromptPolicies(
  input: ProductPromptPolicyResolutionInput,
): ResolvedProductPromptPolicies {
  const intentValue = INTENT_POLICY_VALUES[input.briefing.commercial.intent];
  const intentPolicy = PRODUCT_1_1_PROMPT_POLICY_REGISTRY.intencao?.[intentValue];
  if (!intentPolicy) {
    throw new Error(
      `[product-vertical-9-16-prompt-policy-registry] missing policy: intencao=${intentValue}`,
    );
  }

  const contributions: PromptPolicyContribution[] = [];
  const versions: Record<string, string> = {};

  // Mesma ordem de contribuição do 1:1, trocando apenas a dimensão `formato`.
  pushPolicy(contributions, versions, intentPolicy, input);
  pushPolicy(contributions, versions, formato916Policy, input);
  pushPolicy(contributions, versions, produtoPolicy, input);
  pushPolicy(contributions, versions, pecaUnicaPolicy, input);
  pushPolicy(contributions, versions, temaNenhumPolicy, input);

  contributions.push(...productOneToOneGeneralIntegrityPolicy.contributions());
  versions.geral = GENERAL_INTEGRITY_POLICY_VERSION;
  versions.fundo = PRODUCT_1_1_BACKGROUND_DIRECTION_VERSION;
  versions.identidade = PRODUCT_1_1_IDENTITY_CONTEXT_VERSION;

  versions.safeArea = SAFE_AREA_9_16_VERSION;

  return Object.freeze({
    contributions: Object.freeze(contributions),
    versions: Object.freeze(versions),
  });
}

export { FORMATO_9_16_POLICY_VERSION, formato916Policy };
