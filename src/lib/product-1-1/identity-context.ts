import type { ProductOneToOneBackgroundDirection } from "./background-direction";
import { isRecreatedBackgroundDirection } from "./background-direction";

/**
 * F56 — Identidade visual no novo fluxo (Produto 1:1). Quick 261017-cdi.
 *
 * Transporta ao prompt, UMA única vez, a **paleta canônica resolvida** da loja
 * (com precedência documentada) e a regra de presença/ausência da identidade
 * (logo/assinatura) **reconciliada** — sem a cláusula legada "perfil de marca
 * como contexto direcional, não obrigatório", que enfraqueceria a orientação de
 * paleta em estúdio/ambientado.
 *
 * Restrito ao novo fluxo: o legado (`deriveDirective` em
 * `store-identity-service.ts`) permanece intacto (a reconciliação apenas REMOVE a
 * cláusula ambígua do texto legado no novo fluxo). Nenhum outro campo do perfil
 * de marca é enviado.
 *
 * A orientação **neutra** (sem paleta resolvida) é emitida SOMENTE para fundos
 * RECRIADOS (estúdio/ambientado): em `original`, ela poderia contrariar a
 * preservação do cenário.
 *
 * Quick 261125-i05 — quando o estado é `visual_signature` E o ativo de
 * identidade está efetivamente disponível (validação + conversão para data URL
 * concluídas) E há nome de loja, a instrução de presença é SUBSTITUÍDA pela
 * redação oficial aprovada (`buildVisualSignatureInstruction`), com o nome
 * resolvido no servidor interpolado. A instrução antiga (e "Não adicionar
 * logotipo.") não é mantida nesse caso. `text_only`, `logo`, assinatura sem
 * arquivo e nome vazio preservam o texto reconciliado anterior. Por isso as
 * regras de identidade avançam para `v2`; compositor, prompt-base e o texto das
 * 9 combinações permanecem idênticos.
 *
 * Quick 261125-i06 — SOMENTE no 1:1 novo com opt-in explícito
 * (`textOnlyInstitutionalIdentity === true`), estado declarado `text_only` e
 * nome não vazio, a instrução é SUBSTITUÍDA pela redação oficial de identificação
 * institucional em texto (`buildTextOnlyInstruction`), interpolando o nome e a
 * `typography_direction` persistida (verbatim, sem inferir fonte). Sem orientação,
 * a linha tipográfica é omitida. Joint 1:1+9:16, 9:16 isolado, legado, `logo`,
 * `visual_signature` e fallbacks preservam o comportamento anterior. Por isso as
 * regras de identidade avançam para `v3`.
 */
export const PRODUCT_1_1_IDENTITY_CONTEXT_VERSION =
  "48.2.6-identity-context-v3";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Subconjunto do perfil de marca usado para resolver a paleta canônica. */
export interface ProductOneToOneBrandProfileLike {
  readonly brand_colors_chosen?: ReadonlyArray<string | null> | null;
  readonly safe_color_tokens?: {
    readonly primary?: string | null;
    readonly accent?: string | null;
  } | null;
  /**
   * Quick 261125-i06 — orientação tipográfica persistida (transporte verbatim;
   * nunca inferida nem normalizada).
   */
  readonly typography_direction?: string | null;
}

/** Paleta canônica resolvida da loja (dados congeláveis na evidência). */
export interface ProductOneToOneIdentityContext {
  readonly storeName: string;
  readonly palettePrimary: string | null;
  readonly paletteAccent: string | null;
}

export interface ResolveProductOneToOneIdentityContextInput {
  readonly storeName: string;
  readonly storeBrandColor: string | null | undefined;
  readonly brandProfile: ProductOneToOneBrandProfileLike | null | undefined;
}

function firstValidHex(
  values: ReadonlyArray<string | null | undefined>,
): string | null {
  for (const value of values) {
    if (typeof value === "string" && HEX_COLOR.test(value)) return value;
  }
  return null;
}

/**
 * Precedência da paleta canônica (documentada, da maior para a menor), alinhada
 * ao que a TELA apresenta ao lojista (`store-identity-form.tsx`):
 *
 *   principal: `brand_colors_chosen[0]` → `safe_color_tokens.primary` → `brand_color`;
 *   acento:    `brand_colors_chosen[1]` → `safe_color_tokens.accent`.
 *
 * Quando NENHUMA fonte válida existe, `palettePrimary = null` — o fluxo envia
 * orientação **neutra** (somente em fundos recriados) e nunca inventa cores da
 * loja (nem usa o default de segmento). O acento só entra quando válido e
 * diferente da principal.
 */
