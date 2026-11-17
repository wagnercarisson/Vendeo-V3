import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { readSquareBaseFrozenState } from "@/lib/campaign/square-base/frozen-state";
import { runSquareBase, type SquareBaseDeps } from "@/lib/campaign/square-base/run-square-base";
import { downloadCampaignInputFileWithClient } from "@/lib/campaign/persistence";
import { prepareSquareForExpansion } from "@/lib/campaign/square-preparation/prepare";
import { expandVerticalToNineSixteen } from "@/lib/campaign/vertical-expansion/expand";
import { preflightExpansionToNineSixteen } from "@/lib/campaign/vertical-expansion/model";
import { readNineSixteenExpansionConfig } from "@/lib/ai/nine-sixteen-expansion-model-config-service";
import {
  LEGACY_SUNBURST_LOW,
  type ExpansionSelection,
} from "@/lib/ai/nine-sixteen-expansion-model-config";
import { createDefaultThumbnailContext } from "@/lib/campaign/thumbnail/thumbnail-generator";
import type {
  ThumbnailContext,
  ThumbnailUploader,
} from "@/lib/campaign/thumbnail/thumbnail-generator";
import { THUMBNAIL_BUCKET } from "@/lib/campaign/thumbnail/thumbnail-path";
import { generateCampaignThumbnailSafely } from "@/lib/campaign/thumbnail/thumbnail-safe";
import { generateSupportReference } from "@/lib/ai/image-generation-support-reference";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import {
  projectDeliveredCampaign,
  type ProjectDeliveredCampaignResult,
} from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import { projectClosedCampaign } from "@/lib/product-1-1/orchestration/project-closed-campaign";
import { ProductTwoStageOperationClient } from "../two-stage-operation-client";
import { TwoStageFinancialService } from "../two-stage-financial-service";
import type { RunNineSixteenDeps, FrozenExpansionSelectionLookup } from "./types";
import { CompositionVerticalProbe } from "./vertical-probe";
import type { TwoStageOperationView } from "../types";

export interface NineSixteenDepsOptions {
  readonly client?: SupabaseClient;
  readonly clock?: () => number;
  readonly callIdFactory?: () => string;
  readonly probeVertical?: RunNineSixteenDeps["probeVertical"];
  readonly generateThumbnail?: RunNineSixteenDeps["generateThumbnail"];
  readonly projectDelivered?: RunNineSixteenDeps["projectDelivered"];
  readonly pilotSpend?: unknown;
  readonly copyOps?: SquareBaseDeps["copyOps"];
  readonly copyInvoker?: SquareBaseDeps["copyInvoker"];
  readonly copyDirectorEnabled?: boolean;
}

async function projectCompositionDelivery(
  client: SupabaseClient,
  input: { storeId: string; campaignId: string; operationId: string },
): Promise<ProjectDeliveredCampaignResult> {
  const row = await getArtifactByIdentity(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      role: "vertical",
    },
    client,
  );
  if (row.kind !== "found") {
    return { projected: false, reason: "artifact_missing" };
  }
  return projectDeliveredCampaign(
    {
      ...input,
      source: {
        kind: "composition",
        role: "vertical",
        expectedPath: row.record.storagePath,
      },
    },
    { client },
  );
}

/**
 * Contexto da miniatura SEMPRE vinculado ao cliente autorizado. Com o cliente
 * global, preserva o uploader com timeout; com um cliente injetado, o upload
 * passa pelo MESMO cliente (nunca pelo ambiente global).
 */
function thumbnailContextFor(client: SupabaseClient): ThumbnailContext | null {
  if (client === supabaseAdmin) return createDefaultThumbnailContext();

  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let endpoint: string;
  try {
    endpoint = new URL(raw).origin;
  } catch {
    return null;
  }

  const uploader: ThumbnailUploader = {
    endpoint,
    async upload({ path, buffer, contentType }) {
      const { error } = await client.storage
        .from(THUMBNAIL_BUCKET)
        .upload(path, buffer, { contentType, upsert: false });
      return { error: error ?? null };
    },
  };
  return { endpoint, uploader };
}

/**
 * Derivação PURA da seleção congelada a partir da `view` JÁ lida da operação.
 *
 * Única implementação do repositório (o orquestrador importa daqui; nenhuma
 * segunda cópia, nenhuma dependência com I/O e nenhuma leitura adicional da
 * operação). Regras fechadas:
 * - `contractVersion = 1` → `LEGACY_SUNBURST_LOW` explícito (comportamento
 *   original Sunburst `low`, sem backfill e sem versão inventada);
 * - `contractVersion = 2` com seleção persistida → a seleção congelada;
 * - `contractVersion = 2` sem seleção completa → `invalid` (falha fechada,
 *   jamais promovido a legado).
 */
export function deriveFrozenExpansionSelection(
  view: Pick<TwoStageOperationView, "contractVersion" | "frozenSelection">,
): FrozenExpansionSelectionLookup {
  if (view.contractVersion === 1) {
    return { kind: "found", selection: LEGACY_SUNBURST_LOW };
  }
  if (view.frozenSelection === null) {
    return { kind: "invalid", reason: "frozen_selection_missing" };
  }
  return { kind: "found", selection: view.frozenSelection };
}

/**
 * Composição ÚNICA das dependências reais do orquestrador. Nenhuma rota
 * two-stage deve montar `RunNineSixteenDeps` à mão nem usar o store vertical
 * direto.
 */
