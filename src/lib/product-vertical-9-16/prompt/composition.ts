import type {
  ProductPromptAttachment,
  ProductPromptComposition,
  ProductPromptCompositionInput,
} from "@/lib/product-1-1/prompt-composition";
import { PROMPT_BASE_VERSION } from "@/lib/product-1-1/prompt-base";
import { PRODUCT_PROMPT_BLOCK_LABELS } from "@/lib/product-1-1/policies/types";
import {
  FORMATO_9_16_POLICY_VERSION,
  VERTICAL_COMPOSER_VERSION,
  resolveVerticalPromptPolicyVersions,
} from "./registry";

/**
 * F59 — Compositor EDITORIAL do prompt vertical 9:16.
 *
 * Serializador próprio (não reutiliza o layout de blocos do 1:1) para produzir
 * um prompt curto, separando DADOS de INSTRUÇÕES. Cada orientação aparece uma
 * única vez e só é emitida quando o elemento existe. As políticas compartilhadas
 * do 1:1 permanecem intocadas; o vertical apenas registra suas versões.
 */

export const VERTICAL_PROMPT_BLOCK_LABELS = Object.freeze({
  objective: "OBJETIVO",
  references: "REFERÊNCIAS",
  data: "DADOS DA CAMPANHA",
  composition: "COMPOSIÇÃO",
  compositionPolicy: "COMPOSIÇÃO PARA INSTAGRAM",
} as const);

type VerticalBlockLabel =
  (typeof VERTICAL_PROMPT_BLOCK_LABELS)[keyof typeof VERTICAL_PROMPT_BLOCK_LABELS];

const INTENT_OBJECTIVE = Object.freeze({
  offer: "Crie uma campanha de oferta, em peça única.",
  spotlight: "Crie uma campanha de destaque, em peça única.",
  exclusive: "Crie uma campanha exclusiva, em peça única.",
} as const);

