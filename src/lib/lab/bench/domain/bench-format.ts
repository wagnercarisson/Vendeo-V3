/**
 * Resolvedor **interno da bancada** de formato/dimensões (quick 261107-hcx).
 *
 * Módulo puro, sem I/O, sem `process.env` e sem importar o resolvedor produtivo
 * (`src/lib/product-vertical-9-16`). A autoridade de **quais formatos estão
 * habilitados** continua sendo o `config-registry`; este módulo é a autoridade
 * dos **tamanhos e proporções** de cada formato habilitado.
 *
 * Regras travadas:
 *  - `1:1` → `1024x1024` (comportamento padrão preservado);
 *  - `9:16` → `1152x2048` (múltiplo de 16; proporção 9:16).
 *
 * Nenhum resize é executado aqui: o módulo apenas descreve o que deve ser
 * solicitado e o que deve ser validado nos bytes devolvidos.
 */

export const BENCH_FORMAT_IDS = ["1:1", "9:16", "4:5"] as const;

export type BenchFormatId = (typeof BENCH_FORMAT_IDS)[number];

export interface BenchFormatSpec {
  readonly id: BenchFormatId;
  /** Valor enviado ao provider no campo `size`. */
  readonly size: string;
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
}

export const BENCH_FORMAT_SPECS: Readonly<Record<BenchFormatId, BenchFormatSpec>> =
  Object.freeze({
    "1:1": Object.freeze({
      id: "1:1",
      size: "1024x1024",
      width: 1024,
      height: 1024,
      aspectRatio: 1,
    }),
    "9:16": Object.freeze({
      id: "9:16",
      size: "1152x2048",
      width: 1152,
      height: 2048,
      aspectRatio: 9 / 16,
    }),
    "4:5": Object.freeze({
      id: "4:5",
      size: "1152x1440",
      width: 1152,
      height: 1440,
      aspectRatio: 4 / 5,
    }),
  });

/** Erro determinístico para formato fora da tabela fechada da bancada. */
export class BenchFormatError extends Error {
  readonly code = "bench_format_unsupported" as const;
  readonly formato: string;

  constructor(formato: string) {
    super(`bench_format_unsupported:${formato}`);
    this.name = "BenchFormatError";
    this.formato = formato;
  }
}

export function isBenchFormat(value: unknown): value is BenchFormatId {
  return (
    typeof value === "string" &&
    (BENCH_FORMAT_IDS as readonly string[]).includes(value)
  );
}

/**
 * Resolve a spec fechada do formato. Valor ausente/desconhecido ⇒
 * `BenchFormatError` (`bench_format_unsupported`), antes de qualquer chamada paga.
 */
export function resolveBenchFormat(value: unknown): BenchFormatSpec {
  if (!isBenchFormat(value)) {
    throw new BenchFormatError(typeof value === "string" ? value : String(value));
  }
  return BENCH_FORMAT_SPECS[value];
}

export function sizeForFormat(value: unknown): string {
  return resolveBenchFormat(value).size;
}

export function expectedAspectRatioForFormat(value: unknown): number {
  return resolveBenchFormat(value).aspectRatio;
}

export function expectedDimensionsForFormat(value: unknown): {
  width: number;
  height: number;
} {
  const spec = resolveBenchFormat(value);
  return { width: spec.width, height: spec.height };
}

/**
 * Compara a dimensão REAL devolvida pelo provider com a dimensão esperada do
 * formato. Retorna `true` somente quando largura e altura coincidem exatamente.
 * Não há tolerância, resize, crop ou substituição silenciosa.
 */
export function matchesExpectedFormatSize(params: {
  formato: unknown;
  width: number | null;
  height: number | null;
}): boolean {
  const spec = resolveBenchFormat(params.formato);
  return params.width === spec.width && params.height === spec.height;
}