export function createNineSixteenDeps(
  options: NineSixteenDepsOptions = {},
): RunNineSixteenDeps {
  const client = options.client ?? supabaseAdmin;
  const control = new ProductTwoStageOperationClient(client);
  const credit = new ProductOneToOneCreditOperationClient(client);
  const financial = new TwoStageFinancialService({ client, control, credit });
  const probeVertical =
    options.probeVertical ?? new CompositionVerticalProbe({ client });

  const base: RunNineSixteenDeps["base"] = (input, deps) =>
    runSquareBase(input, {
      client,
      ...(deps ?? {}),
      ...(options.copyOps === undefined ? {} : { copyOps: options.copyOps }),
      ...(options.copyInvoker === undefined
        ? {}
        : { copyInvoker: options.copyInvoker }),
      ...(options.copyDirectorEnabled === undefined
        ? {}
        : { copyDirectorEnabled: options.copyDirectorEnabled }),
    });

  const prepare: RunNineSixteenDeps["prepare"] = (input, deps) =>
    prepareSquareForExpansion(input, { client, ...(deps ?? {}) });

  /**
   * ÚNICO ponto do repositório que traduz a seleção congelada (recebida do
   * orquestrador) para `ExpandVerticalDeps`. A seleção nunca vem da rota.
   */
  const expand: RunNineSixteenDeps["expand"] = (input, deps) =>
    expandVerticalToNineSixteen(input, { client, ...deps });

  /**
   * Gate pré-chamada da expansão: leitura estrita da configuração administrativa
   * (uma vez por invocação, com o MESMO client da fábrica) + preflight read-only
   * de modelo/pricing. Fail-closed e sem provider; a estimativa `image_unit_usd`
   * é reportada à parte e pode estar indisponível sem bloquear a cobertura.
   */
  const preflightExpansion: RunNineSixteenDeps["preflightExpansion"] = async () => {
    const read = await readNineSixteenExpansionConfig({ client });
    if (read.kind === "absent") {
      return {
        ok: false,
        failure: "configuration_missing",
        reason: "expansion_config_absent",
        missing: [],
      };
    }
    if (read.kind === "invalid") {
      return {
        ok: false,
        failure: "configuration_missing",
        reason: read.reason,
        missing: [],
      };
    }
    if (read.kind === "read_failed") {
      return {
        ok: false,
        failure: "configuration_read_failed",
        reason: read.reason,
        missing: [],
      };
    }

    const outcome = await preflightExpansionToNineSixteen({ client }, read.selection);
    if (outcome.ok) return { ok: true, selection: read.selection };
    const missing =
      outcome.failure === "pricing_unavailable" ? outcome.missing : [];
    return {
      ok: false,
      failure: outcome.failure,
      reason: outcome.reason,
      missing,
    };
  };

  /**
   * Gate da CONTINUAÇÃO/RETRY e da etapa de expansão: preflight read-only de
   * catálogo + pricing **apenas** da seleção congelada recebida. Não toca a
   * configuração administrativa vigente, então uma mudança administrativa
   * posterior não altera uma operação já aberta. Fail-closed, sem provider.
   */
  const preflightFrozenExpansion: RunNineSixteenDeps["preflightFrozenExpansion"] = async (
    selection,
  ) => {
    const outcome = await preflightExpansionToNineSixteen({ client }, selection);
    if (outcome.ok) return { ok: true, selection };
    const missing =
      outcome.failure === "pricing_unavailable" ? outcome.missing : [];
    return {
      ok: false,
      failure: outcome.failure,
      reason: outcome.reason,
      missing,
    };
  };

  const readFrozen: RunNineSixteenDeps["readFrozenState"] = (input, deps) =>
    readSquareBaseFrozenState(input, { client, ...(deps ?? {}) });

  const projectClosed: RunNineSixteenDeps["projectClosed"] = (input, deps) =>
    projectClosedCampaign(input, { client, ...(deps ?? {}) });

  const thumbnailContext = thumbnailContextFor(client);

  const generateThumbnail: RunNineSixteenDeps["generateThumbnail"] =
    options.generateThumbnail ??
    (async (input) => {
      const retrieved = await retrieveCompositionArtifact(
        {
          identity: {
            storeId: input.storeId,
            campaignId: input.campaignId,
            operationId: input.operationId,
            role: "vertical",
          },
          authorization: { kind: "system" },
        },
        { client },
      );
      if (retrieved.kind !== "integral") {
        return { status: "skipped", reason: "ineligible_path" };
      }
      return generateCampaignThumbnailSafely({
        originalPath: retrieved.artifact.storagePath,
        originalBuffer: retrieved.bytes,
        context: thumbnailContext,
        campaignId: input.campaignId,
      });
    });

  const projectDelivered: RunNineSixteenDeps["projectDelivered"] =
    options.projectDelivered ??
    ((input) => projectCompositionDelivery(client, input));

  return Object.freeze({
    client,
    control,
    financial,
    credit,
    clock: options.clock ?? (() => Date.now()),
    callIdFactory: options.callIdFactory ?? (() => crypto.randomUUID()),
    newSupportReference: generateSupportReference,
    base,
    prepare,
    expand,
    readFrozenState: readFrozen,
    projectDelivered,
    projectClosed,
    probeVertical,
    preflightExpansion,
    preflightFrozenExpansion,
    generateThumbnail,
    reconstruction: {
      client,
      readInputBytes: (storagePath: string) =>
        downloadCampaignInputFileWithClient(client, storagePath),
    },
    ...(options.pilotSpend === undefined ? {} : { pilotSpend: options.pilotSpend }),
  });
}
