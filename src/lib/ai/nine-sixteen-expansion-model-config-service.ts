import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  resolveNineSixteenExpansionConfigFromRow,
  type ExpansionSelection,
  type NineSixteenExpansionConfigRow,
} from "./nine-sixteen-expansion-model-config";

export {
  LEGACY_SUNBURST_LOW,
  NINE_SIXTEEN_EXPANSION_CONFIG_DIVERGENT,
  NINE_SIXTEEN_EXPANSION_CONFIG_MISSING,
  NINE_SIXTEEN_EXPANSION_MODEL_NOT_ELIGIBLE,
  NINE_SIXTEEN_EXPANSION_MODELS,
  NineSixteenExpansionConfigDivergentError,
  NineSixteenExpansionConfigMissingError,
  NineSixteenExpansionModelNotEligibleError,
  isExpansionSelection,
  isNineSixteenExpansionModel,
  resolveNineSixteenExpansionConfigFromRow,
  type ExpansionSelection,
  type ExpansionSelectionOrigin,
  type NineSixteenExpansionConfigRow,
  type NineSixteenExpansionModel,
} from "./nine-sixteen-expansion-model-config";

/**
 * Leitura server-only e **estrita** da configuração administrativa da expansão
 * 9:16 (F60.6, D5).
 *
 * O resultado é discriminado e nunca mascara estado:
 * - `found` — linha vigente válida (seleção + versão + origem `configured`);
 * - `absent` — ausência comprovada (`data === null` sem erro);
 * - `invalid` — linha presente fora das listas/contrato (não é corrigida);
 * - `read_failed` — erro de banco/exceção do client (nunca vira ausência).
 *
 * Consulta **somente** `nine_sixteen_expansion_model_config`: a configuração da
 * expansão é independente do par 1:1, da seleção legada e do snapshot da base
 * quadrada. Não existe caminho de escrita/reset aqui.
 */

/** Código determinístico de falha de leitura (nunca ausência). */
export const NINE_SIXTEEN_EXPANSION_CONFIG_READ_FAILED =
  "nine_sixteen_expansion_config_read_failed" as const;

/** Erro tipado de leitura — carrega apenas a mensagem segura do client. */
export class NineSixteenExpansionConfigReadError extends Error {
  readonly code = NINE_SIXTEEN_EXPANSION_CONFIG_READ_FAILED;

  constructor(detail: string) {
    super(`${NINE_SIXTEEN_EXPANSION_CONFIG_READ_FAILED}:${detail}`);
    this.name = "NineSixteenExpansionConfigReadError";
  }
}

/**
 * Metadados de auditoria da linha vigente (autor/data/motivo).
 *
 * A UI administrativa (F60.6-05) precisa exibir quem alterou, quando e por quê.
 * Eles vêm da MESMA leitura estrita — nunca de uma segunda consulta nem de um
 * valor fabricado no cliente. Aditivo: consumidores das fases 02-04 seguem
 * usando apenas `selection`.
 */
export interface NineSixteenExpansionConfigMetadata {
  readonly updatedBy: string | null;
  readonly updatedAt: string;
  readonly reason: string | null;
}

/** Resultado discriminado da leitura estrita. */
export type NineSixteenExpansionConfigReadResult =
  | {
      kind: "found";
      selection: ExpansionSelection;
      metadata: NineSixteenExpansionConfigMetadata;
    }
  | { kind: "absent" }
  | { kind: "invalid"; reason: string }
  | { kind: "read_failed"; reason: string };

type CacheableNineSixteenExpansionConfigReadResult = Extract<
  NineSixteenExpansionConfigReadResult,
  { kind: "found" } | { kind: "absent" }
>;

