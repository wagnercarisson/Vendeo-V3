import "server-only";
import { createServerClient, supabaseAdmin } from "@/lib/supabase/server";
import {
  deriveThumbnailPath,
  THUMBNAIL_BUCKET,
} from "./thumbnail/thumbnail-path";
import { classifyCampaignFlow } from "./new-flow-marker";
import {
  resolveCampaignFormat,
  type CampaignFormat,
} from "./format-resolution";
import type { CampaignStatus } from "./types";
import {
  readTwoFormatListSummaries,
  type TwoFormatListSummary,
} from "@/lib/product-two-format/list-summary";
import { classifyTwoFormatCampaign } from "@/lib/product-two-format/contracts";
import type { TwoFormatDeliveryState, TwoFormatFormat } from "@/lib/product-two-format/types";
import {
  buildIndividualFormatPresentation,
  buildJointFormatPresentation,
  buildUnavailableFormatPresentation,
  buildUnknownFormatPresentation,
  individualLifecycleFromStatus,
  type CampaignFormatPresentation,
} from "./format-presentation";

/** Classificação PERSISTIDA do fluxo (novo fluxo × legado) para exibição. */
export type CampaignListFlow = "new" | "legacy";

export interface CampaignListItem {
  id: string;
  productName: string;
  status: CampaignStatus;
  createdAt: string;
  thumbnailUrl: string | null;
  storagePath: string;
  /**
   * Quick 261018-enc — classificação derivada SERVER-SIDE do marcador persistido
   * (`frozenContentReferences`). O card recebe SOMENTE esta classificação, nunca o
   * `input_snapshot` inteiro. Legado/indeterminado ⇒ `"legacy"` (conservador).
   */
  flow: CampaignListFlow;
  /**
   * Quick 261106-qxn — formato resolvido SERVER-SIDE pelo contrato persistido.
   * `null` = indisponível (fail-closed); nunca inferido pela imagem ou path.
   */
  format: CampaignFormat | null;
  /** F60.7 C3 — campanha conjunta (uma única linha). */
  joint?: boolean;
  formats?: Readonly<
    Record<TwoFormatFormat, TwoFormatDeliveryState>
  >;
  preferredFormat?: TwoFormatFormat | null;
  /**
   * F61 — apresentação PADRONIZADA dos formatos `1:1`/`9:16`, montada
   * SERVER-SIDE a partir do snapshot classificado e da leitura conjunta em lote.
   * Somente estados/booleanos: nenhum snapshot, path ou URL cruza a fronteira.
   */
  readonly formatPresentation: CampaignFormatPresentation;
}

/** Base interna: a apresentação só existe depois da leitura em lote. */
export type CampaignListItemBase = Omit<CampaignListItem, "formatPresentation">;

export interface ListCampaignsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: Array<"ready" | "error">;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "created_at" | "product_name" | "status";
  sortOrder?: "asc" | "desc";
}

