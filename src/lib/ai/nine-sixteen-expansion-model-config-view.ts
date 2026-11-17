import "server-only";

import {
  ELIGIBLE_IMAGE_QUALITIES,
  type EligibleImageQuality,
} from "@/lib/ai/image-model-pair";
import { AiModelPricingService } from "@/lib/ai-cost/ai-model-pricing";
import {
  evaluatePricingCoverage,
  type PricingCoverageOptions,
} from "@/lib/campaign/vertical-expansion/model";
import {
  NINE_SIXTEEN_EXPANSION_MODELS,
  type ExpansionSelection,
  type NineSixteenExpansionModel,
} from "./nine-sixteen-expansion-model-config";
import {
  nineSixteenExpansionConfigService,
  type NineSixteenExpansionConfigReadResult,
} from "./nine-sixteen-expansion-model-config-service";

/**
 * View model administrativo da configuração da expansão 9:16 (F60.6, D7/D5).
 *
 * Descreve **apenas** estado conhecido — vigente, ausente, inválida ou falha de
 * leitura. Não existe campo de ativação de produção nem qualquer rótulo/marcador
 * de ativação: selecionar modelo e qualidade **não** é ativar o fluxo (a
 * habilitação continua em outro mecanismo, fora desta superfície).
 *
 * Tolerante por contrato: estado vazio, linha inválida e falha de leitura
 * **nunca lançam**. A execução segue fail-closed no preflight do orquestrador,
 * não aqui.
 *
 * Cobertura de pricing: derivada das **tarifas de usage** aplicáveis ao par
 * modelo+qualidade (`AiModelPricingService.getModelPricing` +
 * `evaluatePricingCoverage`). `image_unit_usd` é apenas estimativa opcional e
 * NUNCA participa da decisão do badge — por isso esta view não reutiliza o
 * resolvedor de cobertura do par 1:1 (que exige somente o componente de
 * unidade de imagem, suficiente para o par 1:1 e insuficiente aqui).
 */

/**
 * Cobertura de pricing de UMA combinação da expansão (modelo + qualidade).
 *
 * `pricingCoverage`:
 * - `complete` — linha vigente com todas as tarifas de usage aplicáveis;
 * - `partial` — linha existe, mas faltam tarifas de usage (`incomplete_coverage`);
 * - `missing` — linha ausente (`row_missing`) ou `code_default`.
 *
 * `missingComponents` lista os componentes ausentes devolvidos por
 * `evaluatePricingCoverage` (nunca inclui `image_unit`).
 */
export interface NineSixteenExpansionCoverageStatus {
  readonly model: NineSixteenExpansionModel;
  readonly quality: EligibleImageQuality;
  readonly pricingCoverage: "complete" | "partial" | "missing";
  readonly missingComponents: readonly string[];
}

/** Resolvedor de cobertura de UMA combinação (injetável nos testes). */
export type NineSixteenExpansionTargetCoverageResolver = (target: {
  model: NineSixteenExpansionModel;
  quality: EligibleImageQuality;
}) => Promise<NineSixteenExpansionCoverageStatus>;

/** Estado de leitura exposto pela view (nunca colapsa falha em ausência). */
export type NineSixteenExpansionViewState =
  | "configured"
  | "absent"
  | "invalid"
  | "read_failed";

export interface NineSixteenExpansionConfigView {
  /** Lista FECHADA de modelos da expansão (Flare/Sunburst). */
  readonly eligibleModels: readonly NineSixteenExpansionModel[];
  /** Lista FECHADA de qualidades (`low`/`medium`). */
  readonly eligibleQualities: readonly EligibleImageQuality[];
  /** Estado discriminado da leitura estrita. */
  readonly state: NineSixteenExpansionViewState;
  /** `true` somente quando existe linha vigente válida. */
  readonly configured: boolean;
  /** Seleção vigente (com versão/origem) ou `null`. */
  readonly current: ExpansionSelection | null;
  readonly configVersionId: string | null;
  readonly updatedBy: string | null;
  readonly updatedAt: string | null;
  readonly reason: string | null;
  /**
   * Cobertura por combinação, chaveada por `${model}|${quality}`. Cobertura
   * desconhecida (resolver lançou) é OMITIDA — nunca vira `complete`.
   */
  readonly targetCoverageByCombination: Record<
    string,
    NineSixteenExpansionCoverageStatus
  >;
  /** Mensagem segura de falha de leitura (`null` nos demais estados). */
  readonly readError: string | null;
}

/** Contrato mínimo de leitura aceito pela view (facilita fake em testes). */
export interface NineSixteenExpansionConfigServiceLike {
  readNineSixteenExpansionConfig(): Promise<NineSixteenExpansionConfigReadResult>;
}

