import "server-only";
import {
  ALL_CAPABILITIES,
  CAPABILITY_PROTOCOLS,
  CAPABILITY_SEGMENTS,
  ModelRegistry,
} from "./model-registry";
import type { AiModelCatalogMap } from "./ai-model-catalog-service";
import { aiModelCatalogService, catalogTupleKey } from "./ai-model-catalog-service";
import type { AiModelSelectionMap, AiModelSelectionRow } from "./ai-model-selection-service";
import { aiModelSelectionService } from "./ai-model-selection-service";
import type {
  AiCapability,
  AiModelConfig,
  AiModelResolver,
  AiModelTarget,
  AiProtocol,
  AiProvider,
} from "./model-resolver";

export interface PersistedModelResolverDependencies {
  registry?: AiModelResolver;
  selectionService?: { getSelectionMap(): Promise<AiModelSelectionMap> };
  catalogService?: { getCatalogMap(): Promise<AiModelCatalogMap> };
}

function isSupportedProviderProtocol(provider: string, protocol: string): boolean {
  if (provider === "gemini") return protocol === "gemini";
  return provider === "openai" && ["chat-completions", "responses", "images"].includes(protocol);
}

function isCompleteTarget(target: Partial<AiModelTarget> | null | undefined): target is AiModelTarget {
  return Boolean(
    target &&
      typeof target.provider === "string" &&
      typeof target.model === "string" &&
      target.model.length > 0 &&
      typeof target.protocol === "string",
  );
}

function catalogContains(
  catalog: AiModelCatalogMap,
  capability: AiCapability,
  target: AiModelTarget,
): boolean {
  const row = catalog.get(catalogTupleKey(capability, target.provider, target.model, target.protocol));
  return row?.status === "active" || row?.status === "deprecated";
}

function isTargetCompatible(capability: AiCapability, target: AiModelTarget): boolean {
  return (
    isSupportedProviderProtocol(target.provider, target.protocol) &&
    CAPABILITY_PROTOCOLS[capability]?.includes(target.protocol as AiProtocol)
  );
}

function buildConfig(
  capability: AiCapability,
  selection: AiModelSelectionRow,
  catalog: AiModelCatalogMap,
): AiModelConfig | null {
  if (selection.capability !== capability || selection.provider == null || selection.model == null || selection.protocol == null) return null;
  if (selection.capability !== capability || CAPABILITY_SEGMENTS[capability] == null) return null;

  const primary: AiModelTarget = {
    provider: selection.provider as AiProvider,
    model: selection.model,
    protocol: selection.protocol as AiProtocol,
  };
  if (!isCompleteTarget(primary) || !isTargetCompatible(capability, primary) || !catalogContains(catalog, capability, primary)) return null;

  const fallbackValues = [selection.fallback_provider, selection.fallback_model, selection.fallback_protocol];
  const fallbackPresent = fallbackValues.some((value) => value !== null && value !== undefined);
  if (!fallbackPresent) {
    return { capability, segment: CAPABILITY_SEGMENTS[capability], primary };
  }
  if (capability !== "campaign_copy" || fallbackValues.some((value) => typeof value !== "string" || value.length === 0)) return null;

  const fallback: AiModelTarget = {
    provider: selection.fallback_provider as AiProvider,
    model: selection.fallback_model as string,
    protocol: selection.fallback_protocol as AiProtocol,
  };
  if (
    !isCompleteTarget(fallback) ||
    !isTargetCompatible(capability, fallback) ||
    !catalogContains(catalog, capability, fallback) ||
    (primary.provider === fallback.provider && primary.model === fallback.model)
  ) return null;

  return { capability, segment: CAPABILITY_SEGMENTS[capability], primary, fallback };
}

/** Decorates the F46 registry with a validated, fail-open persisted selection. */
export class PersistedModelResolver implements AiModelResolver {
  private readonly registry: AiModelResolver;
  private readonly selectionService: { getSelectionMap(): Promise<AiModelSelectionMap> };
  private readonly catalogService: { getCatalogMap(): Promise<AiModelCatalogMap> };

  constructor(dependencies: PersistedModelResolverDependencies = {}) {
    this.registry = dependencies.registry ?? new ModelRegistry();
    this.selectionService = dependencies.selectionService ?? aiModelSelectionService;
    this.catalogService = dependencies.catalogService ?? aiModelCatalogService;
  }

  async resolve(capability: AiCapability): Promise<AiModelConfig> {
    const fallback = await this.registry.resolve(capability);
    if (!ALL_CAPABILITIES.includes(capability)) return fallback;

    try {
      const [selections, catalog] = await Promise.all([
        this.selectionService.getSelectionMap(),
        this.catalogService.getCatalogMap(),
      ]);
      const selection = selections.get(capability);
      if (!selection) return fallback;
      return buildConfig(capability, selection, catalog) ?? fallback;
    } catch {
      return fallback;
    }
  }

  listCapabilities(): AiCapability[] {
    return this.registry.listCapabilities();
  }
}
