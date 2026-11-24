import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { COMPOSITION_ARTIFACT_BUCKET } from "@/lib/campaign/composition-artifacts/artifact-path";
import { createNodeHttpDownloadTransport } from "@/lib/campaign/composition-artifacts/node-http-download";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { downloadStorageObjectViaNodeHttp } from "@/lib/product-1-1/artifact/node-http-storage-download";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface SquareReleasePreview {
  readonly previewUrl: string;
  readonly downloadUrl: string;
}

/**
 * Preview do quadrado JÁ armazenado. Valida a integridade pelo conteúdo antes
 * de assinar a URL de exibição; o download continua na rota autenticada, que
 * revalida a liberação e os bytes.
 */
export async function readSquareReleasePreview(
  input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly verticalOperationId: string;
  },
  deps: { readonly client?: SupabaseClient } = {},
): Promise<SquareReleasePreview | null> {
  const client = deps.client ?? supabaseAdmin;
  try {
    const artifact = await retrieveCompositionArtifact(
      {
        identity: {
          storeId: input.storeId,
          campaignId: input.campaignId,
          operationId: input.verticalOperationId,
          role: "square_original",
        },
        authorization: { kind: "system" },
      },
      {
        client,
        downloadBytes: createNodeHttpDownloadTransport((download) =>
          downloadStorageObjectViaNodeHttp({
            bucket: download.bucket,
            path: download.path,
            timeoutMs: 15000,
          }),
        ),
      },
    );
    if (artifact.kind !== "integral") return null;
    const signed = await client.storage
      .from(COMPOSITION_ARTIFACT_BUCKET)
      .createSignedUrl(artifact.artifact.storagePath, 300);
    if (signed.error || !signed.data?.signedUrl) return null;
    return {
      previewUrl: signed.data.signedUrl,
      downloadUrl: `/api/campaign/${input.campaignId}/download?format=1:1`,
    };
  } catch {
    return null;
  }
}
