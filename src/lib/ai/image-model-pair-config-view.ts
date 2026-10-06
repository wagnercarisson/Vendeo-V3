import "server-only";
import {
  ELIGIBLE_IMAGE_MODELS,
  ELIGIBLE_IMAGE_QUALITIES,
  isEligibleImageModel,
  isEligibleImageQuality,
  type ImageModelPairConfig,
  type ImagePairConfigOrigin,
  type ImageQuality,
} from "./image-model-pair";
import {
  imageModelPairConfigService,
  resolveImageModelPairConfigOrigin,
  type ImageModelPairConfigRow,
} from "./image-model-pair-config-service";
import { resolveImagePairCoverage } from "@/lib/ai-cost/image-pair-pricing";
import type {
  ImagePairCapacityPricingStatus,
  ImagePairPricingCoverage,
} from "@/lib/ai-cost/types";

/**
 * View model da configuração do par principal/fallback para a tela admin
 * (F56.1, D-09/D-23). Expõe o **catálogo elegível**, o **par vigente**, a
 * **origem**, a **versão** e a **cobertura de pricing por par**
 * (`complete`/`partial`/`missing`), além do aviso de que a configuração **não
 * está ativa em produção**.
 *
 * Server-only e tolerante: o estado vazio (sem linha vigente) e falhas de leitura
 * **não lançam** — a tela precisa renderizar mesmo quando a configuração ainda
 * não existe ou o banco está indisponível. A geração/execução continua
 * fail-closed no resolvedor (`resolveImageModelPairConfig`), não aqui.
 */

/** Resolvedor de cobertura de pricing injetável (testes usam fake em memória). */
export type ImageModelPairConfigPricingResolver = (
  pair: ImageModelPairConfig,
) => Promise<ImagePairCapacityPricingStatus>;

export interface ImageModelPairConfigView {
  /** Catálogo elegível fechado de modelos (D-02). */
  eligibleModels: readonly string[];
  /** Catálogo elegível fechado de qualidades (D-02). */
  eligibleQualities: readonly string[];
  /** `true` quando existe linha vigente. */
  configured: boolean;
  /** Par vigente (principal + fallback), ou `null` quando ausente. */
  current: ImageModelPairConfig | null;
  /** `true` quando o par vigente pertence ao catálogo elegível. */
  eligible: boolean;
  /** Origem da configuração vigente (`human_decision` | `selection`). */
  origin: ImagePairConfigOrigin | null;
  /** UUID da versão vigente da configuração. */
  configVersionId: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  reason: string | null;
  /** A configuração NUNCA está ativa em produção nesta fase (D-03/D-23). */
  productionActive: false;
  /** Cobertura agregada `complete`/`partial`/`missing`. */
  pricingCoverage: ImagePairPricingCoverage | null;
  /** Cobertura detalhada por par (principal e fallback). */
  pricing: ImagePairCapacityPricingStatus | null;
  /** Mensagem de falha de leitura (a view não lança). */
  readError: string | null;
}

function emptyView(readError: string | null = null): ImageModelPairConfigView {
  return {
    eligibleModels: ELIGIBLE_IMAGE_MODELS,
    eligibleQualities: ELIGIBLE_IMAGE_QUALITIES,
    configured: false,
    current: null,
    eligible: false,
    origin: null,
    configVersionId: null,
    updatedBy: null,
    updatedAt: null,
    reason: null,
    productionActive: false,
    pricingCoverage: null,
    pricing: null,
    readError,
  };
}

function readPair(row: ImageModelPairConfigRow): ImageModelPairConfig {
  return {
    primary: { model: row.primary_model, quality: row.primary_quality as ImageQuality },
    fallback: { model: row.fallback_model, quality: row.fallback_quality as ImageQuality },
  };
}

function isEligiblePair(pair: ImageModelPairConfig): boolean {
  return (
    isEligibleImageModel(pair.primary.model) &&
    isEligibleImageQuality(pair.primary.quality) &&
    isEligibleImageModel(pair.fallback.model) &&
    isEligibleImageQuality(pair.fallback.quality)
  );
}

/**
 * Monta o view model admin. Dependências injetáveis: o serviço de leitura e o
 * resolvedor de pricing (default: `resolveImagePairCoverage` do plano 04). Não
 * lança no estado vazio, em divergência nem em falha de leitura.
 */
export async function buildImageModelPairConfigView(
  dependencies: {
    service?: Pick<ImageModelPairConfigServiceLike, "getImageModelPairConfig">;
    pricingResolver?: ImageModelPairConfigPricingResolver;
  } = {},
): Promise<ImageModelPairConfigView> {
  const service = dependencies.service ?? imageModelPairConfigService;
  const pricingResolver =
    dependencies.pricingResolver ?? ((pair: ImageModelPairConfig) => resolveImagePairCoverage(pair));

  let row: ImageModelPairConfigRow | null;
  try {
    row = await service.getImageModelPairConfig();
  } catch (error) {
    return emptyView(error instanceof Error ? error.message : String(error));
  }

  if (!row) return emptyView();

  const current = readPair(row);
  const eligible = isEligiblePair(current);

  let pricing: ImagePairCapacityPricingStatus | null = null;
  if (eligible) {
    pricing = await pricingResolver(current);
  }

  return {
    eligibleModels: ELIGIBLE_IMAGE_MODELS,
    eligibleQualities: ELIGIBLE_IMAGE_QUALITIES,
    configured: true,
    current,
    eligible,
    origin: resolveImageModelPairConfigOrigin(row),
    configVersionId: row.config_version_id ?? null,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    reason: row.reason,
    productionActive: false,
    pricingCoverage: pricing?.pricingCoverage ?? null,
    pricing,
    readError: null,
  };
}

/** Contrato mínimo de leitura aceito pela view (facilita fake em testes). */
export interface ImageModelPairConfigServiceLike {
  getImageModelPairConfig(): Promise<ImageModelPairConfigRow | null>;
}
