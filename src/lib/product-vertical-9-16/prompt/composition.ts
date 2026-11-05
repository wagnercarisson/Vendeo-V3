import {
  composeProductPrompt,
  type ProductPromptComposition,
  type ProductPromptCompositionInput,
  type ProductPromptAttachment,
} from "@/lib/product-1-1/prompt-composition";
import {
  PRODUCT_PROMPT_BLOCK_LABELS,
  type PromptPolicyContribution,
} from "@/lib/product-1-1/policies/types";
import {
  FORMATO_9_16_POLICY_VERSION,
  VERTICAL_COMPOSER_VERSION,
  resolveVerticalPromptPolicies,
} from "./registry";

function attachmentLabel(kind: ProductPromptAttachment["kind"]): string {
  if (kind === "product") return "produto anunciado";
  if (kind === "reference") return "referência adicional do produto";
  return "ativo da loja";
}

function attachmentPosition(
  attachments: readonly ProductPromptAttachment[],
  kind: ProductPromptAttachment["kind"],
): number | null {
  const index = attachments.findIndex((attachment) => attachment.kind === kind);
  return index >= 0 ? index + 1 : null;
}

function buildAttachmentLines(
  attachments: readonly ProductPromptAttachment[],
): string[] {
  if (attachments.length === 0) return [];
  const lines = ["Anexos enviados ao modelo, nesta ordem:"];
  attachments.forEach((attachment, index) => {
    lines.push(`- Imagem ${index + 1}: ${attachmentLabel(attachment.kind)}.`);
  });
  return lines;
}

function buildIdentityLines(
  input: ProductPromptCompositionInput,
  attachments: readonly ProductPromptAttachment[],
): string[] {
  const original = input.contributions?.find(
    (contribution) => contribution.block === PRODUCT_PROMPT_BLOCK_LABELS.identity,
  );
  const originalLines = (original?.lines ?? [])
    .flatMap((line) => line.split("\n"))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const paletteLines = originalLines.filter(
    (line) =>
      line.startsWith("Paleta da loja") ||
      line.startsWith("Sem paleta da loja"),
  );
  const identityImage = attachmentPosition(attachments, "identity");

  const lines: string[] = [];
  if (identityImage !== null) {
    lines.push(`Ativo da loja anexado na imagem ${identityImage}.`);
    lines.push(
      `Reproduza o ativo da loja fornecido na imagem ${identityImage}, preservando símbolo, lettering, proporções e organização interna. Não redesenhe, simplifique, substitua nem reorganize seus componentes.`,
    );
  } else {
    lines.push("Não há ativo da loja anexado; não invente identidade visual.");
  }
  lines.push(...paletteLines);
  return lines;
}

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
  const attachments = input.attachments ?? [];
  const hasAttachmentMetadata = attachments.length > 0;
  const identityImage = attachmentPosition(attachments, "identity");

  const contributions: PromptPolicyContribution[] = [];
  if (hasAttachmentMetadata) {
    contributions.push({
      block: PRODUCT_PROMPT_BLOCK_LABELS.product,
      lines: buildAttachmentLines(attachments),
    });
    for (const contribution of input.contributions ?? []) {
      if (contribution.block === PRODUCT_PROMPT_BLOCK_LABELS.identity) continue;
      contributions.push(contribution);
    }
    contributions.push({
      block: PRODUCT_PROMPT_BLOCK_LABELS.identity,
      lines: buildIdentityLines(input, attachments),
    });
  } else {
    contributions.push(...(input.contributions ?? []));
  }

  return composeProductPrompt(
    {
      ...input,
      contributions,
    },
    {
      resolver: resolveVerticalPromptPolicies,
      composerVersion: VERTICAL_COMPOSER_VERSION,
      omitReferenceCount: hasAttachmentMetadata,
      commercialIdentityLine:
        hasAttachmentMetadata
          ? identityImage !== null
            ? "Garanta contraste para destacar o produto e manter legível o ativo da loja."
            : null
          : undefined,
    },
  );
}

export { FORMATO_9_16_POLICY_VERSION, VERTICAL_COMPOSER_VERSION };
