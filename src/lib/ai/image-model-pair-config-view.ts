import "server-only";
import {
  ELIGIBLE_IMAGE_MODELS,
  ELIGIBLE_IMAGE_QUALITIES,
  isEligibleImageModel,
  isEligibleImageQuality,
  type ImageModelPair,
  type ImageModelPairConfig,
  type ImagePairConfigOrigin,
  type ImageQuality,
} from "./image-model-pair";
import {
  imageModelPairConfigService,
  resolveImageModelPairConfigOrigin,
  type ImageModelPairConfigRow,
} from "./image-model-pair-config-service";
import { getImagePairPricingService, resolveImagePairCoverage } from "@/lib/ai-cost/image-pair-pricing";
import type {
  ImagePairCapacityPricingStatus,
  ImagePairPricingCoverage,
  ImagePairTargetPricingStatus,
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

/**
 * Resolvedor de cobertura de UM par `modelo + qualidade` injetável (default:
 * `getImagePairPricingService().resolveTargetCoverage`). Alimenta o mapa
 * `targetCoverageByPair` que permite ao cliente recomputar a cobertura do par
 * em rascunho sem chamadas de rede adicionais (UI-SPEC L322).
 */
export type ImageModelPairTargetCoverageResolver = (
  pair: ImageModelPair,
) => Promise<ImagePairTargetPricingStatus>;

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
  /**
   * Cobertura de pricing de TODOS os pares elegíveis (`${model}|${quality}`),
   * para o formulário recomputar a cobertura do par em rascunho ao vivo. Estado
   * vazio → `{}`. Aditivo (não altera `pricing` nem a resolução de execução).
   */
  targetCoverageByPair: Record<string, ImagePairTargetPricingStatus>;
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
    targetCoverageByPair: {},
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
 * Cobertura de TODOS os pares elegíveis (3 modelos × 2 qualidades), chaveada por
 * `${model}|${quality}`. Tolerante por design: um par cuja leitura falhe é
 * omitido do mapa (o cliente trata cobertura desconhecida sem inferir `complete`).
 */
async function buildTargetCoverageByPair(
  resolver: ImageModelPairTargetCoverageResolver,
): Promise<Record<string, ImagePairTargetPricingStatus>> {
  const entries = await Promise.all(
    ELIGIBLE_IMAGE_MODELS.flatMap((model) =>
      ELIGIBLE_IMAGE_QUALITIES.map(
        async (quality): Promise<[string, ImagePairTargetPricingStatus] | null> => {
          try {
            const status = await resolver({ model, quality });
            return [`${model}|${quality}`, status];
          } catch {
            return null;
          }
        },
      ),
    ),
  );

  return Object.fromEntries(
    entries.filter((entry): entry is [string, ImagePairTargetPricingStatus] => entry !== null),
  );
}

/**
 * Monta o view model admin. Dependências injetáveis: o serviço de leitura e os
 * resolvedores de pricing (default: `resolveImagePairCoverage` para o par vigente
 * e `getImagePairPricingService().resolveTargetCoverage` para o mapa por par).
 * Não lança no estado vazio, em divergência nem em falha de leitura.
 */
export async function buildImageModelPairConfigView(
  dependencies: {
    service?: Pick<ImageModelPairConfigServiceLike, "getImageModelPairConfig">;
    pricingResolver?: ImageModelPairConfigPricingResolver;
    targetCoverageResolver?: ImageModelPairTargetCoverageResolver;
  } = {},
): Promise<ImageModelPairConfigView> {
  const service = dependencies.service ?? imageModelPairConfigService;
  const pricingResolver =
    dependencies.pricingResolver ?? ((pair: ImageModelPairConfig) => resolveImagePairCoverage(pair));
  const targetCoverageResolver =
    dependencies.targetCoverageResolver ??
    ((pair: ImageModelPair) => getImagePairPricingService().resolveTargetCoverage(pair));

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

  const targetCoverageByPair = await buildTargetCoverageByPair(targetCoverageResolver);

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
    targetCoverageByPair,
    readError: null,
  };
}

/** Contrato mínimo de leitura aceito pela view (facilita fake em testes). */
export interface ImageModelPairConfigServiceLike {
  getImageModelPairConfig(): Promise<ImageModelPairConfigRow | null>;
}
