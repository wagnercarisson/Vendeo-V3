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
import type { AiModelTarget } from "./model-resolver";

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
  selection: AiModelSelectionRow | null;
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

  const capabilities = ALL_CAPABILITIES.map((capability) => {
    const defaultConfig = MODEL_REGISTRY[capability];
    const selection = selectionMap.get(capability) ?? null;
    const selectedPrimary = selection && selection.provider && selection.model && selection.protocol
      ? { provider: selection.provider, model: selection.model, protocol: selection.protocol }
      : null;
    const selectedFallback = selection?.fallback_provider && selection.fallback_model && selection.fallback_protocol
      ? { provider: selection.fallback_provider, model: selection.fallback_model, protocol: selection.fallback_protocol }
      : null;

    return {
      capability,
      segment: CAPABILITY_SEGMENTS[capability],
      source: selectedPrimary ? "selection" : "default",
      current: {
        primary: targetView(capability, selectedPrimary ?? defaultConfig.primary, catalogMap),
        fallback: selectedFallback ? targetView(capability, selectedFallback, catalogMap) : null,
      },
      default: {
        primary: targetView(capability, defaultConfig.primary, catalogMap),
        fallback: defaultConfig.fallback ? targetView(capability, defaultConfig.fallback, catalogMap) : null,
      },
      selection,
    } satisfies AiModelCapabilityView;
  });

  return { catalog: catalogRows, selections, defaults: MODEL_REGISTRY, capabilities };
}
