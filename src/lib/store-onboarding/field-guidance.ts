/**
 * Conteúdo de orientação dos campos de identidade da loja (F49, D3/D4/D5/D6/D7/D14)
 * — microcopy de nome público, dados fiscais, tom de voz (hint + descrição por
 * opção), posicionamento, descrição curta e slogan.
 *
 * Módulo puro: sem JSX, sem runtime de UI, sem ambiente de servidor, sem
 * imports de side-effect. Fonte única das strings consumidas pelos componentes
 * do formulário da loja e pelos testes — nenhuma cópia divergente.
 *
 * Sem alteração de comportamento: `computeTabUnlock` continua exigindo
 * `storeId` + tom de voz (`needs_tone_of_voice`) e `reason-text.ts` permanece a
 * fonte do motivo de bloqueio. Nenhuma validação nova é criada aqui.
 */

/**
 * Tom de voz da loja — exatamente as 8 opções reais de `TONE_OF_VOICE_OPTIONS`
 * em `store-identity-form.tsx`. União literal: uma chave inválida falha em
 * `tsc` (T-49-02, Tampering).
 */
export type StoreToneOfVoice =
  | "profissional"
  | "moderno"
  | "elegante"
  | "divertido"
  | "acolhedor"
  | "jovem"
  | "tradicional"
  | "luxuoso";

/** Nome público da loja (D4) — identidade pública, não dado fiscal. */
export const STORE_NAME_HINT =
  "Este é o nome público da sua loja. Ele aparece no Vendeo e é usado para identificar e assinar suas campanhas.";

/** Subseção de dados fiscais (D4) — agrupa CNPJ/Razão Social/Nome Fantasia. */
export const FISCAL_SECTION_LABEL = "Dados fiscais";

/** Helper da subseção de dados fiscais (D4). */
export const FISCAL_SECTION_HELPER =
  "Dados cadastrais oficiais (Receita Federal) usados para verificação e prontidão do cadastro.";

/** Hint do tom de voz (D5) — campo crítico para avançar à Direção Visual. */
export const TONE_OF_VOICE_HINT =
  "Define como sua loja se comunica. O Vendeo usa essa escolha nos títulos, legendas e no clima visual das campanhas.";

/**
 * Deixa explícito que o tom de voz complementa (não substitui) segmento e
 * subsegmento como base da identidade (D5).
 */
export const TONE_OF_VOICE_COMPLEMENTS_HINT =
  "O tom de voz complementa o segmento e o subsegmento da sua loja — ele não substitui a base da identidade da marca.";

/** Descrição contextual curta e positiva por opção de tom de voz (D5). */
export const TONE_OF_VOICE_DESCRIPTIONS: Record<StoreToneOfVoice, string> = {
  profissional: "Direta, confiável e sem exageros.",
  moderno: "Atual, objetiva e com energia contemporânea.",
  elegante: "Refinada, equilibrada e com atenção aos detalhes.",
  divertido: "Leve, descontraída e com bom humor.",
  acolhedor: "Próxima, calorosa e atenciosa com as pessoas.",
  jovem: "Despojada, dinâmica e conectada com o momento.",
  tradicional: "Sólida, experiente e fiel às suas origens.",
  luxuoso: "Sofisticada, exclusiva e com senso de premium.",
};

/** Label principal do posicionamento (D6). */
export const POSITIONING_LABEL = "Como você quer que sua loja seja percebida?";

/** Termo secundário do posicionamento (D6) — mantém a chave `positioning`. */
export const POSITIONING_SECONDARY_LABEL = "Posicionamento da marca";

/** Hint do posicionamento: público, proposta e diferencial (D6). */
export const POSITIONING_HINT =
  "Descreva o público que você atende, a proposta da sua loja e o que a diferencia.";

/** Placeholder de começo de frase útil (D6). */
export const POSITIONING_PLACEHOLDER = "Ex: Somos uma loja de...";

/** Título da ajuda expansível do posicionamento (D6). */
export const POSITIONING_HELP_TITLE = "Exemplo de posicionamento";

/** Exemplo positivo da ajuda expansível do posicionamento (D6). */
export const POSITIONING_EXAMPLE =
  "Somos uma loja de [categoria] para [público], reconhecida por [diferencial].";

/**
 * Microcopy do efeito do posicionamento (D6/D7): efeito direto na copy e
 * indireto no perfil/direção visual — sem prometer transformação visual
 * específica.
 */
export const POSITIONING_IDENTITY_HINT =
  "Ajuda o Vendeo a entender a identidade da loja: influencia diretamente a copy das campanhas e, de forma indireta, o perfil e a direção visual.";

/** Hint da descrição curta: o que vende, para quem e diferencial factual (D7). */
export const SHORT_DESCRIPTION_HINT =
  "Diga o que sua loja vende, para quem e algum diferencial factual.";

/** Hint do slogan: frase pública já adotada — opcional (D7). */
export const SLOGAN_HINT =
  "Frase pública que sua loja já adota — preencha se sua loja já utiliza um.";

/** Indicador textual de campo recomendado (D3) — nunca só cor. */
export const RECOMMENDED_LABEL = "Recomendado";

/** Rótulo de campo opcional (D3). */
export const OPTIONAL_LABEL = "(opcional)";
