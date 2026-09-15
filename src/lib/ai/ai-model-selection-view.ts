import "server-only";
import {
  ALL_CAPABILITIES,
  CAPABILITY_SEGMENTS,
  MODEL_REGISTRY,
} from "./model-registry";
import {
  aiModelCatalogService,
  catalogTupleKey,
  type AiModelCatalogRow,
} from "./ai-model-catalog-service";
import {
  aiModelSelectionService,
  type AiModelSelectionRow,
} from "./ai-model-selection-service";
import { ModelRegistry } from "./model-registry";
import { PersistedModelResolver } from "./persisted-model-resolver";
import type { AiModelTarget, AiProvider, AiProtocol } from "./model-resolver";
import { getModelCapabilityPricing, type CapacityPricingStatus } from "@/lib/ai-cost/model-capability-pricing";

export type AiModelCatalogStatus = "active" | "deprecated" | "missing";

export interface AiModelTargetView extends AiModelTarget {
  catalogStatus: AiModelCatalogStatus;
}

export interface AiModelCapabilityView {
  capability: string;
  segment: string;
  source: "selection" | "default";
  current: { primary: AiModelTargetView; fallback: AiModelTargetView | null };
  default: { primary: AiModelTargetView; fallback: AiModelTargetView | null };
  configured: { primary: AiModelTargetView | null; fallback: AiModelTargetView | null } | null;
  selection: AiModelSelectionRow | null;
  pricing?: CapacityPricingStatus;
}

export interface AiModelSelectionViewModel {
  catalog: AiModelCatalogRow[];
  selections: AiModelSelectionRow[];
  defaults: typeof MODEL_REGISTRY;
  capabilities: AiModelCapabilityView[];
}

function statusFor(
  capability: string,
  target: AiModelTarget,
  catalog: Map<string, AiModelCatalogRow>,
): AiModelCatalogStatus {
  const row = catalog.get(catalogTupleKey(capability, target.provider, target.model, target.protocol));
  if (!row || row.segment !== CAPABILITY_SEGMENTS[capability as keyof typeof CAPABILITY_SEGMENTS]) return "missing";
  return row.status === "deprecated" ? "deprecated" : "active";
}

function targetView(capability: string, target: AiModelTarget, catalog: Map<string, AiModelCatalogRow>): AiModelTargetView {
  return { ...target, catalogStatus: statusFor(capability, target, catalog) };
}

export async function buildAiModelSelectionView(dependencies: {
  catalogService?: Pick<typeof aiModelCatalogService, "getActiveCatalogRows" | "getCatalogMap">;
  selectionService?: Pick<typeof aiModelSelectionService, "getSelectionMap">;
} = {}): Promise<AiModelSelectionViewModel> {
  const catalogService = dependencies.catalogService ?? aiModelCatalogService;
  const selectionService = dependencies.selectionService ?? aiModelSelectionService;
  const [catalogRows, catalogMap, selectionMap] = await Promise.all([
    catalogService.getActiveCatalogRows(),
    catalogService.getCatalogMap(),
    selectionService.getSelectionMap(),
  ]);
  const selections = [...selectionMap.values()];
  const resolver = new PersistedModelResolver({
    registry: new ModelRegistry(),
    selectionService: { getSelectionMap: async () => selectionMap },
    catalogService: { getCatalogMap: async () => catalogMap },
  });

  const capabilities = await Promise.all(ALL_CAPABILITIES.map(async (capability) => {
    const defaultConfig = MODEL_REGISTRY[capability];
    const selection = selectionMap.get(capability) ?? null;
    const effective = await resolver.resolveWithSource(capability);
    const configuredPrimary = selection && selection.provider && selection.model && selection.protocol
      ? { provider: selection.provider as AiProvider, model: selection.model, protocol: selection.protocol as AiProtocol }
      : null;
    const configuredFallback = selection && selection.fallback_provider && selection.fallback_model && selection.fallback_protocol
      ? { provider: selection.fallback_provider as AiProvider, model: selection.fallback_model, protocol: selection.fallback_protocol as AiProtocol }
      : null;

    return {
      capability,
      segment: CAPABILITY_SEGMENTS[capability],
      source: effective.source,
      current: {
        primary: targetView(capability, effective.config.primary, catalogMap),
        fallback: effective.config.fallback ? targetView(capability, effective.config.fallback, catalogMap) : null,
      },
      default: {
        primary: targetView(capability, defaultConfig.primary, catalogMap),
        fallback: defaultConfig.fallback ? targetView(capability, defaultConfig.fallback, catalogMap) : null,
      },
      configured: selection ? {
        primary: configuredPrimary ? targetView(capability, configuredPrimary, catalogMap) : null,
        fallback: configuredFallback ? targetView(capability, configuredFallback, catalogMap) : null,
      } : null,
      selection,
    } satisfies AiModelCapabilityView;
  }));

  const pricingByCapability = new Map(
    (await getModelCapabilityPricing(capabilities.map((item) => ({ capability: item.capability, target: item.current.primary })))).map((status) => [status.capability, status]),
  );

  return {
    catalog: catalogRows,
    selections,
    defaults: MODEL_REGISTRY,
    capabilities: capabilities.map((item) => ({ ...item, pricing: pricingByCapability.get(item.capability) })),
  };
}
