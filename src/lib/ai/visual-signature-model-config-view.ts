import "server-only";

import { buildAiModelSelectionView, type AiModelSelectionViewModel } from "./ai-model-selection-view";
import { MODEL_REGISTRY, LEGACY_SELECTION_CAPABILITIES } from "./model-registry";
import {
  VISUAL_SIGNATURE_IMAGE_PRESETS,
  VISUAL_SIGNATURE_ORCHESTRATORS,
  type VisualSignatureImagePreset,
  type VisualSignatureOrchestrator,
} from "./visual-signature-model-config";
import {
  readVisualSignatureModelConfigRowForAdmin,
  type VisualSignatureModelConfigRow,
} from "./visual-signature-model-config-service";
import {
  assertVisualSignatureValidationEnvironment,
  isVisualSignatureValidationOptedIn,
} from "@/lib/visual-signature/local-validation/guard";
import {
  getVisualSignaturePresetPricing,
  type VisualSignatureImagePricingResult,
} from "@/lib/ai-cost/visual-signature-pricing";

/**
 * F47.1 (D10) — view model da configuração administrativa da Assinatura Visual.
 *
 * Somente leitura: a tela não grava nada no mount. A seleção herdada de
 * `visual_signature_image` é sempre diagnosticável e NÃO é um segundo editor.
 * Nenhum erro bruto/chave/SQL é exposto.
 */

export interface VisualSignaturePresetView {
  preset: VisualSignatureImagePreset;
  label: string;
  model: string;
  quality: "low" | "medium";
}

export interface VisualSignatureConfigViewRow {
  orchestratorModel: VisualSignatureOrchestrator;
  imagePreset: VisualSignatureImagePreset;
  imageModel: string;
  imageQuality: "low" | "medium";
  reasoningEffort: "low";
  configVersionId: string;
  updatedBy: string | null;
  updatedAt: string | null;
  reason: string | null;
  instanceIdentity: string;
}

export interface VisualSignatureInheritedView {
  provider: string;
  model: string;
  protocol: string;
  origin: "default" | "selection" | "human_decision";
  catalogStatus: "active" | "deprecated" | "missing";
  eligible: boolean;
}

/**
 * Registrada ≠ efetivamente habilitada. O GET é diagnóstico e não usa a linha
 * para afirmar consumo; `effective` exige opt-in + guard local válidos.
 */
export interface VisualSignatureConsumptionView {
  optedIn: boolean;
  effective: boolean;
  reason: "not_configured" | "opt_in_disabled" | "environment_invalid" | "enabled";
}

export interface VisualSignaturePresetPricingView {
  status: "complete" | "partial" | "missing";
  missingRates: string[];
  historicalReferenceUsd: number | null;
  pricingVersion: string | null;
}

export interface VisualSignatureModelConfigView {
  orchestrators: readonly VisualSignatureOrchestrator[];
  presets: readonly VisualSignaturePresetView[];
  /** 2 orquestradores × 4 presets = 8 combinações. */
  combinations: readonly {
    orchestratorModel: VisualSignatureOrchestrator;
    imagePreset: VisualSignatureImagePreset;
    model: string;
    quality: "low" | "medium";
  }[];
  configured: boolean;
  current: VisualSignatureConfigViewRow | null;
  inherited: VisualSignatureInheritedView;
  consumption: VisualSignatureConsumptionView;
  pricingByPreset: Record<VisualSignatureImagePreset, VisualSignaturePresetPricingView>;
  /** Falha de leitura da configuração dedicada (mensagem segura). */
  readError: string | null;
}

const PRESET_LABELS: Record<VisualSignatureImagePreset, string> = {
  flare_low: "Flare · Low",
  flare_medium: "Flare · Medium",
  sunburst_low: "Sunburst · Low",
  sunburst_medium: "Sunburst · Medium",
};

export type VisualSignatureConfigRowReader = () => Promise<VisualSignatureModelConfigRow | null>;
export type VisualSignatureSelectionViewBuilder = () => Promise<AiModelSelectionViewModel>;
export type VisualSignaturePresetPricingResolver = (
  preset: VisualSignatureImagePreset,
) => Promise<VisualSignatureImagePricingResult>;
export type VisualSignatureConsumptionResolver = (
  configured: boolean,
) => VisualSignatureConsumptionView;

export interface BuildVisualSignatureModelConfigViewDependencies {
  configReader?: VisualSignatureConfigRowReader;
  selectionViewBuilder?: VisualSignatureSelectionViewBuilder;
  pricingResolver?: VisualSignaturePresetPricingResolver;
  consumptionResolver?: VisualSignatureConsumptionResolver;
}

/**
 * Default: opt-in é necessário, mas não suficiente. Com opt-in ligado, o guard
 * local completo é consultado em modo diagnóstico (sem escrita/generation).
 */
export function resolveVisualSignatureConsumption(
  configured: boolean,
): VisualSignatureConsumptionView {
  const optedIn = isVisualSignatureValidationOptedIn();
  if (!configured) {
    return { optedIn, effective: false, reason: "not_configured" };
  }
  if (!optedIn) {
    return { optedIn, effective: false, reason: "opt_in_disabled" };
  }
  try {
    assertVisualSignatureValidationEnvironment();
    return { optedIn: true, effective: true, reason: "enabled" };
  } catch {
    return { optedIn: true, effective: false, reason: "environment_invalid" };
  }
}

