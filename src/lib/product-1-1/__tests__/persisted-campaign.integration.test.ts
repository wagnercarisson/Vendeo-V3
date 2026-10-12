// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { ImageGenerationConfigSnapshot } from "@/lib/ai/image-generation-config-snapshot";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { NewFlowPreflightResult } from "../orchestration/preflight";
import type { AttemptCostResolver } from "../orchestration/instrumentation";
import { ProductOneToOneAttemptStartClient } from "../orchestration/attempt-start-client";
import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";
import { ProductOneToOneArtifactStore } from "../artifact/artifact-store";
import {
  buildProductOneToOneFrozenEvidence,
  persistProductOneToOneSnapshot,
  type ProductOneToOneFrozenEvidence,
} from "../snapshot/persist-snapshot";
import { queryProductOneToOneOperation } from "../orchestration/resend-query";
import {
  runProductOneToOneGeneration,
  type ProductOneToOneGenerationDeps,
} from "../orchestration/generation-orchestrator";
import {
  attemptClaimRows,
  closeIsolatedContext,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  creditOperationRow,
  deductionCount,
  jpeg1024DataUrl,
  reserveCredit,
  setCredits,
  terminalEvent,
  readNdjson,
  type IsolatedContext,
} from "./integration-harness";

/**
 * F56.2b1b — Plano 09 / Task 2: queda de conexão (§6.4) e persistência/
 * recuperação da campanha concluída; evidência congelada IMUTÁVEL; C3 (duas
 * submissões com a mesma identidade). Postgres/Storage reais; provider simulado.
 */

const PRIMARY = { model: "gpt-image-2.5-sunburst", quality: "medium" } as const;
const FALLBACK = { model: "gpt-image-2", quality: "medium" } as const;

let ctx: IsolatedContext;
let storeId: string;

const briefing = {
  backgroundDirection: "studio" as const,
  product: { name: "Produto 1:1", description: "Descrição" },
  commercial: {
    intent: "offer" as const,
    originalPriceText: "R$ 100",
    discountedPriceText: "R$ 80",
    badge: null,
    validity: null,
  },
  constraints: { mandatoryArtworkText: null },
};

function snapshotFor(campaignId: string): ImageGenerationConfigSnapshot {
  return {
    campaignId,
    primaryModel: PRIMARY.model,
    primaryQuality: PRIMARY.quality,
    fallbackModel: FALLBACK.model,
    fallbackQuality: FALLBACK.quality,
    configVersionId: randomUUID(),
    origin: "selection",
    runId: randomUUID(),
    traceId: `trace-${randomUUID()}`,
    createdAt: new Date().toISOString(),
  } as unknown as ImageGenerationConfigSnapshot;
}

function evidenceFor(campaignId: string, operationId: string, briefingText: string): ProductOneToOneFrozenEvidence {
  return buildProductOneToOneFrozenEvidence({
    campaignId,
    operationId,
    campaignIntent: "offer",
    backgroundDirection: "studio",
    briefing: briefingText,
    referenceSelections: [{ kind: "product", id: "sha256-abc", role: "primary", index: 0 }],
    baseVersion: "48.2.6-produto-1-1-v1",
    composerVersion: "48.2.4-prompt-composer-v6",
    policyVersions: { intent: "48.2.4", formato: "48.2.4-formato-1-1" },
  });
}

function deps(overrides: Partial<ProductOneToOneGenerationDeps> = {}): ProductOneToOneGenerationDeps {
  const supabase = ctx.supabase;
  return {
    client: supabase,
    runPreflight: async () =>
      ({
        config: { primary: PRIMARY, fallback: FALLBACK, origin: "selection", configVersionId: randomUUID() },
        pricing: { status: "complete" },
      }) as unknown as NewFlowPreflightResult,
    buildSnapshot: (_config, context) => snapshotFor(context.campaignId),
    credit: new ProductOneToOneCreditOperationClient(supabase),
    attempts: new ProductOneToOneAttemptStartClient(supabase),
    artifact: new ProductOneToOneArtifactStore(supabase),
    recordAttempt: async () => ({}),
    resolveAttemptCost: (async () => {
      throw new Error("pricing_stub");
    }) as unknown as AttemptCostResolver,
    generateSupportReference: () => "IMG-001-test",
    recordDiagnosis: async () => ({ reference: "IMG-001-test" }),
    ...overrides,
  };
}

