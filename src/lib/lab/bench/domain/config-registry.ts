import { BenchDimensionsSchema, type BenchConfig, type BenchDimensions } from "./schemas";

/**
 * Registry de dimensões da bancada (F48.2.2, D6) — **puro e testável**, no padrão
 * de `MODEL_ALLOWLIST`/`validateRegistry` (`src/lib/ai/model-registry.ts`).
 *
 * É a **autoridade** sobre quais valores estão habilitados. A configuração
 * persistida contém apenas valores aceitos por este registry e **nenhum** CHECK
 * por valor é criado no banco (D6) — a expansão futura não exige migration.
 *
 * As dimensões `modelo` e `qualidade` **não** são governadas aqui: elas são
 * resolvidas pelo registry de presets (`preset-registry.ts`, D7). Este registry
 * governa `pipeline`, `formato`, `intencao`, `tipoConteudo`, `estrutura` e `tema`.
 */

// ─── Tipos do registry ───────────────────────────────────────────────────────

export interface BenchRegistryEntry {
  id: string;
  label: string;
  enabled: boolean;
  /** Motivo explícito quando `enabled: false` (ex.: `fora_do_primeiro_recorte`). */
  reason?: string;
}

/** Dimensões governadas por este registry (as demais vêm dos presets). */
export const BENCH_REGISTRY_DIMENSIONS = [
  "pipeline",
  "formato",
  "intencao",
  "tipoConteudo",
  "estrutura",
  "tema",
] as const;

export type BenchRegistryDimension = (typeof BENCH_REGISTRY_DIMENSIONS)[number];

/** O "recorte" habilitado — as seis dimensões governadas por este registry. */
export type BenchRecorteConfig = Pick<BenchConfig, BenchRegistryDimension>;

// ─── Registry (primeiro recorte + valores futuros desabilitados) ─────────────

const FORA_DO_RECORTE = "fora_do_primeiro_recorte";

export const BENCH_CONFIG_REGISTRY: Record<BenchRegistryDimension, readonly BenchRegistryEntry[]> = {
  pipeline: [
    { id: "manual-direto", label: "Manual direto", enabled: true },
    {
      id: "ia-assistido",
      label: "IA assistido (futuro)",
      enabled: false,
      reason: FORA_DO_RECORTE,
    },
  ],
  formato: [
    { id: "1:1", label: "Quadrado 1:1", enabled: true },
    { id: "9:16", label: "Vertical 9:16", enabled: false, reason: FORA_DO_RECORTE },
  ],
  intencao: [
    { id: "oferta", label: "Oferta", enabled: true },
    { id: "destaque", label: "Destaque", enabled: true },
    { id: "exclusivo", label: "Exclusivo", enabled: true },
  ],
  tipoConteudo: [
    { id: "produto", label: "Produto", enabled: true },
    { id: "servico", label: "Serviço", enabled: false, reason: FORA_DO_RECORTE },
    { id: "informativo", label: "Informativo", enabled: false, reason: FORA_DO_RECORTE },
  ],
  estrutura: [
    { id: "peca-unica", label: "Peça única", enabled: true },
    { id: "carrossel", label: "Carrossel", enabled: false, reason: FORA_DO_RECORTE },
  ],
  tema: [
    { id: "nenhum", label: "Nenhum", enabled: true },
    {
      id: "datas-comemorativas",
      label: "Datas comemorativas (futuro)",
      enabled: false,
      reason: FORA_DO_RECORTE,
    },
  ],
};

/** Primeiro recorte habilitado (os seis valores travados da F48.2.2). */
export const DEFAULT_BENCH_CONFIG: BenchRecorteConfig = {
  pipeline: "manual-direto",
  formato: "1:1",
  intencao: "oferta",
  tipoConteudo: "produto",
  estrutura: "peca-unica",
  tema: "nenhum",
};

/** Maps the stable UI campaign intent contract to policy registry identifiers. */
export function resolveBenchPolicyIntent(intent: "offer" | "spotlight" | "exclusive"):
  BenchRecorteConfig["intencao"] {
  switch (intent) {
    case "offer": return "oferta";
    case "spotlight": return "destaque";
    case "exclusive": return "exclusivo";
  }
}

