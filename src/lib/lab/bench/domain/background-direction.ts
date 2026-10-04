export const BENCH_BACKGROUND_LABELS = {
  studio: "Fundo de estúdio",
  ambient: "Cenário ambientado",
  original: "Manter cenário original",
} as const;

export type BenchBackgroundDirection = keyof typeof BENCH_BACKGROUND_LABELS;