function queryDeps() {
  const supabase = ctx.supabase;
  const attempts = new ProductOneToOneAttemptStartClient(supabase);
  const artifact = new ProductOneToOneArtifactStore(supabase);
  return {
    getCampaignOperation: (campaignId: string) => attempts.getCampaignOperation(campaignId),
    listAttempts: async (input: { campaignId: string; operationId: string }) => {
      const { data } = await supabase
        .from("image_generation_operations")
        .select("attempt_number, target")
        .eq("campaign_id", input.campaignId)
        .eq("operation_id", input.operationId);
      return (data ?? []).map((row: { attempt_number: number; target: string }) => ({
        attemptNumber: row.attempt_number,
        target: row.target as "primary" | "fallback",
      }));
    },
    probeArtifact: (input: { storeId: string; campaignId: string; operationId: string }) =>
      artifact.probeArtifact(input),
    getSignedArtifactUrl: (path: string) => artifact.getSignedArtifactUrl(path),
  };
}

describe("F56.2b1b — persisted campaign / frozen evidence (Postgres/Storage real)", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
    await setCredits(ctx.pg, storeId, 30);
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  it("§6.4(a) queda de conexão ⇒ resultado DESCONHECIDO persistido; re-consulta NÃO retoma geração", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const provider = { calls: 0 };
    const abortGateway = {
      invoke: async () => {
        provider.calls += 1;
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
    } as unknown as AiInvoker;

    const response = await runProductOneToOneGeneration(
      {
        campaignId: campaign,
        operationId,
        storeId,
        briefing,
        briefingText: "briefing",
        campaignIntent: "offer",
        backgroundDirection: "studio",
      },
      deps({ createGateway: () => abortGateway }),
    );
    const terminal = terminalEvent(await readNdjson(response));
    expect(terminal.type).toBe("unknown");
    expect(provider.calls).toBe(1);

    // A operação permanece pendente/desconhecida; re-consultar NÃO chama o provider.
    const view = await queryProductOneToOneOperation(
      { storeId, campaignId: campaign, operationId },
      queryDeps(),
    );
    expect(view?.state).toBe("unknown");
    expect(provider.calls).toBe(1);
    expect((await creditOperationRow(ctx.pg, campaign, operationId))?.status).toBe("reserved");
  }, 60_000);

  it("§6.4(b) campanha concluída é recuperável após reload (sem retomar/refazer processamento)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const image = await jpeg1024DataUrl();
    const gateway = {
      invoke: async () => ({ imageBase64: image.split(",")[1], mimeType: "image/jpeg" }),
    } as unknown as AiInvoker;

    const response = await runProductOneToOneGeneration(
      {
        campaignId: campaign,
        operationId,
        storeId,
        briefing,
        briefingText: "briefing",
        campaignIntent: "offer",
        backgroundDirection: "studio",
      },
      deps({ createGateway: () => gateway }),
    );
    expect(terminalEvent(await readNdjson(response)).type).toBe("result");

    // Reload: estado/arte recuperados do PERSISTIDO, sem nova chamada ao provider.
    const view = await queryProductOneToOneOperation(
      { storeId, campaignId: campaign, operationId },
      queryDeps(),
    );
    expect(view).toMatchObject({ state: "delivered", terminal: true, artifactKind: "integral" });
    expect(view?.artifactUrl).toContain("token=");
  }, 60_000);

  it("§6.4(c) evidência congelada é recarregável com os valores exatos e IMUTÁVEL (trigger)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const evidence = evidenceFor(campaign, operationId, "briefing congelado");
    const persisted = await persistProductOneToOneSnapshot(
      ctx.supabase,
      snapshotFor(campaign),
      evidence,
    );

    const { rows } = await ctx.pg.query<{
      snapshot_original_id: string;
      campaign_intent: string;
      background_direction: string;
      briefing: string;
      reference_selections: unknown;
      base_version: string;
      composer_version: string;
      policy_versions: unknown;
    }>(
      "SELECT snapshot_original_id, campaign_intent, background_direction, briefing, reference_selections, base_version, composer_version, policy_versions FROM public.product_1_1_snapshot_frozen_evidence WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operationId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      snapshot_original_id: persisted.snapshotOriginalId,
      campaign_intent: "offer",
      background_direction: "studio",
      briefing: "briefing congelado",
      base_version: "48.2.6-produto-1-1-v1",
      composer_version: "48.2.4-prompt-composer-v6",
    });
    expect(rows[0].reference_selections).toEqual([
      { kind: "product", id: "sha256-abc", role: "primary", index: 0 },
    ]);
    expect(rows[0].policy_versions).toEqual({ intent: "48.2.4", formato: "48.2.4-formato-1-1" });

    // UPDATE/DELETE recusados pelo trigger de imutabilidade (round-trip).
    await ctx.pg.query("BEGIN");
    try {
      await ctx.pg.query("SAVEPOINT frozen_update");
      let updateError: unknown;
      try {
        await ctx.pg.query(
          "UPDATE public.product_1_1_snapshot_frozen_evidence SET briefing = 'mutado' WHERE campaign_id = $1 AND operation_id = $2",
          [campaign, operationId],
        );
      } catch (error) {
        updateError = error;
      }
      expect((updateError as Error | undefined)?.message).toBe(
        "product_1_1_snapshot_frozen_evidence_immutable",
      );
      await ctx.pg.query("ROLLBACK TO SAVEPOINT frozen_update");
    } finally {
      await ctx.pg.query("ROLLBACK");
    }
  }, 60_000);

  it("C3 — duas submissões COMPLETAS CONCORRENTES com a MESMA identidade ⇒ UMA campanha/UM snapshot/UM evidence/UMA dedução", async () => {
    // Store DEDICADA: `deductionCount` conta SOMENTE as deduções desta operação.
    const store = await createTestStore(ctx.supabase);
    await setCredits(ctx.pg, store.storeId, 10);
    const campaign = await createCampaign(ctx.supabase, store.storeId);
    const operationId = randomUUID();
    const image = await jpeg1024DataUrl();
    let providerCalls = 0;
    const gateway = {
      invoke: async () => {
        providerCalls += 1;
        return { imageBase64: image.split(",")[1], mimeType: "image/jpeg" };
      },
    } as unknown as AiInvoker;
    const submissionInput = {
      campaignId: campaign,
      operationId,
      storeId: store.storeId,
      briefing,
      briefingText: "briefing",
      campaignIntent: "offer" as const,
      backgroundDirection: "studio" as const,
    };

    // DUAS submissões COMPLETAS e SIMULTÂNEAS com a MESMA identidade.
    const [first, second] = await Promise.all([
      runProductOneToOneGeneration(submissionInput, deps({ createGateway: () => gateway })),
      runProductOneToOneGeneration(submissionInput, deps({ createGateway: () => gateway })),
    ]);
    const terminals = [await readNdjson(first), await readNdjson(second)].map(terminalEvent);
    // Ao menos uma ENTREGOU; nenhuma abre uma segunda operação.
    expect(terminals.some((terminal) => terminal.type === "result")).toBe(true);
    // Uma ÚNICA chamada ao provider (a corrida perdedora NÃO chama).
    expect(providerCalls).toBe(1);

    // EXATAMENTE UMA campanha.
    const campaigns = await ctx.pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.campaigns WHERE id = $1",
      [campaign],
    );
    expect(campaigns.rows[0].n).toBe(1);
    // UM snapshot + UMA evidência congelada.
    const snapshots = await ctx.pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.image_generation_config_snapshots WHERE campaign_id = $1",
      [campaign],
    );
    expect(snapshots.rows[0].n).toBe(1);
    const evidences = await ctx.pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.product_1_1_snapshot_frozen_evidence WHERE campaign_id = $1",
      [campaign],
    );
    expect(evidences.rows[0].n).toBe(1);
    // UMA operação de crédito e EXATAMENTE UMA dedução (sem reserva duplicada).
    const creditOps = await ctx.pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.product_1_1_campaign_credit_operations WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operationId],
    );
    expect(creditOps.rows[0].n).toBe(1);
    expect(await deductionCount(ctx.pg, store.storeId)).toBe(1);

    // Conteúdo DIVERGENTE para a mesma identidade ⇒ conflito (nada gravado).
    const divergent = evidenceFor(campaign, operationId, "briefing DIFERENTE");
    await expect(
      persistProductOneToOneSnapshot(ctx.supabase, snapshotFor(campaign), divergent),
    ).rejects.toThrow(/operation_identity_conflict/);
  }, 90_000);

  it("C3 — o `snapshot_original_id` da evidência é o MESMO do snapshot persistido", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const persisted = await persistProductOneToOneSnapshot(
      ctx.supabase,
      snapshotFor(campaign),
      evidenceFor(campaign, operationId, "briefing"),
    );
    const { rows } = await ctx.pg.query<{ snapshot_original_id: string }>(
      "SELECT snapshot_original_id FROM public.product_1_1_snapshot_frozen_evidence WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operationId],
    );
    expect(rows[0].snapshot_original_id).toBe(persisted.snapshotOriginalId);
    expect(await attemptClaimRows(ctx.pg, campaign, operationId)).toHaveLength(0);
  }, 60_000);
});
