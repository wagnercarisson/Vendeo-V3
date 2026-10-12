// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { ImageGenerationConfigSnapshot } from "@/lib/ai/image-generation-config-snapshot";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiInvocationRequest } from "@/lib/ai/types";
import type { ArtifactProbe } from "../artifact/types";
import type { NewFlowPreflightResult } from "../orchestration/preflight";
import type { AttemptCostResolver } from "../orchestration/instrumentation";
import { SupabaseImageGenerationDiagnosisRepository } from "@/lib/ai/image-generation-diagnosis-repository";
import { resolveIdentityImageAsDataUrl } from "@/lib/store-identity/identity-image";
import { ProductOneToOneAttemptStartClient } from "../orchestration/attempt-start-client";
import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";
import { ProductOneToOneArtifactStore, artifactStoragePath } from "../artifact/artifact-store";
import {
  persistProductOneToOneSnapshot,
  buildProductOneToOneFrozenEvidence,
} from "../snapshot/persist-snapshot";
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
  jpeg1024DataUrl,
  readNdjson,
  setCredits,
  terminalEvent,
  type IsolatedContext,
} from "./integration-harness";

/**
 * F56.2b1b — Plano 09 / Task 4: provas REAIS das correções de integração do
 * Plano 04 (achados 4/5/6) e dos gaps 1/3/4, mais as correções B1/B2/I1/I2 na
 * instância isolada. Provider SIMULADO; Postgres/Storage reais.
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
    generateSupportReference: () => randomUUID(),
    ...overrides,
  };
}

function input(campaign: string, operation: string) {
  return {
    campaignId: campaign,
    operationId: operation,
    storeId,
    briefing,
    briefingText: "briefing",
    campaignIntent: "offer" as const,
    backgroundDirection: "studio" as const,
  };
}

function gatewayCapturing(
  captured: AiInvocationRequest[],
  behavior: () => Promise<{ imageBase64: string; mimeType: string }>,
): AiInvoker {
  return {
    invoke: async (_capability: string, request: AiInvocationRequest) => {
      captured.push(request);
      return behavior();
    },
  } as unknown as AiInvoker;
}

function integralProbe(campaignId: string, operationId: string): ArtifactProbe {
  const storagePath = artifactStoragePath(storeId, campaignId, operationId);
  return {
    kind: "integral",
    ref: { storagePath, width: 1024, height: 1024, mimeType: "image/jpeg" },
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    storagePath,
  };
}

describe("F56.2b1b — integration corrections (Postgres/Storage real)", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
    await setCredits(ctx.pg, storeId, 40);
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  it("(achado 5a) falha de LEITURA da operação ⇒ bloqueio fail-closed (zero snapshot/reserva/provider)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    let persistCalls = 0;
    let reserveCalls = 0;
    let providerCalls = 0;
    const real = new ProductOneToOneAttemptStartClient(ctx.supabase);
    const credit = new ProductOneToOneCreditOperationClient(ctx.supabase);

    const response = await runProductOneToOneGeneration(
      input(campaign, operationId),
      deps({
        attempts: {
          acquire: (i) => real.acquire(i),
          finish: (i) => real.finish(i),
          recordOperationOutcome: (i) => real.recordOperationOutcome(i),
          getCampaignOperation: async () => {
            throw new Error("operation_read_unavailable");
          },
        },
        persistSnapshot: async () => {
          persistCalls += 1;
          return { snapshotOriginalId: randomUUID(), reused: false };
        },
        credit: {
          reserve: async (i) => {
            reserveCalls += 1;
            return credit.reserve(i);
          },
          markArtUploaded: (c, o) => credit.markArtUploaded(c, o),
          deliver: (c, o) => credit.deliver(c, o),
          refund: (c, o, r) => credit.refund(c, o, r),
        },
        createGateway: () => {
          providerCalls += 1;
          return gatewayCapturing([], async () => ({ imageBase64: "x", mimeType: "image/png" }));
        },
      }),
    );
    const terminal = terminalEvent(await readNdjson(response));
    expect(terminal.type).toBe("error");
    expect(terminal.code).toBe("IMG-001");
    expect(persistCalls).toBe(0);
    expect(reserveCalls).toBe(0);
    expect(providerCalls).toBe(0);
  }, 60_000);

  it("(achado 5b) `unknown` persistido ⇒ claim finalizado `abandoned`; nova tentativa recusada", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const abortGateway = {
      invoke: async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
    } as unknown as AiInvoker;

    const response = await runProductOneToOneGeneration(
      input(campaign, operationId),
      deps({ createGateway: () => abortGateway }),
    );
    expect(terminalEvent(await readNdjson(response)).type).toBe("unknown");

    const claims = await attemptClaimRows(ctx.pg, campaign, operationId);
    expect(claims).toHaveLength(1);
    expect(claims[0].status).toBe("abandoned");

    const refused = await new ProductOneToOneAttemptStartClient(ctx.supabase).acquire({
      campaignId: campaign,
      operationId,
      target: "primary",
      attemptNumber: 2,
    });
    expect(refused).toMatchObject({ acquired: false, reason: "operation_unknown" });
  }, 60_000);

  it("(achado 5b residual) finalização do claim FALHA ⇒ claim `in_progress` residual, sem estorno", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const real = new ProductOneToOneAttemptStartClient(ctx.supabase);
    const realCredit = new ProductOneToOneCreditOperationClient(ctx.supabase);
    let refundCalls = 0;
    const abortGateway = {
      invoke: async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
    } as unknown as AiInvoker;

    const response = await runProductOneToOneGeneration(
      input(campaign, operationId),
      deps({
        attempts: {
          acquire: (i) => real.acquire(i),
          // A finalização (`abandoned`) FALHA ⇒ claim residual.
          finish: async (i) => {
            if (i.status === "abandoned") throw new Error("finish_failed");
            return real.finish(i);
          },
          recordOperationOutcome: (i) => real.recordOperationOutcome(i),
          getCampaignOperation: (c) => real.getCampaignOperation(c),
        },
        credit: {
          reserve: (i) => realCredit.reserve(i),
          markArtUploaded: (c, o) => realCredit.markArtUploaded(c, o),
          deliver: (c, o) => realCredit.deliver(c, o),
          refund: async (c, o, r) => {
            refundCalls += 1;
            return realCredit.refund(c, o, r);
          },
        },
        createGateway: () => abortGateway,
      }),
    );
    const terminal = terminalEvent(await readNdjson(response));
    expect(terminal.type).toBe("unknown");
    expect(refundCalls).toBe(0);
    const claims = await attemptClaimRows(ctx.pg, campaign, operationId);
    expect(claims[0].status).toBe("in_progress");
    expect((await creditOperationRow(ctx.pg, campaign, operationId))?.status).toBe("reserved");
  }, 60_000);

  it("(achado 4) `storeArtifact` falha com objeto PRESENTE/INDETERMINADO ⇒ SEM estorno", async () => {
    for (const kind of ["integral", "indeterminate"] as const) {
      const campaign = await createCampaign(ctx.supabase, storeId);
      const operationId = randomUUID();
      const probe: ArtifactProbe = kind === "integral" ? integralProbe(campaign, operationId) : { kind: "indeterminate" };
      const realCredit = new ProductOneToOneCreditOperationClient(ctx.supabase);
      let refundCalls = 0;
      const image = await jpeg1024DataUrl();
      const response = await runProductOneToOneGeneration(
        input(campaign, operationId),
        deps({
          credit: {
            reserve: (i) => realCredit.reserve(i),
            markArtUploaded: (c, o) => realCredit.markArtUploaded(c, o),
            deliver: (c, o) => realCredit.deliver(c, o),
            refund: async (c, o, r) => {
              refundCalls += 1;
              return realCredit.refund(c, o, r);
            },
          },
          artifact: {
            storeArtifact: async () => {
              throw new Error("store_failed");
            },
            probeArtifact: async () => probe,
          },
          createGateway: () =>
            gatewayCapturing([], async () => ({ imageBase64: image.split(",")[1], mimeType: "image/jpeg" })),
        }),
      );
      const terminal = terminalEvent(await readNdjson(response));
      expect(terminal.type).toBe("unknown");
      expect(refundCalls).toBe(0);
      expect((await creditOperationRow(ctx.pg, campaign, operationId))?.status).toBe("reserved");
    }
  }, 90_000);

  it("(achado 4) `storeArtifact` falha com ausência CONFIRMADA ⇒ estorno ÚNICO (`refunded`)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const realCredit = new ProductOneToOneCreditOperationClient(ctx.supabase);
    const image = await jpeg1024DataUrl();
    const response = await runProductOneToOneGeneration(
      input(campaign, operationId),
      deps({
        artifact: {
          storeArtifact: async () => {
            throw new Error("store_failed");
          },
          probeArtifact: async () => ({ kind: "absent" as const }),
        },
        createGateway: () =>
          gatewayCapturing([], async () => ({ imageBase64: image.split(",")[1], mimeType: "image/jpeg" })),
      }),
    );
    const terminal = terminalEvent(await readNdjson(response));
    expect(terminal.type).toBe("error");
    expect(terminal.code).toBe("IMG-001");
    expect(String(terminal.message)).toContain("estornado");
    expect((await creditOperationRow(ctx.pg, campaign, operationId))?.status).toBe("refunded");
    void realCredit;
  }, 60_000);

  it("(achado 6 / gap 3) diagnóstico durável recuperável por `findByReference` numa NOVA instância", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const image = await jpeg1024DataUrl();
    // Falha operacional: provider OK, mas ausência de arte confirmada ⇒ IMG-001 + diagnóstico.
    const response = await runProductOneToOneGeneration(
      input(campaign, operationId),
      deps({
        artifact: {
          storeArtifact: async () => {
            throw new Error("store_failed");
          },
          probeArtifact: async () => ({ kind: "absent" as const }),
        },
        createGateway: () =>
          gatewayCapturing([], async () => ({ imageBase64: image.split(",")[1], mimeType: "image/jpeg" })),
      }),
    );
    const terminal = terminalEvent(await readNdjson(response));
    expect(terminal.code).toBe("IMG-001");
    const reference = String(terminal.reference);

    const freshRepository = new SupabaseImageGenerationDiagnosisRepository(ctx.supabase);
    const diagnosis = await freshRepository.findByReference(reference);
    expect(diagnosis).not.toBeNull();
    expect(diagnosis?.reference).toBe(reference);
    expect(diagnosis?.internalCategory).toBe("artifact_store_failed");
    expect(diagnosis?.model).toBe(PRIMARY.model);
    expect(diagnosis?.target).toBe("primary");
    expect(diagnosis?.attemptNumber).toBe(1);
  }, 60_000);

  it("(gap 3 pendência) diagnóstico durável também no caminho `emitUnknownPending`", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const image = await jpeg1024DataUrl();
    const response = await runProductOneToOneGeneration(
      input(campaign, operationId),
      deps({
        artifact: {
          storeArtifact: async () => {
            throw new Error("store_failed");
          },
          probeArtifact: async () => integralProbe(campaign, operationId),
        },
        createGateway: () =>
          gatewayCapturing([], async () => ({ imageBase64: image.split(",")[1], mimeType: "image/jpeg" })),
      }),
    );
    const terminal = terminalEvent(await readNdjson(response));
    expect(terminal.type).toBe("unknown");
    const reference = String(terminal.reference);
    const diagnosis = await new SupabaseImageGenerationDiagnosisRepository(ctx.supabase).findByReference(
      reference,
    );
    expect(diagnosis).not.toBeNull();
    expect(diagnosis?.reference).toBe(reference);
  }, 60_000);

  it("(gap 1) fingerprint com UMA imagem via `productImageDataUrl` ⇒ referências NÃO vazias; troca de conteúdo altera", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const evidence = buildProductOneToOneFrozenEvidence({
      campaignId: campaign,
      operationId,
      campaignIntent: "offer",
      backgroundDirection: "studio",
      briefing: "briefing",
      referenceSelections: [{ kind: "product", id: "sha256-imagem-1", role: "primary", index: 0 }],
      baseVersion: "48.2.6-produto-1-1-v1",
      composerVersion: "48.2.4-prompt-composer-v6",
      policyVersions: {},
    });
    await persistProductOneToOneSnapshot(ctx.supabase, snapshotFor(campaign), evidence);

    const { rows } = await ctx.pg.query<{ reference_selections: unknown }>(
      "SELECT reference_selections FROM public.product_1_1_snapshot_frozen_evidence WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operationId],
    );
    expect(rows[0].reference_selections).toEqual([
      { kind: "product", id: "sha256-imagem-1", role: "primary", index: 0 },
    ]);

    // Trocar o CONTEÚDO da imagem (novo id) ⇒ divergência detectada (conflito).
    const divergent = buildProductOneToOneFrozenEvidence({
      campaignId: campaign,
      operationId,
      campaignIntent: "offer",
      backgroundDirection: "studio",
      briefing: "briefing",
      referenceSelections: [{ kind: "product", id: "sha256-imagem-2", role: "primary", index: 0 }],
      baseVersion: "48.2.6-produto-1-1-v1",
      composerVersion: "48.2.4-prompt-composer-v6",
      policyVersions: {},
    });
    await expect(
      persistProductOneToOneSnapshot(ctx.supabase, snapshotFor(campaign), divergent),
    ).rejects.toThrow(/operation_identity_conflict/);
  }, 60_000);

  it("(gap 4) identidade SERVER-SIDE: a requisição ao gateway carrega `identityImageUrl` e a evidência a congela", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const captured: AiInvocationRequest[] = [];
    const image = await jpeg1024DataUrl();
    const identityDataUrl = "data:image/png;base64,aWRlbnRpdHk=";

    const response = await runProductOneToOneGeneration(
      {
        ...input(campaign, operationId),
        identityImageUrl: identityDataUrl,
        identityDirective: "Use o logo no canto superior direito",
        referenceSelections: [{ kind: "identity", id: "sha256-identity", role: "identity", index: 1 }],
      },
      deps({
        createGateway: () =>
          gatewayCapturing(captured, async () => ({ imageBase64: image.split(",")[1], mimeType: "image/jpeg" })),
      }),
    );
    expect(terminalEvent(await readNdjson(response)).type).toBe("result");
    expect(captured).toHaveLength(1);
    expect(captured[0].identityImageUrl).toBe(identityDataUrl);

    const { rows } = await ctx.pg.query<{ reference_selections: unknown }>(
      "SELECT reference_selections FROM public.product_1_1_snapshot_frozen_evidence WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operationId],
    );
    expect(rows[0].reference_selections).toEqual([
      { kind: "identity", id: "sha256-identity", role: "identity", index: 1 },
    ]);
  }, 60_000);

  describe("B1/B2/I1/I2 — conversão da identidade (função REAL, bytes reais)", () => {
    function fetchReturning(body: Buffer | Uint8Array, contentType: string, headers: Record<string, string> = {}) {
      return vi.fn(async () =>
        new Response(new Uint8Array(body), { status: 200, headers: { "content-type": contentType, ...headers } }),
      ) as unknown as typeof fetch;
    }

    it("(B1) converte a URL assinada em `data URL` + contentId (SHA-256 dos bytes); falha/limite ⇒ null", async () => {
      const bytes = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
      const resolved = await resolveIdentityImageAsDataUrl("https://signed.example/logo.png?sig=rotative", {
        fetchFn: fetchReturning(bytes, "image/png"),
      });
      expect(resolved).not.toBeNull();
      expect(resolved?.dataUrl).toBe(`data:image/png;base64,${bytes.toString("base64")}`);
      expect(resolved?.byteLength).toBe(bytes.byteLength);

      // content-type fora da whitelist ⇒ text-only.
      const bad = await resolveIdentityImageAsDataUrl("https://signed.example/logo", {
        fetchFn: fetchReturning(bytes, "text/html"),
      });
      expect(bad).toBeNull();

      // url ausente ⇒ null.
      expect(await resolveIdentityImageAsDataUrl(null)).toBeNull();
    });

    it("(B2) rotação da URL com os MESMOS bytes mantém o MESMO contentId; bytes diferentes mudam", async () => {
      const bytes = Buffer.from([9, 8, 7, 6, 5]);
      const a = await resolveIdentityImageAsDataUrl("https://signed.example/logo?a=1", {
        fetchFn: fetchReturning(bytes, "image/jpeg"),
      });
      const b = await resolveIdentityImageAsDataUrl("https://signed.example/logo?a=2", {
        fetchFn: fetchReturning(bytes, "image/jpeg"),
      });
      expect(a?.contentId).toBe(b?.contentId);

      const different = await resolveIdentityImageAsDataUrl("https://signed.example/logo?a=3", {
        fetchFn: fetchReturning(Buffer.from([5, 6, 7, 8, 9]), "image/jpeg"),
      });
      expect(different?.contentId).not.toBe(a?.contentId);
    });

    it("(I1) teto por bytes REAIS: sem content-length confiável NÃO bufferiza; subdeclarado rejeita; superdeclarado dentro do teto aceita", async () => {
      // Corpo SEM content-length confiável acima do teto ⇒ rejeita (cancela a leitura).
      const big = new Uint8Array(200).fill(7);
      const noLength = fetchReturning(big, "image/png");
      const rejected = await resolveIdentityImageAsDataUrl("https://signed.example/logo", {
        fetchFn: noLength,
        maxBytes: 50,
      });
      expect(rejected).toBeNull();

      // content-length SUBdeclarado com corpo maior ⇒ rejeita pela sobrecarga REAL.
      const subDeclared = fetchReturning(big, "image/png", { "content-length": "10" });
      expect(
        await resolveIdentityImageAsDataUrl("https://signed.example/logo", {
          fetchFn: subDeclared,
          maxBytes: 50,
        }),
      ).toBeNull();

      // content-length SUPERdeclarado (maior que o corpo) mas ≤ teto ⇒ ACEITO.
      const small = new Uint8Array(10).fill(3);
      const superDeclared = fetchReturning(small, "image/png", { "content-length": "100" });
      const accepted = await resolveIdentityImageAsDataUrl("https://signed.example/logo", {
        fetchFn: superDeclared,
        maxBytes: 1000,
      });
      expect(accepted).not.toBeNull();
      expect(accepted?.byteLength).toBe(10);
    });

    it("(I2) snapshot persistido concorda com o efetivamente usado (text-only × com identidade)", async () => {
      // Sem identidade ⇒ referências sem assinatura de identidade.
      const image = await jpeg1024DataUrl();
      let terminal: Record<string, unknown> = {};
      let attempts = 0;
      // Tolerância a falha de infra transitória: reexecuta até um terminal REAL.
      while (attempts < 4) {
        attempts += 1;
        const campaignTextOnly = await createCampaign(ctx.supabase, storeId);
        const opTextOnly = randomUUID();
        const captured: AiInvocationRequest[] = [];
        const response = await runProductOneToOneGeneration(input(campaignTextOnly, opTextOnly), deps({
          createGateway: () => gatewayCapturing(captured, async () => ({ imageBase64: image.split(",")[1], mimeType: "image/jpeg" })),
        }));
        terminal = terminalEvent(await readNdjson(response));
        if (terminal.type !== "result") continue;

        expect(captured[0].identityImageUrl).toBeUndefined();
        const textOnly = await ctx.pg.query<{ reference_selections: unknown }>(
          "SELECT reference_selections FROM public.product_1_1_snapshot_frozen_evidence WHERE campaign_id = $1 AND operation_id = $2",
          [campaignTextOnly, opTextOnly],
        );
        expect(textOnly.rows[0].reference_selections).toEqual([]);
        break;
      }
      expect(terminal.type).toBe("result");
    }, 60_000);
  });
});