function isCacheableResult(
  result: NineSixteenExpansionConfigReadResult,
): result is CacheableNineSixteenExpansionConfigReadResult {
  return result.kind === "found" || result.kind === "absent";
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const DEFAULT_TTL_MS = 30_000;

/**
 * Serviço de leitura com cache curto, dedupe in-flight por epoch e invalidação
 * explícita (mesmo esqueleto do par 1:1, D2/D5).
 *
 * `found` e `absent` são cacheados; `read_failed`/`invalid` nunca são, para não
 * prolongar um estado transitório de leitura. O client é injetável e o global
 * (`supabaseAdmin`) só é resolvido no momento da leitura — assim o composition
 * root sempre pode entregar o client da própria fábrica.
 */
export class NineSixteenExpansionConfigService {
  private readonly injectedClient: SupabaseClient | null;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private cache: {
    expiresAt: number;
    result: CacheableNineSixteenExpansionConfigReadResult;
  } | null = null;
  private inFlight: {
    epoch: number;
    promise: Promise<NineSixteenExpansionConfigReadResult>;
  } | null = null;
  private invalidationEpoch = 0;

  constructor(
    client?: SupabaseClient,
    ttlMs: number = DEFAULT_TTL_MS,
    now: () => number = () => Date.now(),
  ) {
    this.injectedClient = client ?? null;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  private get client(): SupabaseClient {
    return this.injectedClient ?? supabaseAdmin;
  }

  async readNineSixteenExpansionConfig(): Promise<NineSixteenExpansionConfigReadResult> {
    if (this.cache && this.cache.expiresAt > this.now()) return this.cache.result;

    const epoch = this.invalidationEpoch;
    if (this.inFlight?.epoch === epoch) return this.inFlight.promise;

    const promise = this.loadResult();
    this.inFlight = { epoch, promise };
    try {
      const result = await promise;
      if (
        epoch === this.invalidationEpoch &&
        this.inFlight?.promise === promise &&
        isCacheableResult(result)
      ) {
        this.cache = { expiresAt: this.now() + this.ttlMs, result };
      }
      return result;
    } finally {
      if (this.inFlight?.promise === promise) this.inFlight = null;
    }
  }

  invalidateNineSixteenExpansionConfigCache(): void {
    this.invalidationEpoch += 1;
    this.cache = null;
    this.inFlight = null;
  }

  private async loadResult(): Promise<NineSixteenExpansionConfigReadResult> {
    let row: NineSixteenExpansionConfigRow | null;
    try {
      row = await this.loadConfigRow();
    } catch (error) {
      return { kind: "read_failed", reason: this.readFailureReason(error) };
    }

    if (row === null) return { kind: "absent" };

    try {
      const selection = resolveNineSixteenExpansionConfigFromRow(row);
      return {
        kind: "found",
        selection,
        metadata: {
          updatedBy: row.updated_by ?? null,
          updatedAt: row.updated_at,
          reason: row.reason ?? null,
        },
      };
    } catch (error) {
      // Linha PRESENTE, mas incompleta/divergente: nunca vira `absent` (que e
      // reservado para `data === null` sem erro).
      return { kind: "invalid", reason: errorDetail(error) };
    }
  }

  private readFailureReason(error: unknown): string {
    if (error instanceof NineSixteenExpansionConfigReadError) return error.message;
    return new NineSixteenExpansionConfigReadError(errorDetail(error)).message;
  }

  private async loadConfigRow(): Promise<NineSixteenExpansionConfigRow | null> {
    const { data, error } = await this.client
      .from("nine_sixteen_expansion_model_config")
      .select("*")
      .eq("scope", "expansion")
      .maybeSingle();

    if (error) throw new NineSixteenExpansionConfigReadError(error.message);

    // `absent` e exclusivo de `data === null` sem erro. `undefined`, array ou
    // qualquer resposta malformada e falha de leitura, nunca ausencia.
    if (data === null) return null;
    if (data === undefined || typeof data !== "object" || Array.isArray(data)) {
      throw new NineSixteenExpansionConfigReadError("malformed_response");
    }

    return data as NineSixteenExpansionConfigRow;
  }
}

export const nineSixteenExpansionConfigService = new NineSixteenExpansionConfigService();

/**
 * Lê a configuração estrita da expansão. Quando `client` é informado, usa
 * **exatamente** esse client (mesma fábrica/ambiente); caso contrário, delega ao
 * singleton server-only.
 */
export async function readNineSixteenExpansionConfig(
  deps: { client?: SupabaseClient } = {},
): Promise<NineSixteenExpansionConfigReadResult> {
  if (deps.client) {
    return new NineSixteenExpansionConfigService(deps.client).readNineSixteenExpansionConfig();
  }
  return nineSixteenExpansionConfigService.readNineSixteenExpansionConfig();
}

/** Invalida o cache curto do singleton após uma alteração administrativa. */
export function invalidateNineSixteenExpansionConfigCache(): void {
  nineSixteenExpansionConfigService.invalidateNineSixteenExpansionConfigCache();
}
