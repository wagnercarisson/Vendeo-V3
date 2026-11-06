import { PRODUCT_1_1_BACKGROUND_DIRECTION_VERSION } from "@/lib/product-1-1/background-direction";
import { PRODUCT_1_1_IDENTITY_CONTEXT_VERSION } from "@/lib/product-1-1/identity-context";
import { GENERAL_INTEGRITY_POLICY_VERSION } from "@/lib/product-1-1/policies/general-integrity";
import { produtoPolicy } from "@/lib/product-1-1/policies/produto";
import {
  INTENT_POLICY_VALUES,
  PRODUCT_1_1_PROMPT_POLICY_REGISTRY,
  pecaUnicaPolicy,
  temaNenhumPolicy,
} from "@/lib/product-1-1/policies/registry";
import type { ProductPromptPolicyResolutionInput } from "@/lib/product-1-1/policies/types";
import { SAFE_AREA_9_16_BOTTOM_ONLY_VERSION } from "../safe-area-experimental";
import { FORMATO_9_16_POLICY_VERSION } from "./policy-formato-9-16";

/**
 * F59 — Versões do compositor EDITORIAL vertical.
 *
 * O prompt vertical é serializado isoladamente (sem herdar os blocos do 1:1),
 * mas registra as MESMAS versões semânticas usadas na evidência congelada:
 * intenção, conteúdo, estrutura, tema, integridade, fundo, identidade e área
 * segura. Nenhum valor é lido de um contrato mutável.
 */
export const VERTICAL_COMPOSER_VERSION =
  "f59-vertical-9-16-composer-v11" as const;

export function resolveVerticalPromptPolicyVersions(
  input: ProductPromptPolicyResolutionInput,
): Readonly<Record<string, string>> {
  const intentValue = INTENT_POLICY_VALUES[input.briefing.commercial.intent];
  const intentPolicy = PRODUCT_1_1_PROMPT_POLICY_REGISTRY.intencao?.[intentValue];
  if (!intentPolicy) {
    throw new Error(
      `[product-vertical-9-16-prompt-policy-registry] missing policy: intencao=${intentValue}`,
    );
  }

  return Object.freeze({
    intencao: intentPolicy.version,
    formato: FORMATO_9_16_POLICY_VERSION,
    tipoConteudo: produtoPolicy.version,
    estrutura: pecaUnicaPolicy.version,
    tema: temaNenhumPolicy.version,
    geral: GENERAL_INTEGRITY_POLICY_VERSION,
    fundo: PRODUCT_1_1_BACKGROUND_DIRECTION_VERSION,
    identidade: PRODUCT_1_1_IDENTITY_CONTEXT_VERSION,
    safeArea: SAFE_AREA_9_16_BOTTOM_ONLY_VERSION,
  });
}

export { FORMATO_9_16_POLICY_VERSION };
