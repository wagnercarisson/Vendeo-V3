import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";

import { ProductOneToOneAttemptStartClient } from "./attempt-start-client";
import { listAttempts } from "./attempt-history";
import type { AttemptTarget, CampaignOperationState } from "./attempt-start-types";
import { ProductOneToOneArtifactStore } from "../artifact/artifact-store";
import type { ArtifactProbe } from "../artifact/types";

/**
 * F56.2b1b (B1B-D2/D5, C1/C2, F4/F6 / REQ-56.2.2-06) — reenvio como CONSULTA pura.
 *
 * `queryProductOneToOneOperation` LÊ o estado persistido da operação (Plano 03,
 * incluindo o resultado desconhecido PERSISTIDO — C1), as tentativas append-only
 * e a sonda TIPADA da arte (Plano 05, C2). NÃO cria snapshot, NÃO reserva, NÃO
 * inicia tentativa, NÃO estorna e NÃO chama o provider — nenhum caminho de
 * mutação existe neste módulo.
 *
 * F4 — estado VERBATIM: o estado devolvido é o status PERSISTIDO
 * (`reserved`|`art_uploaded`|`delivered`|`refunded`), ou `unknown` quando o
 * resultado desconhecido estiver persistido. A EXISTÊNCIA de objeto salvo NÃO
 * promove o estado para `delivered`; a arte/URL assinada só é exposta quando o
 * estado persistido é `delivered` E a sonda é `integral`.
 */

export type ProductOneToOneOperationState =
  | "reserved"
  | "art_uploaded"
  | "delivered"
  | "refunded"
  | "unknown";

export interface ProductOneToOneOperationAttemptView {
  readonly attemptNumber: number;
  readonly target: AttemptTarget;
}

export interface ProductOneToOneOperationView {
  readonly campaignId: string;
  readonly operationId: string;
  /** Estado PERSISTIDO verbatim (F4) — nunca promovido por presença de objeto. */
  readonly state: ProductOneToOneOperationState;
  readonly terminal: boolean;
  readonly unknown: boolean;
  readonly supportReference: string | null;
  readonly attempts: readonly ProductOneToOneOperationAttemptView[];
  /** Preenchido SOMENTE quando `state === "delivered"` E `kind === "integral"`. */
  readonly artifactUrl: string | null;
  readonly artifactKind: ArtifactProbe["kind"] | null;
}

export interface QueryProductOneToOneOperationInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
}

export interface ResendQueryDeps {
  readonly getCampaignOperation?: (
    campaignId: string,
  ) => Promise<CampaignOperationState | null>;
  readonly listAttempts?: (input: {
    campaignId: string;
    operationId: string;
  }) => Promise<readonly { attemptNumber: number; target: AttemptTarget }[]>;
  readonly probeArtifact?: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<ArtifactProbe>;
  readonly getSignedArtifactUrl?: (storagePath: string) => Promise<string>;
}

export async function queryProductOneToOneOperation(
  input: QueryProductOneToOneOperationInput,
  deps: ResendQueryDeps = {},
): Promise<ProductOneToOneOperationView | null> {
  const artifactStore = new ProductOneToOneArtifactStore(supabaseAdmin);
  const getCampaignOperation =
    deps.getCampaignOperation ??
    ((campaignId: string) =>
      new ProductOneToOneAttemptStartClient(supabaseAdmin).getCampaignOperation(campaignId));
  const listOperationAttempts =
    deps.listAttempts ??
    ((query: { campaignId: string; operationId: string }) =>
      listAttempts(supabaseAdmin, query));
  const probeArtifact =
    deps.probeArtifact ?? ((query) => artifactStore.probeArtifact(query));
  const getSignedArtifactUrl =
    deps.getSignedArtifactUrl ?? ((path) => artifactStore.getSignedArtifactUrl(path));

  const operation = await getCampaignOperation(input.campaignId);
  if (!operation || operation.operationId !== input.operationId) {
    return null;
  }

  // F4/C1 — estado VERBATIM: `unknown` SÓ governa operação NÃO terminal; a
  // precedência terminal (`delivered`/`refunded`) é aplicada na leitura.
  // P2 (F56.2b2b) — `outcome='failed'` NÃO terminal é PENDÊNCIA de resolução
  // (nunca geração ativa).
  const pending =
    !operation.terminal &&
    (operation.unknown === true || operation.outcome === "failed");
  const state: ProductOneToOneOperationState = pending ? "unknown" : operation.status;

  const attempts = await listOperationAttempts({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });

  const probe = await probeArtifact({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });

  // F4/I3 — a arte (URL assinada) só é liberada com estado PERSISTIDO `delivered`
  // E objeto `integral`. `reserved`/`art_uploaded` NUNCA liberam arte/URL, mesmo
  // com objeto presente; `absent`/`invalid`/`indeterminate` nunca expõem arte.
  let artifactUrl: string | null = null;
  if (state === "delivered" && probe.kind === "integral") {
    artifactUrl = await getSignedArtifactUrl(probe.storagePath);
  }

  return Object.freeze({
    campaignId: operation.campaignId,
    operationId: operation.operationId,
    state,
    terminal: operation.terminal,
    unknown: state === "unknown",
    supportReference: operation.supportReference,
    attempts: Object.freeze(
      attempts.map((attempt) =>
        Object.freeze({ attemptNumber: attempt.attemptNumber, target: attempt.target }),
      ),
    ),
    artifactUrl,
    artifactKind: probe.kind,
  });
}
