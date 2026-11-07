import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  resolveImageModelPairConfigFromRow,
  type ImageModelPairConfigRow,
  type ResolvedImageModelPairConfig,
} from "./image-model-pair-config-row";

export {
  IMAGE_MODEL_PAIR_CONFIG_DIVERGENT,
  IMAGE_MODEL_PAIR_CONFIG_MISSING,
  ImageModelPairConfigDivergentError,
  ImageModelPairConfigMissingError,
  resolveImageModelPairConfigFromRow,
  resolveImageModelPairConfigOrigin,
  type ImageModelPairConfigRow,
  type ResolvedImageModelPairConfig,
} from "./image-model-pair-config-row";

/**
 * Leitura server-only e resolução **fail-closed** da configuração vigente do par
 * principal/fallback do novo fluxo Produto 1:1 (F56.1, D-05/D-06).
 *
 * O contrato puro (linha, erros e resolução) vive em
 * `image-model-pair-config-row.ts` para ser reutilizado por ferramentas de
 * prova; este módulo mantém a leitura/cache server-side e reexporta os mesmos
 * símbolos, sem alterar o comportamento do fluxo 1:1.
 */

/** Código determinístico de falha de leitura da configuração (fail-closed). */
export const IMAGE_MODEL_PAIR_CONFIG_READ_FAILED =
  "image_model_pair_config_read_failed" as const;

/** Erro tipado de leitura da configuração — nunca mascara a ausência como null. */
export class ImageModelPairConfigReadError extends Error {
  readonly code = IMAGE_MODEL_PAIR_CONFIG_READ_FAILED;

  constructor(detail: string) {
    super(`${IMAGE_MODEL_PAIR_CONFIG_READ_FAILED}:${detail}`);
    this.name = "ImageModelPairConfigReadError";
  }
}

/**
 * Serviço de leitura/cache da configuração vigente. O client é injetável
 * (`SupabaseClient = supabaseAdmin`) e `now()`/TTL são injetáveis para testes. O
 * cache é curto e há **dedupe in-flight por epoch**, com invalidação explícita
 * após cada alteração (D-05).
 */
export class ImageModelPairConfigService {
  private cache: {
    expiresAt: number;
    row: ImageModelPairConfigRow | null;
  } | null = null;
  private inFlight: {
    epoch: number;
    promise: Promise<ImageModelPairConfigRow | null>;
  } | null = null;
  private invalidationEpoch = 0;

  constructor(
    private readonly client: SupabaseClient = supabaseAdmin,
    private readonly ttlMs = 30_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async getImageModelPairConfig(): Promise<ImageModelPairConfigRow | null> {
    if (this.cache && this.cache.expiresAt > this.now()) return this.cache.row;

    const epoch = this.invalidationEpoch;
    if (this.inFlight?.epoch === epoch) return this.inFlight.promise;

    const promise = this.loadConfigRow();
    this.inFlight = { epoch, promise };
    try {
      const row = await promise;
      if (
        epoch === this.invalidationEpoch &&
        this.inFlight?.promise === promise
      ) {
        this.cache = { row, expiresAt: this.now() + this.ttlMs };
      }
      return row;
    } finally {
      if (this.inFlight?.promise === promise) this.inFlight = null;
    }
  }

  async resolveImageModelPairConfig(): Promise<ResolvedImageModelPairConfig> {
    return resolveImageModelPairConfigFromRow(
      await this.getImageModelPairConfig(),
    );
  }

  invalidateImageModelPairConfigCache(): void {
    this.invalidationEpoch += 1;
    this.cache = null;
    this.inFlight = null;
  }

  private async loadConfigRow(): Promise<ImageModelPairConfigRow | null> {
    const { data, error } = await this.client
      .from("image_model_pair_config")
      .select("*")
      .eq("scope", "new_flow")
      .maybeSingle();
    if (error) throw new ImageModelPairConfigReadError(error.message);
    return (data as ImageModelPairConfigRow | null) ?? null;
  }
}

export const imageModelPairConfigService = new ImageModelPairConfigService();

/** Lê a linha vigente singleton (`new_flow`) com o client server-only. */
export async function getImageModelPairConfig(): Promise<ImageModelPairConfigRow | null> {
  return imageModelPairConfigService.getImageModelPairConfig();
}

/** Resolve a configuração vigente de forma fail-closed (D-06). */
export async function resolveImageModelPairConfig(): Promise<ResolvedImageModelPairConfig> {
  return imageModelPairConfigService.resolveImageModelPairConfig();
}

/** Invalida o cache curto do singleton após uma alteração (D-05). */
export function invalidateImageModelPairConfigCache(): void {
  imageModelPairConfigService.invalidateImageModelPairConfigCache();
}