export interface ListCampaignsResult {
  items: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function mapToListItem(row: {
  id: string;
  product_name: string;
  status: string;
  created_at: string;
  storage_path: string;
  input_snapshot: Record<string, unknown> | null;
}): CampaignListItemBase {
  // A classificação é feita AQUI (servidor); o `input_snapshot` NÃO é retornado.
  const flow: CampaignListFlow =
    classifyCampaignFlow(row.input_snapshot) === "new_flow" ? "new" : "legacy";
  const formatResolution = resolveCampaignFormat(row.input_snapshot);
  return {
    id: row.id,
    productName: row.product_name,
    status: row.status as CampaignStatus,
    createdAt: row.created_at,
    thumbnailUrl: null,
    storagePath: row.storage_path,
    flow,
    format: formatResolution.kind === "unavailable" ? null : formatResolution.kind,
  };
}

/**
 * F61 — matriz de apresentação (61-CONTEXT §5) para UMA linha da listagem.
 *
 * Ordem obrigatória: classificação conjunta ANTES do resolvedor individual.
 * `inconsistent` ⇒ ambos `unavailable`; conjunto sem leitura ⇒ ambos `unknown`
 * (nunca cai no individual); individual segue `resolveCampaignFormat` + status.
 *
 * Puro sobre `rows`/`summaries` já obtidos: nenhuma consulta, assinatura,
 * RPC ou leitura adicional; nada é inferido por `storage_path`/miniatura.
 */
function buildListFormatPresentation(input: {
  readonly inputSnapshot: Record<string, unknown> | null;
  readonly status: CampaignStatus;
  readonly summary: TwoFormatListSummary | undefined;
}): CampaignFormatPresentation {
  const classification = classifyTwoFormatCampaign(input.inputSnapshot);

  if (classification.kind === "inconsistent") {
    return buildUnavailableFormatPresentation();
  }

  if (classification.kind === "two_format") {
    const summary = input.summary;
    // Sem summary apesar de classificado como conjunto ⇒ leitura indeterminada.
    if (!summary) return buildUnknownFormatPresentation();

    const view = summary.view;
    if (view === null) {
      // Leitura em lote sem `view`: usa os estados do lote, sem presumir estorno.
      return buildJointFormatPresentation({
        "1:1": { state: summary.formats["1:1"], refunded: false },
        "9:16": { state: summary.formats["9:16"], refunded: false },
      });
    }
    return buildJointFormatPresentation({
      "1:1": {
        state: view.square.state,
        refunded: view.square.creditRefunded,
      },
      "9:16": {
        state: view.vertical.state,
        refunded: view.vertical.creditRefunded,
      },
    });
  }

  return buildIndividualFormatPresentation({
    resolution: resolveCampaignFormat(input.inputSnapshot),
    lifecycle: individualLifecycleFromStatus(input.status),
  });
}

export async function listCampaigns(
  storeId: string,
  params?: ListCampaignsParams,
): Promise<ListCampaignsResult> {
  const supabase = await createServerClient();

  const {
    page = 1,
    pageSize = 10,
    search,
    status = ["ready", "error"],
    dateFrom,
    dateTo,
    sortBy = "created_at",
    sortOrder = "desc",
  } = params ?? {};

  let query = supabase
    .from("campaigns")
    .select("id, product_name, status, created_at, storage_path, input_snapshot", { count: "exact" })
    .eq("store_id", storeId)
    .in("status", status);

  if (search) {
    query = query.ilike("product_name", `%${search}%`);
  }

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  query = query.order(sortBy, { ascending: sortOrder === "asc" });

  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    if (error.message === "Requested range not satisfiable") {
      return { items: [], total: 0, page, pageSize, totalPages: 1 };
    }
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const rowsById = new Map(rows.map((row) => [row.id, row] as const));
  const items = rows.map(mapToListItem);
  const summaries = await readTwoFormatListSummaries({
    // RLS: `product_two_format_deliveries` concede SELECT somente a
    // `service_role`. A leitura privilegiada ocorre AQUI, após a autorização da
    // página, e é escopada por loja/campanhas pelo próprio helper.
    client: supabaseAdmin,
    storeId,
    campaigns: rows.map((row) => ({
      id: row.id,
      input_snapshot: row.input_snapshot,
    })),
  });
  const preferredThumbnails = await generateBatchPreferredThumbnailUrls(
    [...summaries.values()].map((summary) => ({
      id: summary.campaignId,
      preferredThumbnailPath: summary.preferredThumbnailPath,
    })),
  );
  // Conjuntos NÃO passam pela assinatura legada: a miniatura do preferido já
  // foi resolvida pela autoridade conjunta acima.
  const legacyThumbnails = await generateBatchThumbnailUrls(
    items.filter((item) => !summaries.has(item.id)),
  );
  const itemsWithThumbnails = items.map((item) => {
    const summary = summaries.get(item.id);
    const formatPresentation = buildListFormatPresentation({
      inputSnapshot: rowsById.get(item.id)?.input_snapshot ?? null,
      status: item.status,
      summary,
    });
    if (summary) {
      return {
        ...item,
        joint: true,
        formats: summary.formats,
        preferredFormat: summary.preferredFormat,
        thumbnailUrl: preferredThumbnails[item.id] ?? null,
        formatPresentation,
      };
    }
    return {
      ...item,
      thumbnailUrl: legacyThumbnails[item.id] ?? null,
      formatPresentation,
    };
  });

  const total = count ?? itemsWithThumbnails.length;

  return {
    items: itemsWithThumbnails,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function countCampaignsFiltered(
  storeId: string,
  params?: ListCampaignsParams,
): Promise<number> {
  const supabase = await createServerClient();

  const {
    search,
    status = ["ready", "error"],
    dateFrom,
    dateTo,
  } = params ?? {};

  let query = supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .in("status", status);

  if (search) {
    query = query.ilike("product_name", `%${search}%`);
  }

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function generateBatchThumbnailUrls(
  items: Pick<CampaignListItem, "id" | "status" | "storagePath">[],
): Promise<Record<string, string | null>> {
  const readyItems = items.filter(
    (item) => item.status === "ready" && item.storagePath,
  );

  const thumbnails: Record<string, string | null> = {};
  for (const item of readyItems) {
    thumbnails[item.id] = null;
  }

  const signable = readyItems.flatMap((item) => {
    // Caminho canônico da miniatura persistida (quick 261102-qna).
    // Inelegível ⇒ placeholder; NUNCA assina a arte original.
    const thumbnailPath = deriveThumbnailPath(item.storagePath);
    if (!thumbnailPath) {
      thumbnails[item.id] = null;
      return [];
    }
    return [{ id: item.id, thumbnailPath }];
  });

  const results = await Promise.allSettled(
    signable.map((item) =>
      supabaseAdmin.storage
        .from(THUMBNAIL_BUCKET)
        .createSignedUrl(item.thumbnailPath, 3600)
        .then((res) => ({ id: item.id, url: res.data?.signedUrl ?? null })),
    ),
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.url) {
      thumbnails[result.value.id] = result.value.url;
    }
  }

  return thumbnails;
}

/**
 * F60.7 C3 — assina em LOTE as miniaturas do formato preferido das campanhas
 * conjuntas. Uma única rodada de `createSignedUrl`; path ausente ⇒ placeholder.
 */
export async function generateBatchPreferredThumbnailUrls(
  items: readonly { id: string; preferredThumbnailPath: string | null }[],
): Promise<Record<string, string | null>> {
  const thumbnails: Record<string, string | null> = {};
  const idsByPath = new Map<string, string[]>();
  for (const item of items) {
    thumbnails[item.id] = null;
    if (!item.preferredThumbnailPath) continue;
    const ids = idsByPath.get(item.preferredThumbnailPath) ?? [];
    ids.push(item.id);
    idsByPath.set(item.preferredThumbnailPath, ids);
  }

  const paths = [...idsByPath.keys()];
  if (paths.length === 0) return thumbnails;

  // Assinatura REALMENTE em lote: uma única chamada para todos os caminhos.
  const { data, error } = await supabaseAdmin.storage
    .from(THUMBNAIL_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error || !data) return thumbnails;

  for (const entry of data) {
    if (!entry.signedUrl || typeof entry.path !== "string") continue;
    for (const id of idsByPath.get(entry.path) ?? []) {
      thumbnails[id] = entry.signedUrl;
    }
  }
  return thumbnails;
}