function errorDetail(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function emptyView(
  state: Exclude<NineSixteenExpansionViewState, "configured">,
  readError: string | null = null,
): NineSixteenExpansionConfigView {
  return {
    eligibleModels: NINE_SIXTEEN_EXPANSION_MODELS,
    eligibleQualities: ELIGIBLE_IMAGE_QUALITIES,
    state,
    configured: false,
    current: null,
    configVersionId: null,
    updatedBy: null,
    updatedAt: null,
    reason: null,
    targetCoverageByCombination: {},
    readError,
  };
}

function coverageStatus(
  model: NineSixteenExpansionModel,
  quality: EligibleImageQuality,
  coverage: ReturnType<typeof evaluatePricingCoverage>,
): NineSixteenExpansionCoverageStatus {
  const pricingCoverage: NineSixteenExpansionCoverageStatus["pricingCoverage"] =
    coverage.complete
      ? "complete"
      : coverage.reason === "incomplete_coverage"
        ? "partial"
        : "missing";

  return {
    model,
    quality,
    pricingCoverage,
    missingComponents: coverage.missing,
  };
}

/**
 * Resolvedor PADRÃO: lê as tarifas de usage da combinação via
 * `AiModelPricingService` e classifica com `evaluatePricingCoverage`.
 *
 * Recebe o serviço já instanciado para garantir **uma** instância por build da
 * view (quatro leituras, nenhum serviço novo por combinação). Exportado para
 * permitir que os testes exercitem a classificação real com um leitor de
 * pricing falso (nenhum banco/rede).
 */
export function createUsagePricingCoverageResolver(
  pricing: Pick<AiModelPricingService, "getModelPricing">,
  options: PricingCoverageOptions = {},
): NineSixteenExpansionTargetCoverageResolver {
  return async ({ model, quality }) => {
    const read = await pricing.getModelPricing({ provider: "openai", model, quality });
    const coverage = evaluatePricingCoverage(
      read?.pricing ?? null,
      read?.versionId ?? null,
      options,
    );
    return coverageStatus(model, quality, coverage);
  };
}

/**
 * Cobertura das quatro combinações da expansão. Tolerante por design: uma
 * combinação cuja leitura falhe é **omitida** do mapa (o cliente trata
 * cobertura desconhecida sem inferir `complete`).
 */
async function buildTargetCoverageByCombination(
  resolver: NineSixteenExpansionTargetCoverageResolver,
): Promise<Record<string, NineSixteenExpansionCoverageStatus>> {
  const entries = await Promise.all(
    NINE_SIXTEEN_EXPANSION_MODELS.flatMap((model) =>
      ELIGIBLE_IMAGE_QUALITIES.map(
        async (quality): Promise<[string, NineSixteenExpansionCoverageStatus] | null> => {
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
    entries.filter(
      (entry): entry is [string, NineSixteenExpansionCoverageStatus] => entry !== null,
    ),
  );
}

/**
 * Monta o view model administrativo. Nunca lança.
 *
 * Dependências injetáveis: o serviço de leitura estrita e o resolvedor de
 * cobertura. Quando a cobertura não é injetada, instancia **um**
 * `AiModelPricingService` por chamada (default = `supabaseAdmin`) e usa as
 * tarifas de usage.
 */
export async function buildNineSixteenExpansionConfigView(
  dependencies: {
    service?: NineSixteenExpansionConfigServiceLike;
    coverage?: NineSixteenExpansionTargetCoverageResolver;
  } = {},
): Promise<NineSixteenExpansionConfigView> {
  const service = dependencies.service ?? nineSixteenExpansionConfigService;

  let result: NineSixteenExpansionConfigReadResult;
  try {
    result = await service.readNineSixteenExpansionConfig();
  } catch (error) {
    // Exceção do serviço é falha de leitura — NUNCA ausência.
    return emptyView("read_failed", errorDetail(error));
  }

  if (result.kind === "absent") return emptyView("absent");
  if (result.kind === "invalid") return emptyView("invalid");
  if (result.kind === "read_failed") return emptyView("read_failed", result.reason);

  const coverageResolver =
    dependencies.coverage ?? createUsagePricingCoverageResolver(new AiModelPricingService());

  const targetCoverageByCombination =
    await buildTargetCoverageByCombination(coverageResolver);

  return {
    eligibleModels: NINE_SIXTEEN_EXPANSION_MODELS,
    eligibleQualities: ELIGIBLE_IMAGE_QUALITIES,
    state: "configured",
    configured: true,
    current: result.selection,
    configVersionId: result.selection.configVersionId,
    updatedBy: result.metadata.updatedBy,
    updatedAt: result.metadata.updatedAt,
    reason: result.metadata.reason,
    targetCoverageByCombination,
    readError: null,
  };
}