function intentRules(
  input: ProductPromptCompositionInput,
): readonly string[] {
  const { commercial } = input.briefing;
  const hasOriginal = Boolean(commercial.originalPriceText?.trim());
  const hasDiscounted = Boolean(commercial.discountedPriceText?.trim());

  if (commercial.intent === "exclusive") {
    return [
      "Apresente o produto sem preço, em composição editorial, sóbria e arejada, com hierarquia discreta e sem chamadas promocionais.",
      "Não invente informações.",
    ];
  }

  if (commercial.intent === "spotlight") {
    return [
      hasOriginal || hasDiscounted
        ? "Priorize a apresentação do produto; o preço informado é secundário."
        : "Priorize a apresentação do produto.",
      "Não invente informações comerciais.",
    ];
  }

  if (hasOriginal && hasDiscounted) {
    return [
      "Destaque o preço de venda; apresente o preço original como secundário.",
      "Não invente informações comerciais.",
    ];
  }
  if (hasDiscounted) {
    return [
      "Destaque o preço de venda.",
      "Não invente informações comerciais.",
    ];
  }
  if (hasOriginal) {
    return [
      "Destaque o preço original.",
      "Não invente informações comerciais.",
    ];
  }
  return ["Não invente informações comerciais."];
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const PALETTE_LINE_PREFIX = "Paleta da loja";
const PALETTE_PRIMARY = /cor principal\s+(#[0-9A-Fa-f]{6})/;
const PALETTE_ACCENT = /cor de apoio\s+(#[0-9A-Fa-f]{6})/;
const PALETTE_STORE = /^Paleta da loja\s+(.+?):\s*cor principal/;

interface VerticalIdentityData {
  readonly storeName: string | null;
  readonly primary: string | null;
  readonly accent: string | null;
}

interface VerticalPromptBlock {
  readonly label: VerticalBlockLabel;
  readonly lines: readonly string[];
}

/** Delimitação inequívoca: aspas, quebras de linha e barras são escapadas. */
function quote(value: string): string {
  return JSON.stringify(value.trim());
}

function attachmentPosition(
  attachments: readonly ProductPromptAttachment[],
  kind: ProductPromptAttachment["kind"],
): number | null {
  const index = attachments.findIndex((attachment) => attachment.kind === kind);
  return index >= 0 ? index + 1 : null;
}

/**
 * A ordem REAL chega do adapter. Sem metadados (chamadas legadas), deriva de
 * `references`: a primeira é o produto e as demais são referências adicionais.
 */
function effectiveAttachments(
  input: ProductPromptCompositionInput,
): readonly ProductPromptAttachment[] {
  if ((input.attachments?.length ?? 0) > 0) return input.attachments!;
  return (input.references ?? []).map((_, index) => ({
    kind: index === 0 ? ("product" as const) : ("reference" as const),
  }));
}

function readIdentityData(
  input: ProductPromptCompositionInput,
): VerticalIdentityData {
  // Dados estruturados (briefing congelado) têm precedência: nomes com aspas,
  // dois-pontos ou quebras de linha não afetam a paleta.
  const structured = input.briefing.identity;
  if (structured) {
    return {
      storeName: structured.storeName?.trim() || null,
      primary:
        structured.palettePrimary && HEX_COLOR.test(structured.palettePrimary)
          ? structured.palettePrimary
          : null,
      accent:
        structured.paletteAccent && HEX_COLOR.test(structured.paletteAccent)
          ? structured.paletteAccent
          : null,
    };
  }

  const lines = (input.contributions ?? [])
    .filter(
      (contribution) =>
        contribution.block === PRODUCT_PROMPT_BLOCK_LABELS.identity,
    )
    .flatMap((contribution) => contribution.lines)
    .flatMap((line) => line.split("\n"))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Fallback textual: ancora nos tokens de cor, não no nome. Assim um nome com
  // aspas (ou até com "cor principal" no meio) não apaga a paleta.
  for (const line of lines) {
    if (!line.startsWith(PALETTE_LINE_PREFIX)) continue;
    const primary = PALETTE_PRIMARY.exec(line)?.[1] ?? null;
    if (!primary) continue;
    const accent = PALETTE_ACCENT.exec(line)?.[1] ?? null;
    const rawStore = PALETTE_STORE.exec(line)?.[1]?.trim() ?? null;
    const storeName = rawStore
      ? rawStore.startsWith('"') && rawStore.endsWith('"')
        ? rawStore.slice(1, -1).trim() || null
        : rawStore
      : null;
    return { storeName, primary, accent };
  }

  return { storeName: null, primary: null, accent: null };
}

function referenceLines(
  attachments: readonly ProductPromptAttachment[],
): string[] {
  return attachments.map((attachment, index) => {
    const position = index + 1;
    if (attachment.kind === "product") {
      return `Imagem ${position}: produto anunciado. Preserve sua aparência e use-o como protagonista.`;
    }
    if (attachment.kind === "reference") {
      return `Imagem ${position}: referência adicional do produto. Use como apoio visual.`;
    }
    return `Imagem ${position}: ativo da loja. Preserve sua identidade, adaptando sua aplicação à composição e ao contraste, sem descaracterizá-lo.`;
  });
}

function dataLines(
  input: ProductPromptCompositionInput,
  identity: VerticalIdentityData,
): string[] {
  const { briefing } = input;
  const intent = briefing.commercial.intent;
  const lines: string[] = [];

  if (identity.storeName) lines.push(`Loja: ${quote(identity.storeName)}`);
  if (briefing.product.name.trim()) {
    lines.push(`Produto: ${quote(briefing.product.name)}`);
  }
  if (briefing.product.description?.trim()) {
    lines.push(`Descrição: ${quote(briefing.product.description)}`);
  }

  // Exclusivo não exibe preço; oferta/destaque preservam o valor informado e o
  // preço original só aparece quando realmente existe.
  if (intent !== "exclusive") {
    if (briefing.commercial.originalPriceText?.trim()) {
      lines.push(`Preço original: ${quote(briefing.commercial.originalPriceText)}`);
    }
    if (briefing.commercial.discountedPriceText?.trim()) {
      lines.push(`Preço: ${quote(briefing.commercial.discountedPriceText)}`);
    }
  }

  if (briefing.commercial.badge?.trim()) {
    lines.push(`Selo: ${quote(briefing.commercial.badge)}`);
  }
  if (briefing.commercial.validity?.trim()) {
    lines.push(`Validade: ${quote(briefing.commercial.validity)}`);
  }
  if (briefing.constraints.mandatoryArtworkText?.trim()) {
    lines.push(
      `Aviso obrigatório: ${quote(briefing.constraints.mandatoryArtworkText)}`,
    );
  }
  if (identity.primary) {
    lines.push(
      `Paleta: principal ${identity.primary}${
        identity.accent ? `; apoio ${identity.accent}` : ""
      }.`,
    );
  }

  // A numeração das referências é derivada dos anexos reais; sem anexos, o dado
  // continua sendo emitido, mas nenhuma referência é inventada.
  return lines;
}

function backgroundRule(
  direction: ProductPromptCompositionInput["briefing"]["backgroundDirection"],
  hasPalette: boolean,
): string {
  if (direction === "studio") {
    return hasPalette
      ? "Use fundo de estúdio liso ou gradiente suave na paleta da loja, com bom contraste e sem objetos de apoio."
      : "Use fundo de estúdio liso ou gradiente suave, com bom contraste e sem objetos de apoio.";
  }
  if (direction === "ambient") {
    return hasPalette
      ? "Crie um cenário coerente com o produto, incorporando a paleta da loja em elementos do ambiente, sem prejudicar a leitura."
      : "Crie um cenário coerente com o produto, sem prejudicar a leitura.";
  }
  return "Mantenha o cenário da imagem enviada como base; não substitua o ambiente por outro.";
}

function compositionLines(
  input: ProductPromptCompositionInput,
  identity: VerticalIdentityData,
  attachments: readonly ProductPromptAttachment[],
): string[] {
  const { briefing, promptBase } = input;
  const identityImage = attachmentPosition(attachments, "identity");
  const hasPalette = identity.primary !== null;

  const rules: string[] = [];
  const base = promptBase.trim();
  if (base.length > 0) rules.push(base);

  rules.push(...intentRules(input));
  rules.push(backgroundRule(briefing.backgroundDirection, hasPalette));

  if (identityImage !== null) {
    rules.push(
      briefing.backgroundDirection === "original"
        ? "Não altere o produto nem o cenário para resolver contraste; ajuste posição, escala ou a aplicação do ativo."
        : "Antes de alterar as cores do ativo, ajuste posicionamento e fundo para obter contraste.",
    );
  } else {
    rules.push("Não invente identidade visual.");
  }

  if (briefing.product.description?.trim()) {
    rules.push(
      "A descrição é opcional e pode ser adaptada ou omitida, preservando seu significado.",
    );
  }

  rules.push(
    "Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.",
  );
  rules.push(
    "Use português correto e natural, sem caracteres ou pontuação duplicados, e não corrija silenciosamente os textos de entrada.",
  );

  return rules;
}

function compositionPolicyLines(): string[] {
  return [
    "Mantenha os textos, preço, oferta, CTA quando houver, condições comerciais e ativo da loja fora dos 15% superiores e dos 20% inferiores da imagem.",
    "",
    "Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.",
    "",
    "Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.",
    "",
    "Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.",
  ];
}

function renderBlocks(blocks: readonly VerticalPromptBlock[]): {
  text: string;
  record: Record<string, string>;
} {
  const parts: string[] = [];
  const record: Record<string, string> = {};
  for (const block of blocks) {
    if (block.lines.length === 0) continue;
    const content = block.lines.join("\n");
    record[block.label] = content;
    parts.push(
      block.label === VERTICAL_PROMPT_BLOCK_LABELS.objective
        ? content
        : `[${block.label}]\n${content}`,
    );
  }
  return { text: parts.join("\n\n"), record };
}

export function composeVerticalProductPrompt(
  input: ProductPromptCompositionInput,
): ProductPromptComposition {
  const attachments = effectiveAttachments(input);
  const identity = readIdentityData(input);

  const blocks: VerticalPromptBlock[] = [
    {
      label: VERTICAL_PROMPT_BLOCK_LABELS.objective,
      lines: [INTENT_OBJECTIVE[input.briefing.commercial.intent]],
    },
    {
      label: VERTICAL_PROMPT_BLOCK_LABELS.references,
      lines: referenceLines(attachments),
    },
    {
      label: VERTICAL_PROMPT_BLOCK_LABELS.data,
      lines: dataLines(input, identity),
    },
    {
      label: VERTICAL_PROMPT_BLOCK_LABELS.composition,
      lines: compositionLines(input, identity, attachments),
    },
    {
      label: VERTICAL_PROMPT_BLOCK_LABELS.compositionPolicy,
      lines: compositionPolicyLines(),
    },
  ];

  const rendered = renderBlocks(blocks);

  return {
    text: rendered.text,
    blocks: Object.freeze(rendered.record),
    composerVersion: VERTICAL_COMPOSER_VERSION,
    promptBaseVersion: PROMPT_BASE_VERSION,
    policyVersions: resolveVerticalPromptPolicyVersions(input),
  };
}

export { FORMATO_9_16_POLICY_VERSION, VERTICAL_COMPOSER_VERSION };
