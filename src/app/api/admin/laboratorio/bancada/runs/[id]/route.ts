import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  createBenchArtifactSignedUrl,
  listBenchArtifacts,
} from "@/lib/lab/bench/persistence/bench-artifact-service";
import {
  getBenchRun,
  listBenchRunLineage,
} from "@/lib/lab/bench/persistence/bench-run-service";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.2.2 (D9/D11/D13/T-48-2-2-35): detalhe da geração com evidência técnica e
// financeira e artefatos por URL assinada. Ordem: admin → guarda de ambiente →
// leitura. `getBenchRun` dispara a reconciliação preguiçosa; as URLs assinadas
// (curta duração, TTL do servidor) são geradas server-side pelo signer de
// artefatos do laboratório (`createBenchArtifactSignedUrl`) — nenhum bucket/path
// é aceito do cliente e nenhum secret é exposto.

/** Assina um artefato; degrada para `null` quando a assinatura falha. */
async function signArtifact(storagePath: string): Promise<string | null> {
  try {
    return await createBenchArtifactSignedUrl({
      client: supabaseAdmin,
      storagePath,
    });
  } catch {
    return null;
  }
}

/**
 * Custo reportado pelo provider, extraído de `cost_detail` (F48.2.4, D14) — mantido
 * **separado** do custo calculado/estimado localmente. Sem secrets.
 */
function reportedCostFromDetail(costDetail: unknown): number | null {
  if (!costDetail || typeof costDetail !== "object") return null;
  const candidate = (costDetail as { provider_reported_cost_usd?: unknown })
    .provider_reported_cost_usd;
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();

    try {
      assertLabEnvironment();
    } catch (error) {
      if (error instanceof LabEnvironmentError) {
        return NextResponse.json(labEnvironmentDeniedBody(error.reason), {
          status: 403,
        });
      }
      throw error;
    }

    const { id } = await params;

    const run = await getBenchRun({ client: supabaseAdmin, runId: id });
    if (!run) {
      return NextResponse.json({ error: "run_not_found" }, { status: 404 });
    }

    const artifacts = await Promise.all(
      (await listBenchArtifacts({ client: supabaseAdmin, runId: id })).map(
        async (artifact) => ({
          id: artifact.id,
          kind: artifact.kind,
          storagePath: artifact.storagePath,
          mimeType: artifact.mimeType,
          width: artifact.width,
          height: artifact.height,
          bytes: artifact.bytes,
          checksum: artifact.checksum,
          signedUrl: await signArtifact(artifact.storagePath),
        }),
      ),
    );

    // Lista de tentativas por linhagem explícita (`attempt_of_run_id`): raiz +
    // descendentes, ordenados por `created_at` (D13). Sem heurística de fingerprint.
    const lineage = await listBenchRunLineage({ client: supabaseAdmin, runId: id });
    const attempts = lineage.map((entry) => ({
      id: entry.id,
      status: entry.status,
      attemptOfRunId: entry.attemptOfRunId,
      createdAt: entry.createdAt,
      finishedAt: entry.finishedAt,
      promptBaseVersion: entry.promptBaseVersion,
    }));

    return NextResponse.json({
      run: {
        id: run.id,
        status: run.status,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        config: run.config,
        campaignSnapshot: run.campaignSnapshot,
        brandingSnapshot: run.brandingSnapshot,
        promptSent: run.promptSent,
        // Evidência mínima do preflight (F48.2.3, D20).
        promptBase: run.promptBase,
        promptCompiled: run.promptCompiled,
        promptApproved: run.promptApproved,
        promptBlocks: run.promptBlocks,
        composerVersion: run.composerVersion,
        // Versões/identidade/linhagem da F48.2.4 (D14/D15).
        policyVersions: run.policyVersions,
        promptBaseVersion: run.promptBaseVersion,
        identityReference: run.identityReference,
        attemptOfRunId: run.attemptOfRunId,
        references: run.references,
        provider: run.provider,
        protocol: run.protocol,
        model: run.model,
        size: run.size,
        quality: run.quality,
        intent: run.intent,
        contentType: run.contentType,
        structure: run.structure,
        theme: run.theme,
        latencyMs: run.latencyMs,
        usage: run.usage,
        // Custo calculado (local) × custo reportado pelo provider — separados.
        estimatedCostUsd: run.estimatedCostUsd,
        calculatedCostUsd: run.estimatedCostUsd,
        reportedCostUsd: reportedCostFromDetail(run.costDetail),
        costDetail: run.costDetail,
        costSource: run.costSource,
        costRuleVersion: run.costRuleVersion,
        errorType: run.errorType,
        errorMessage: run.errorMessage,
        technicalValidation: run.technicalValidation,
      },
      attempts,
      artifacts,
    });
  },
);