export function resolveProductOneToOneIdentityContext(
  input: ResolveProductOneToOneIdentityContextInput,
): ProductOneToOneIdentityContext {
  const palettePrimary = firstValidHex([
    input.brandProfile?.brand_colors_chosen?.[0],
    input.brandProfile?.safe_color_tokens?.primary,
    input.storeBrandColor,
  ]);
  const paletteAccentRaw = firstValidHex([
    input.brandProfile?.brand_colors_chosen?.[1],
    input.brandProfile?.safe_color_tokens?.accent,
  ]);
  const paletteAccent =
    paletteAccentRaw !== null &&
    paletteAccentRaw.toLowerCase() !== (palettePrimary ?? "").toLowerCase()
      ? paletteAccentRaw
      : null;

  return Object.freeze({
    storeName: input.storeName.trim(),
    palettePrimary,
    paletteAccent,
  });
}

/**
 * Reconcilia o texto legado de identidade para o novo fluxo: remove as sentenças
 * que enfraquecem a paleta ("perfil de marca … contexto direcional, não
 * obrigatório"). Preserva integralmente as demais (presença/ausência do
 * logo/assinatura e fidelidade). Determinístico e testado contra os 4 textos
 * legados.
 */
export function reconcileLegacyIdentityDirective(legacyDirective: string): string {
  return legacyDirective
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(
      (sentence) =>
        sentence.length > 0 &&
        !/perfil de marca/i.test(sentence) &&
        !/não obrigat[óo]rio/i.test(sentence),
    )
    .join(" ");
}

export interface BuildNewFlowIdentityInput {
  /** Texto legado resolvido por `deriveDirective` (fonte das regras de presença). */
  readonly legacyDirective: string;
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  readonly storeName: string;
  readonly storeBrandColor: string | null | undefined;
  readonly brandProfile: ProductOneToOneBrandProfileLike | null | undefined;
  /**
   * Quick 261125-i05 — estado de identidade EFETIVO do novo fluxo. Omitido ⇒
   * comportamento anterior (texto reconciliado do `legacyDirective`).
   */
  readonly identityState?: "text_only" | "logo" | "visual_signature" | null;
  /**
   * Quick 261125-i05 — `true` SOMENTE quando o ativo de identidade foi
   * efetivamente validado e convertido para `data URL` (prova de disponibilidade).
   */
  readonly hasIdentityAsset?: boolean;
  /**
   * Quick 261125-i06 — direção tipográfica persistida no perfil sincronizado
   * (transporte verbatim; `trim` + pontuação final idempotente apenas).
   */
  readonly typographyDirection?: string | null;
  /**
   * Quick 261125-i06 — opt-in EXPLÍCITO do 1:1 novo para a redação de
   * identificação institucional em texto. Omitido/`false` preserva o
   * comportamento anterior (joint, 9:16 isolado, legado e Laboratório).
   */
  readonly textOnlyInstitutionalIdentity?: boolean;
}

export interface NewFlowIdentityBlock {
  /** Texto do bloco `[IDENTIDADE E DIREÇÃO VISUAL]` (congelado na evidência). */
  readonly directive: string;
  /** Dados estruturados da identidade (congelados na evidência/fingerprint). */
  readonly context: ProductOneToOneIdentityContext;
}

/**
 * Quick 261125-i05 — redação oficial aprovada da instrução de assinatura visual
 * (modo `visual_signature` com arquivo efetivamente disponível). As QUATRO
 * linhas formam um único bloco (`join("\n")`); somente o nome resolvido no
 * servidor é interpolado, já entre aspas. Nome vazio ⇒ `""` (o chamador cai no
 * fallback; nunca emitir nome vazio nem placeholder).
 */
