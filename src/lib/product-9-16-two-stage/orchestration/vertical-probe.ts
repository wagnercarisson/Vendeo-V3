import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyCampaignAccess } from "@/lib/campaign/composition-artifacts/access";
import {
  COMPOSITION_ARTIFACT_BUCKET,
  compositionArtifactStoragePath,
} from "@/lib/campaign/composition-artifacts/artifact-path";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { ROLE_POLICY } from "@/lib/campaign/composition-artifacts/role-policy";
import { CompositionArtifactStorage } from "@/lib/campaign/composition-artifacts/storage";
import { isCompatibleExpansionArtifact } from "@/lib/campaign/vertical-expansion/reuse-compatibility";
import { verifyExpansionReuseEvidence } from "@/lib/campaign/vertical-expansion/reuse-evidence";
import type {
  ArtifactIdentity,
  ArtifactRecord,
} from "@/lib/campaign/composition-artifacts/types";
import type { ArtifactProbe } from "@/lib/product-1-1/artifact/types";
import type {
  VerticalArtifactProbe,
  VerticalArtifactProbeInput,
  VerticalArtifactProbeResult,
} from "../two-stage-financial-service";

export interface CompositionProbeDeps {
  readonly client?: SupabaseClient;
}

type ProbeOutcome =
  | { readonly kind: "integral"; readonly artifact: ArtifactRecord }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" }
  | { readonly kind: "indeterminate" };

export class CompositionVerticalProbe
  implements VerticalArtifactProbe
{
  private readonly client: SupabaseClient;

  constructor(deps: CompositionProbeDeps = {}) {
    this.client = deps.client ?? supabaseAdmin;
  }

  private async probe(
    input: VerticalArtifactProbeInput,
  ): Promise<ProbeOutcome> {
    const identity: ArtifactIdentity = {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      role: "vertical",
    };

    // Binding campanha -> loja antes de qualquer leitura de arte.
    const access = await verifyCampaignAccess(
      {
        storeId: input.storeId,
        campaignId: input.campaignId,
        authorization: { kind: "system" },
      },
      this.client,
    );
    if (!access.ok) return { kind: "indeterminate" };

    // (1) Linha ANTES do objeto. Linha ausente NAO prova ausencia de arte:
    //     consultar o path canonico e so devolver `absent` com o objeto ausente.
    const row = await getArtifactByIdentity(identity, this.client);
    if (row.kind === "read_failed") return { kind: "indeterminate" };
    if (row.kind === "absent") {
      const storage = new CompositionArtifactStorage(this.client);
      const info = await storage.readObjectInfo(
        compositionArtifactStoragePath(identity),
      );
      if (info.kind === "indeterminate") return { kind: "indeterminate" };
      // Objeto presente sem linha: estado conservador para reconciliacao —
      // nunca autoriza entrega nem estorno.
      if (info.kind === "found") return { kind: "invalid" };
      return { kind: "absent" };
    }
    const artifact = row.record;

    // (2) Conteudo integral + path/bucket/dimensao/MIME conferidos.
    const retrieved = await retrieveCompositionArtifact(
      { identity, authorization: { kind: "system" } },
      { client: this.client },
    );
    if (retrieved.kind === "indeterminate") return { kind: "indeterminate" };
    if (retrieved.kind === "absent") return { kind: "absent" };
    if (retrieved.kind !== "integral") return { kind: "invalid" };

    if (
      artifact.storageBucket !== COMPOSITION_ARTIFACT_BUCKET ||
      artifact.storagePath !== compositionArtifactStoragePath(identity)
    ) {
      return { kind: "invalid" };
    }
    if (
      artifact.format !== ROLE_POLICY.vertical.format ||
      artifact.width !== ROLE_POLICY.vertical.width ||
      artifact.height !== ROLE_POLICY.vertical.height ||
      artifact.mimeType !== ROLE_POLICY.vertical.mimeType
    ) {
      return { kind: "invalid" };
    }

    // (3) A linha precisa ser COMPROVADAMENTE uma expansao da fonte preparada.
    if (artifact.origin !== "ai_expansion") return { kind: "invalid" };
    const sourceRow = await getArtifactByIdentity(
      {
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        role: "square_prepared",
      },
      this.client,
    );
    if (sourceRow.kind === "read_failed") return { kind: "indeterminate" };
    if (sourceRow.kind === "absent") return { kind: "invalid" };
    if (
      !isCompatibleExpansionArtifact({
        artifact,
        source: sourceRow.record,
      })
    ) {
      return { kind: "invalid" };
    }

    // (4) Evidencia durável do objeto conferida pelo verificador da F60.3.
    const evidence = await verifyExpansionReuseEvidence(
      artifact,
      sourceRow.record,
      { client: this.client },
    );
    if (evidence.kind !== "verified") {
      return evidence.reason === "indeterminate"
        ? { kind: "indeterminate" }
        : { kind: "invalid" };
    }

    return { kind: "integral", artifact };
  }

  async probeVerticalArtifact(
    input: VerticalArtifactProbeInput,
  ): Promise<VerticalArtifactProbeResult> {
    const outcome = await this.probe(input);
    switch (outcome.kind) {
      case "integral":
        return Object.freeze({
          kind: "integral" as const,
          format: "9:16" as const,
          width: 1080 as const,
          height: 1920 as const,
          mimeType: "image/jpeg" as const,
          storagePath: outcome.artifact.storagePath,
          evidenceRef: outcome.artifact.id,
        });
      case "absent":
        return Object.freeze({ kind: "absent" as const });
      case "invalid":
        return Object.freeze({ kind: "invalid" as const });
      case "indeterminate":
        return Object.freeze({ kind: "indeterminate" as const });
    }
  }

  async probeArtifact(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<ArtifactProbe> {
    const outcome = await this.probe(input);
    if (outcome.kind !== "integral") {
      return Object.freeze({ kind: outcome.kind });
    }
    const artifact = outcome.artifact;
    return Object.freeze({
      kind: "integral" as const,
      ref: Object.freeze({
        storagePath: artifact.storagePath,
        width: artifact.width,
        height: artifact.height,
        mimeType: artifact.mimeType,
      }),
      width: artifact.width,
      height: artifact.height,
      mimeType: artifact.mimeType,
      storagePath: artifact.storagePath,
    });
  }
}
