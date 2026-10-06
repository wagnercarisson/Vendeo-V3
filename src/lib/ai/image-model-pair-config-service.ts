import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  assertEligibleModelPair,
  ImageModelPairNotEligibleError,
  type ImageModelPair,
  type ImageModelPairConfig,
  type ImagePairConfigOrigin,
  type ImageQuality,
} from "./image-model-pair";

/**
 * Leitura server-only e resolução **fail-closed** da configuração vigente do par
 * principal/fallback do novo fluxo Produto 1:1 (F56.1, D-05/D-06).
 *
 * Infraestrutura preparatória: lê a **linha vigente singleton** de
 * `image_model_pair_config` (scope `new_flow`, RLS service_role) com **cache
 * curto** e **invalidação explícita**, e resolve a configuração de forma
 * determinística. Nenhum default silencioso: ausência/incompletude e divergência
 * do catálogo elegível levantam **erro identificável** (D-06). Não importa nada
 * do fluxo legado de seleção (`ai_model_selection`) — isolamento D-07.
 *
 * Fronteira: este serviço é consumido server-side pelo runtime do novo fluxo
 * (planos 05/09). Nenhuma chamada a provider, banco real ou crédito ocorre aqui
 * além da leitura da configuração quando injetado o client real.
 */

/**
 * Linha vigente singleton de `image_model_pair_config` (migration F56.1
 * `20261005000001`). `scope` é sempre `new_flow`.
 */
export interface ImageModelPairConfigRow {
  scope: string;
  primary_model: string;
  primary_quality: string;
  fallback_model: string;
  fallback_quality: string;
  config_version_id: string;
  reason: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

/**
 * Configuração vigente resolvida: o par principal/fallback, a **versão** (UUID)
 * da configuração e a **origem** (D-12/D-13). Estruturalmente compatível com
 * `CurrentImageGenerationConfig` do snapshot (plano 05) — origem `"default"` não
 * existe.
 */
export interface ResolvedImageModelPairConfig extends ImageModelPairConfig {
  configVersionId: string;
  origin: ImagePairConfigOrigin;
  updatedBy: string | null;
  updatedAt: string;
  reason: string | null;
}

/** Código determinístico de configuração ausente/incompleta (D-06). */
export const IMAGE_MODEL_PAIR_CONFIG_MISSING = "image_model_pair_config_missing" as const;

/** Erro tipado: configuração ausente ou incompleta — fail-closed, sem default. */
export class ImageModelPairConfigMissingError extends Error {
  readonly code = IMAGE_MODEL_PAIR_CONFIG_MISSING;

  constructor() {
    super(IMAGE_MODEL_PAIR_CONFIG_MISSING);
    this.name = "ImageModelPairConfigMissingError";
  }
}

/** Código determinístico de configuração divergente do catálogo elegível (D-06). */
export const IMAGE_MODEL_PAIR_CONFIG_DIVERGENT = "image_model_pair_config_divergent" as const;

/** Erro tipado: configuração aponta para modelo/qualidade fora do catálogo (D-06). */
export class ImageModelPairConfigDivergentError extends Error {
  readonly code = IMAGE_MODEL_PAIR_CONFIG_DIVERGENT;
  readonly field: "model" | "quality";
  readonly pair: ImageModelPair;

  constructor(pair: ImageModelPair, field: "model" | "quality") {
    super(`${IMAGE_MODEL_PAIR_CONFIG_DIVERGENT}:${field}`);
    this.name = "ImageModelPairConfigDivergentError";
    this.field = field;
    this.pair = pair;
  }
}

/** Código determinístico de falha de leitura da configuração (fail-closed). */
export const IMAGE_MODEL_PAIR_CONFIG_READ_FAILED = "image_model_pair_config_read_failed" as const;

/** Erro tipado de leitura da configuração — nunca mascara a ausência como null. */
export class ImageModelPairConfigReadError extends Error {
  readonly code = IMAGE_MODEL_PAIR_CONFIG_READ_FAILED;

  constructor(detail: string) {
    super(`${IMAGE_MODEL_PAIR_CONFIG_READ_FAILED}:${detail}`);
    this.name = "ImageModelPairConfigReadError";
  }
}

function isCompleteRow(row: ImageModelPairConfigRow): boolean {
  return Boolean(
    row.primary_model &&
      row.primary_quality &&
      row.fallback_model &&
      row.fallback_quality &&
      row.config_version_id,
  );
}

/**
 * Origem da configuração vigente. Toda configuração persistida passa pela RPC
 * auditada com ator obrigatório (D-04), então a presença de autor registra a
 * procedência como **decisão humana expressa**; sem autor (linha semeada
 * manualmente) a procedência é a seleção. `"default"` nunca é uma origem (D-12).
 */
export function resolveImageModelPairConfigOrigin(
  row: ImageModelPairConfigRow,
): ImagePairConfigOrigin {
  return row.updated_by ? "human_decision" : "selection";
}

/**
 * Resolve a configuração a partir da linha vigente de forma **fail-closed**
 * (D-06): linha ausente/incompleta → `ImageModelPairConfigMissingError`; par fora
 * do catálogo elegível → `ImageModelPairConfigDivergentError`. Nunca devolve o
 * par inicial nem troca o modelo por default.
 */
export function resolveImageModelPairConfigFromRow(
  row: ImageModelPairConfigRow | null,
): ResolvedImageModelPairConfig {
  if (!row) throw new ImageModelPairConfigMissingError();
  if (!isCompleteRow(row)) throw new ImageModelPairConfigMissingError();

  const primary: ImageModelPair = {
    model: row.primary_model,
    quality: row.primary_quality as ImageQuality,
  };
  const fallback: ImageModelPair = {
    model: row.fallback_model,
    quality: row.fallback_quality as ImageQuality,
  };

  try {
    assertEligibleModelPair(primary);
    assertEligibleModelPair(fallback);
  } catch (error) {
    if (error instanceof ImageModelPairNotEligibleError) {
      throw new ImageModelPairConfigDivergentError(error.pair, error.field);
    }
    throw error;
  }

  return {
    primary,
    fallback,
    configVersionId: row.config_version_id,
    origin: resolveImageModelPairConfigOrigin(row),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    reason: row.reason,
  };
}

/**
 * Serviço de leitura/cache da configuração vigente. O client é injetável
 * (`SupabaseClient = supabaseAdmin`) e `now()`/TTL são injetáveis para testes. O
 * cache é curto e há **dedupe in-flight por epoch**, com invalidação explícita
 * após cada alteração (D-05).
 */
export class ImageModelPairConfigService {
  private cache: { expiresAt: number; row: ImageModelPairConfigRow | null } | null = null;
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
      if (epoch === this.invalidationEpoch && this.inFlight?.promise === promise) {
        this.cache = { row, expiresAt: this.now() + this.ttlMs };
      }
      return row;
    } finally {
      if (this.inFlight?.promise === promise) this.inFlight = null;
    }
  }

  async resolveImageModelPairConfig(): Promise<ResolvedImageModelPairConfig> {
    return resolveImageModelPairConfigFromRow(await this.getImageModelPairConfig());
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
