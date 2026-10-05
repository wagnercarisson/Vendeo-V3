export const BENCH_BACKGROUND_LABELS = {
  studio: "Fundo de estúdio",
  ambient: "Cenário ambientado",
  original: "Manter cenário original",
} as const;

export const BENCH_BACKGROUND_PROMPT_INSTRUCTIONS = {
  studio: "Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.",
  ambient: "Crie um cenário ambientado coerente com o produto e a marca, sem prejudicar a leitura.",
  original: "Mantenha o cenário da imagem enviada como base; não o substitua por outro.",
} as const;

export type BenchBackgroundDirection = keyof typeof BENCH_BACKGROUND_LABELS;
