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

/** Código determinístico da barreira fail-closed do novo fluxo (F56.1, D-06/D-08). */
export const NEW_FLOW_IMAGE_MODEL_PAIR_CONFIG_REQUIRED =
  "new_flow_image_model_pair_config_required" as const;

/**
 * Lançado quando a capacidade própria do novo fluxo (`campaign_product_image`) é
 * resolvida por um caminho **genérico** — isto é, sem a configuração explícita
 * do novo fluxo. O default do `MODEL_REGISTRY` existe apenas para satisfazer
 * `validateRegistry`/tipos e NUNCA é servido (fail-closed, D-06/D-08). A
 * resolução legítima usa o resolver dedicado do novo fluxo (plano 09), que lê
 * `image_model_pair_config`.
 */
export class AiNewFlowConfigRequiredError extends Error {
  readonly code = NEW_FLOW_IMAGE_MODEL_PAIR_CONFIG_REQUIRED;
  readonly capability: AiCapability;

  constructor(capability: AiCapability = "campaign_product_image") {
    super(`${NEW_FLOW_IMAGE_MODEL_PAIR_CONFIG_REQUIRED}:${capability}`);
    this.name = "AiNewFlowConfigRequiredError";
    this.capability = capability;
  }
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
  return (
    row?.segment === CAPABILITY_SEGMENTS[capability] &&
    (row.status === "active" || row.status === "deprecated")
  );
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
  const fallbackDisabled = fallbackValues.every((value) => value === null);
  if (fallbackDisabled) {
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
    return (await this.resolveWithSource(capability)).config;
  }

  async resolveWithSource(capability: AiCapability): Promise<{ config: AiModelConfig; source: "selection" | "default" }> {
    // Barreira fail-closed (F56.1, D-06/D-08): a capacidade própria do novo fluxo
    // NÃO é servida pelo fallback fail-open ao registry. Sem configuração
    // explícita do novo fluxo, a resolução falha de forma determinística e nunca
    // retorna o default `gpt-image-2`.
    if (capability === "campaign_product_image") {
      throw new AiNewFlowConfigRequiredError(capability);
    }

    const fallback = await this.registry.resolve(capability);
    if (!ALL_CAPABILITIES.includes(capability)) return { config: fallback, source: "default" };

    try {
      const [selections, catalog] = await Promise.all([
        this.selectionService.getSelectionMap(),
        this.catalogService.getCatalogMap(),
      ]);
      const selection = selections.get(capability);
      if (!selection) return { config: fallback, source: "default" };
      const config = buildConfig(capability, selection, catalog);
      return config ? { config, source: "selection" } : { config: fallback, source: "default" };
    } catch {
      return { config: fallback, source: "default" };
    }
  }

  listCapabilities(): AiCapability[] {
    return this.registry.listCapabilities();
  }
}