function defaultInherited(): VisualSignatureInheritedView {
  const target = MODEL_REGISTRY.visual_signature_image.primary;
  return {
    provider: target.provider,
    model: target.model,
    protocol: target.protocol,
    origin: "default",
    catalogStatus: "missing",
    eligible: false,
  };
}

function readInherited(view: AiModelSelectionViewModel): VisualSignatureInheritedView {
  const capability = LEGACY_SELECTION_CAPABILITIES.find(
    (item) => item === "visual_signature_image",
  );
  const item = view.capabilities.find((candidate) => candidate.capability === capability);
  if (!item) return defaultInherited();

  const target = item.current.primary;
  const origin: VisualSignatureInheritedView["origin"] = item.configured?.primary
    ? "human_decision"
    : item.source === "selection"
      ? "selection"
      : "default";

  return {
    provider: target.provider,
    model: target.model,
    protocol: target.protocol,
    origin,
    catalogStatus: target.catalogStatus,
    eligible: target.catalogStatus === "active",
  };
}

function readCurrent(row: VisualSignatureModelConfigRow): VisualSignatureConfigViewRow {
  return {
    orchestratorModel: row.orchestrator_model as VisualSignatureOrchestrator,
    imagePreset: row.image_preset as VisualSignatureImagePreset,
    imageModel: row.image_model,
    imageQuality: row.image_quality as "low" | "medium",
    reasoningEffort: "low",
    configVersionId: row.config_version_id,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at ?? null,
    reason: row.reason ?? null,
    instanceIdentity: row.instance_identity,
  };
}

function emptyPricing(): VisualSignaturePresetPricingView {
  return {
    status: "missing",
    missingRates: ["image.imageTokenUsdPer1M"],
    historicalReferenceUsd: null,
    pricingVersion: null,
  };
}

async function buildPricing(
  resolver: VisualSignaturePresetPricingResolver,
): Promise<Record<VisualSignatureImagePreset, VisualSignaturePresetPricingView>> {
  const entries = await Promise.all(
    (Object.keys(VISUAL_SIGNATURE_IMAGE_PRESETS) as VisualSignatureImagePreset[]).map(
      async (preset) => {
        try {
          const result = await resolver(preset);
          return [
            preset,
            {
              status: result.status,
              missingRates: result.missingRates,
              historicalReferenceUsd: result.historicalReferenceUsd,
              pricingVersion: result.pricingVersion,
            } satisfies VisualSignaturePresetPricingView,
          ] as const;
        } catch {
          return [preset, emptyPricing()] as const;
        }
      },
    ),
  );
  return Object.fromEntries(entries) as Record<
    VisualSignatureImagePreset,
    VisualSignaturePresetPricingView
  >;
}

/**
 * Monta o view model. Não lança por falha de leitura/pricing: devolve estado
 * vazio/parcial seguro para a tela renderizar.
 */
export async function buildVisualSignatureModelConfigView(
  dependencies: BuildVisualSignatureModelConfigViewDependencies = {},
): Promise<VisualSignatureModelConfigView> {
  const configReader =
    dependencies.configReader ?? readVisualSignatureModelConfigRowForAdmin;
  const selectionViewBuilder =
    dependencies.selectionViewBuilder ?? (() => buildAiModelSelectionView());
  const pricingResolver =
    dependencies.pricingResolver ??
    ((preset) => getVisualSignaturePresetPricing({ preset }));
  const consumptionResolver =
    dependencies.consumptionResolver ?? resolveVisualSignatureConsumption;

  const presets: VisualSignaturePresetView[] = (
    Object.keys(VISUAL_SIGNATURE_IMAGE_PRESETS) as VisualSignatureImagePreset[]
  ).map((preset) => {
    const mapping = VISUAL_SIGNATURE_IMAGE_PRESETS[preset];
    return {
      preset,
      label: PRESET_LABELS[preset],
      model: mapping.model,
      quality: mapping.quality,
    };
  });

  const combinations = VISUAL_SIGNATURE_ORCHESTRATORS.flatMap((orchestratorModel) =>
    presets.map((preset) => ({
      orchestratorModel,
      imagePreset: preset.preset,
      model: preset.model,
      quality: preset.quality,
    })),
  );

  let current: VisualSignatureConfigViewRow | null = null;
  let readError: string | null = null;
  try {
    const row = await configReader();
    current = row ? readCurrent(row) : null;
  } catch {
    readError = "Não foi possível ler a configuração da Assinatura Visual.";
  }

  let inherited = defaultInherited();
  try {
    inherited = readInherited(await selectionViewBuilder());
  } catch {
    inherited = defaultInherited();
  }

  const pricingByPreset = await buildPricing(pricingResolver);
  const consumption = consumptionResolver(current !== null);

  return {
    orchestrators: VISUAL_SIGNATURE_ORCHESTRATORS,
    presets,
    combinations,
    configured: current !== null,
    current,
    inherited,
    consumption,
    pricingByPreset,
    readError,
  };
}

export { PRESET_LABELS };
