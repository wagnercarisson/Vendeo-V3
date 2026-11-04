import {
  composeProductPrompt,
  type ProductPromptComposition,
  type ProductPromptCompositionInput,
} from "@/lib/product-1-1/prompt-composition";
import {
  FORMATO_9_16_POLICY_VERSION,
  VERTICAL_COMPOSER_VERSION,
  resolveVerticalPromptPolicies,
} from "./registry";

/**
 * F59 — Compositor do prompt vertical.
 *
 * Reutiliza o serializador aprovado do 1:1 e injeta o resolvedor vertical
 * explícito + versão própria. Nenhum rótulo/bloco novo é criado.
 *
 * Versões registradas na saída: `f59-vertical-9-16-composer-v1` (compositor),
 * `f59-9-16-v1` (formato), `safe-area-9-16-v1` (área segura) e a versão da base
 * 1:1 congelada.
 */
export function composeVerticalProductPrompt(
  input: ProductPromptCompositionInput,
): ProductPromptComposition {
  return composeProductPrompt(input, {
    resolver: resolveVerticalPromptPolicies,
    composerVersion: VERTICAL_COMPOSER_VERSION,
  });
}

export { FORMATO_9_16_POLICY_VERSION, VERTICAL_COMPOSER_VERSION };
