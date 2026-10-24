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
  resolveVisualSignatureModelConfigDiagnostic,
  type VisualSignatureModelConfigDiagnostic,
  type VisualSignatureModelConfigRow,
} from "./visual-signature-model-config-service";
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
 * Diagnóstico derivado do MESMO resolvedor do runtime.
 *
 * - `dedicated_valid`: guard + identidade + tuple válidos.
 * - `inherited_opt_in_disabled`: opt-in desligado.
 * - `inherited_absent`: guard válido e ausência confirmada.
 * - `blocked`: guard, leitura, identidade ou tuple falharam.
 */
export interface VisualSignatureConfigDiagnosticView {
  status:
    | "dedicated_valid"
    | "inherited_opt_in_disabled"
    | "inherited_absent"
    | "inherited_not_published"
    | "inherited_not_activated"
    | "inherited_outside_pilot"
    | "blocked";
  reason:
    | "opt_in_disabled"
    | "absent"
    | "not_published"
    | "not_activated"
    | "outside_pilot"
    | "guard"
    | "identity"
    | "tuple"
    | "read_failure"
    | "release_read_failure"
    | null;
  code: string | null;
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
  release?: {
    environment: string;
    published: boolean;
    activated: boolean;
    activationMode: "none" | "pilot" | "general";
    pilotEligible: boolean;
  } | null;
  inherited: VisualSignatureInheritedView;
  diagnostic: VisualSignatureConfigDiagnosticView;
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
export type VisualSignatureDiagnosticResolver = () => Promise<VisualSignatureModelConfigDiagnostic>;

export interface BuildVisualSignatureModelConfigViewDependencies {
  configReader?: VisualSignatureConfigRowReader;
  selectionViewBuilder?: VisualSignatureSelectionViewBuilder;
  pricingResolver?: VisualSignaturePresetPricingResolver;
  diagnosticResolver?: VisualSignatureDiagnosticResolver;
}

function toDiagnosticView(
  diagnostic: VisualSignatureModelConfigDiagnostic,
): VisualSignatureConfigDiagnosticView {
  if (diagnostic.status === "dedicated") {
    return { status: "dedicated_valid", reason: null, code: null };
  }
  if (diagnostic.status === "inherited") {
    if (diagnostic.reason === "absent") {
      return { status: "inherited_absent", reason: "absent", code: null };
    }
    if (diagnostic.reason === "not_published") {
      return { status: "inherited_not_published", reason: "not_published", code: null };
    }
    if (diagnostic.reason === "not_activated") {
      return { status: "inherited_not_activated", reason: "not_activated", code: null };
    }
    if (diagnostic.reason === "outside_pilot") {
      return { status: "inherited_outside_pilot", reason: "outside_pilot", code: null };
    }
    return {
      status: "inherited_opt_in_disabled",
      reason: "opt_in_disabled",
      code: null,
    };
  }
  return {
    status: "blocked",
    reason: diagnostic.reason,
    code: diagnostic.code,
  };
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
  const diagnosticResolver =
    dependencies.diagnosticResolver ?? (() => resolveVisualSignatureModelConfigDiagnostic());

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

  let diagnostic: VisualSignatureConfigDiagnosticView;
  let release: VisualSignatureModelConfigView["release"] = null;
  try {
    const resolved = await diagnosticResolver();
    diagnostic = toDiagnosticView(resolved);
    if (resolved.status === "dedicated") {
      const snapshot = resolved.snapshot;
      release = {
        environment: snapshot.environment ?? "local_validation",
        published:
          snapshot.publishedConfigVersionId === snapshot.configVersionId,
        activated:
          snapshot.activatedConfigVersionId === snapshot.configVersionId &&
          snapshot.activationMode !== "none",
        activationMode: snapshot.activationMode ?? "none",
        pilotEligible: snapshot.pilotEligible ?? false,
      };
    }
  } catch {
    diagnostic = { status: "blocked", reason: "read_failure", code: null };
  }

  return {
    orchestrators: VISUAL_SIGNATURE_ORCHESTRATORS,
    presets,
    combinations,
    configured: current !== null,
    current,
    release,
    inherited,
    diagnostic,
    pricingByPreset,
    readError,
  };
}

export { PRESET_LABELS };