export function buildVisualSignatureInstruction(storeName: string): string {
  const name = storeName.trim();
  if (name.length === 0) return "";
  return [
    `Use obrigatoriamente a assinatura visual oficial da loja "${name}", fornecida como imagem de referência de identidade.`,
    "Inclua a assinatura de forma legível, preservando seus elementos gráficos, cores, proporções e textos. Ajuste sua posição e escala para integrá-la à composição, sem redesenhá-la ou substituir seus elementos.",
    "Títulos promocionais, mesmo contendo o nome da loja, não substituem essa assinatura.",
    "Não invente nem acrescente outro logotipo ou assinatura.",
  ].join("\n");
}

/**
 * Quick 261125-i06 — redação oficial aprovada da identificação institucional em
 * texto (1:1 `text_only` com opt-in). As TRÊS primeiras linhas formam a
 * exigência obrigatória (`join("\n")`); a quarta linha tipográfica só entra
 * quando há orientação persistida não vazia. Somente o nome resolvido no
 * servidor e a orientação (verbatim, com pontuação final idempotente) são
 * interpolados. Nome vazio ⇒ `""` (o chamador cai no fallback; nunca emitir nome
 * vazio nem placeholder).
 */
export function buildTextOnlyInstruction(
  storeName: string,
  typographyDirection?: string | null,
): string {
  const name = storeName.trim();
  if (name.length === 0) return "";
  const lines = [
    `Inclua obrigatoriamente o nome da loja "${name}" como identificação institucional, em texto legível.`,
    "Títulos promocionais, mesmo contendo o nome da loja, não substituem essa identificação.",
    "Não invente nem acrescente logotipo, símbolo de marca ou assinatura gráfica para identificar a loja.",
  ];
  const typography = typographyDirection?.trim() ?? "";
  if (typography.length > 0) {
    const terminated = /[.!?]$/.test(typography) ? typography : `${typography}.`;
    lines.push(`Direção tipográfica da loja: ${terminated}`);
  }
  return lines.join("\n");
}

/**
 * Monta o bloco `[IDENTIDADE E DIREÇÃO VISUAL]` do novo fluxo, na ordem:
 *
 *   1. regra de presença/ausência da identidade (logo/assinatura), reconciliada;
 *   2. paleta canônica — ou orientação neutra **somente** em fundos recriados.
 *
 * Emitido UMA única vez; a orientação de USO da paleta no fundo fica nas
 * instruções de direção de fundo (estúdio/ambientado), sem repetir a paleta.
 */
export function buildNewFlowIdentityBlock(
  input: BuildNewFlowIdentityInput,
): NewFlowIdentityBlock {
  const context = resolveProductOneToOneIdentityContext(input);
  // Quick 261125-i05 — substituição CONDICIONAL: só em `visual_signature` com
  // ativo efetivamente disponível e nome não vazio. Os demais estados mantêm o
  // texto reconciliado; a instrução antiga nunca é concatenada à nova.
  const useVisualSignatureInstruction =
    input.identityState === "visual_signature" &&
    input.hasIdentityAsset === true &&
    context.storeName.length > 0;
  // Quick 261125-i06 — substituição CONDICIONAL da identificação institucional em
  // texto: exige opt-in explícito, estado DECLARADO `text_only` e nome não vazio.
  // `logo`/`visual_signature` com arquivo indisponível NÃO entram aqui.
  const useTextOnlyInstruction =
    input.textOnlyInstitutionalIdentity === true &&
    input.identityState === "text_only" &&
    context.storeName.length > 0;
  const signature = useVisualSignatureInstruction
    ? buildVisualSignatureInstruction(context.storeName)
    : useTextOnlyInstruction
      ? buildTextOnlyInstruction(context.storeName, input.typographyDirection)
      : reconcileLegacyIdentityDirective(input.legacyDirective);
  const name = context.storeName ? ` "${context.storeName}"` : "";

  const parts: string[] = [];
  if (signature) parts.push(signature);

  if (context.palettePrimary) {
    parts.push(
      `Paleta da loja${name}: cor principal ${context.palettePrimary}${
        context.paletteAccent ? `; cor de apoio ${context.paletteAccent}` : ""
      }.`,
    );
  } else if (isRecreatedBackgroundDirection(input.backgroundDirection)) {
    // Sem paleta ⇒ orientação neutra, SOMENTE em fundos recriados (nunca em
    // `original`, onde contrariaria a preservação do cenário).
    parts.push("Sem paleta da loja definida, use cores neutras e discretas.");
  }

  return Object.freeze({
    directive: parts.join("\n"),
    context,
  });
}