// ─── Erro determinístico do registry ─────────────────────────────────────────

export type BenchConfigRegistryErrorCode =
  | "config_registry_unknown_value"
  | "config_registry_value_disabled";

/**
 * Lançado quando um valor de dimensão não existe no registry
 * (`config_registry_unknown_value`) ou existe mas está desabilitado
 * (`config_registry_value_disabled`). Carrega o motivo quando desabilitado.
 */
export class BenchConfigRegistryError extends Error {
  readonly code: BenchConfigRegistryErrorCode;
  readonly dimension: string;
  readonly value: string;
  readonly reason?: string;

  constructor(params: {
    dimension: string;
    value: string;
    code: BenchConfigRegistryErrorCode;
    reason?: string;
  }) {
    super(
      `${params.code}:${params.dimension}=${params.value}${
        params.reason ? ` (${params.reason})` : ""
      }`,
    );
    this.name = "BenchConfigRegistryError";
    this.code = params.code;
    this.dimension = params.dimension;
    this.value = params.value;
    this.reason = params.reason;
  }
}

// ─── Leitura e resolução ─────────────────────────────────────────────────────

/** Lista as entradas (habilitadas e desabilitadas com motivo) de uma dimensão. */
export function listBenchConfigOptions(
  dimension: BenchRegistryDimension,
): readonly BenchRegistryEntry[] {
  return BENCH_CONFIG_REGISTRY[dimension];
}

function findEntry(
  dimension: BenchRegistryDimension,
  value: string,
): BenchRegistryEntry | undefined {
  return BENCH_CONFIG_REGISTRY[dimension].find((entry) => entry.id === value);
}

/**
 * Resolve a configuração da bancada validando as dimensões governadas pelo
 * registry. Um valor ausente do registry lança
 * `config_registry_unknown_value`; um valor desabilitado lança
 * `config_registry_value_disabled` (com o motivo). `modelo`/`qualidade`
 * atravessam intactos — a autoridade deles é o registry de presets.
 */
export function resolveBenchConfig(input: BenchDimensions): BenchConfig {
  const parsed = BenchDimensionsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Configuração da bancada inválida: ${JSON.stringify(
        parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      )}`,
    );
  }

  for (const dimension of BENCH_REGISTRY_DIMENSIONS) {
    const value = parsed.data[dimension];
    const entry = findEntry(dimension, value);
    if (!entry) {
      throw new BenchConfigRegistryError({
        dimension,
        value,
        code: "config_registry_unknown_value",
      });
    }
    if (!entry.enabled) {
      throw new BenchConfigRegistryError({
        dimension,
        value,
        code: "config_registry_value_disabled",
        reason: entry.reason,
      });
    }
  }

  return { ...parsed.data };
}

/**
 * Validação fail-fast do registry (padrão `validateRegistry`): cada dimensão
 * precisa existir, ter ao menos uma entrada habilitada e ids únicos.
 */
export function validateBenchConfigRegistry(): void {
  for (const dimension of BENCH_REGISTRY_DIMENSIONS) {
    const entries = BENCH_CONFIG_REGISTRY[dimension];
    if (!entries || entries.length === 0) {
      throw new Error(`[bench-config-registry] dimensão sem entradas: ${dimension}`);
    }
    const ids = new Set<string>();
    for (const entry of entries) {
      if (ids.has(entry.id)) {
        throw new Error(`[bench-config-registry] id duplicado em ${dimension}: ${entry.id}`);
      }
      ids.add(entry.id);
      if (!entry.enabled && !entry.reason) {
        throw new Error(
          `[bench-config-registry] entrada desabilitada sem motivo em ${dimension}: ${entry.id}`,
        );
      }
    }
    if (!entries.some((entry) => entry.enabled)) {
      throw new Error(`[bench-config-registry] nenhuma entrada habilitada em ${dimension}`);
    }
  }
}

// Validação no carregamento (fail-fast em registry inválido).
validateBenchConfigRegistry();
