// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { NextRequest } from "next/server";

/**
 * F56.2b1b — Plano 09 (complemento C4): prova REAL, CONCORRENTE e ATRAVÉS DA ROTA
 * (`src/app/api/campaign/generate-image/route.ts`) de que DUAS submissões
 * COMPLETAS simultâneas com a MESMA identidade (`campaignId` + `operationId`) ⇒
 * EXATAMENTE UMA campanha, UM snapshot/evidência e UMA dedução (`deductionCount
 * === 1`). O provider é SIMULADO; Postgres/Storage são REAIS (instância isolada).
 *
 * A rota é quem CRIA a campanha (idempotente por `campaignId`), faz o curto-
 * circuito `operação existe ⇒ consulta`, conduz o preflight/`acquire`/reserva do
 * crédito e delega ao ORQUESTRADOR REAL. Apenas os serviços EXTERNOS (auth,
 * identidade, legal, readiness, rate-limit, custo de operação, provider, copy,
 * telemetria) são mockados; o crédito/tentativa/artefato/snapshot/persistência
 * falam com o Postgres/Storage da instância isolada.
 */

const h = vi.hoisted(() => ({
  admin: {} as Record<string, unknown>,
  jpegBase64: "" as string,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get: (_target, prop) => {
        const inner = h.admin as Record<string | symbol, unknown>;
        const value = inner[prop];
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(inner)
          : value;
      },
    },
  ),
  createServerClient: vi.fn(),
}));

// ── Auth / CSRF (mockados) ───────────────────────────────────────────────────
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn(() => {}) }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => ({ userId: "00000000-0000-4000-8000-0000000000aa" })),
  requireUser: vi.fn(async () => ({ userId: "00000000-0000-4000-8000-0000000000aa" })),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async () => ({ id: "store" })),
  getCurrentStore: vi.fn(),
  requireAuthorizedStore: vi.fn(),
}));

// ── Feature flags / launch config (mockados) ─────────────────────────────────
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isForceBriefVisionCheckEnabled: vi.fn(async () => false),
  isCampaignApprovalEnabled: vi.fn(async () => false),
  FORCE_BRIEF_VISION_CHECK_KEY: "force_brief_vision_check",
  FeatureFlagService: vi.fn(),
}));
vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: () => ({
    v15Enabled: true,
    creditsChargingEnabled: false,
    copyDirectorEnabled: false,
    rateLimitEnabled: false,
    generationPaused: false,
    monthlyCreditsEnabled: false,
    monthlyCreditsAmount: 0,
    monthlyBonusCap: 0,
    monthlyCreditsMinStoreAgeDays: 30,
    publicSignupEnabled: false,
    demoCreditsEnabled: false,
    demoCreditsAmount: 0,
    demoCreditsTtlHours: 0,
    emailEnabled: false,
  }),
}));

// ── Guardas pré-reserva da rota (mockadas) ───────────────────────────────────
vi.mock("@/lib/legal/clearance", () => ({
  requireLegalClearance: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/store-readiness", () => ({
  getStoreReadiness: vi.fn(async () => ({ ready: true, missing: [] })),
}));
vi.mock("@/lib/rate-limit/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: {}, resetTime: null })),
  recordGenerationAttempt: vi.fn(async () => undefined),
}));
vi.mock("@/lib/credit/operation-cost-service", () => ({
  OperationCostService: vi.fn(function OperationCostService() {
    return {
      getCost: vi.fn(async () => ({
        operationKey: "campaign_generation",
        costCredits: 1,
        enabled: true,
        source: "table",
      })),
    };
  }),
  OperationCostUnavailableError: class OperationCostUnavailableError extends Error {},
  DEFAULT_OPERATION_COSTS: {},
}));
vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: vi.fn(function CreditService() {
    return {
      getBalance: vi.fn(async () => 100),
      reserveCredit: vi.fn(),
      confirmCredit: vi.fn(),
      refundCredit: vi.fn(),
      getOriginDemoGrantTxId: vi.fn(async () => null),
      getBalanceBreakdown: vi.fn(),
    };
  }),
}));
vi.mock("@/lib/image-generation/services/input-validation-service", () => ({
  InputValidationService: vi.fn(function InputValidationService() {
    return { validate: vi.fn(async () => ({ classification: "ok" })) };
  }),
}));
vi.mock("@/lib/image-generation/services/image-generation-service", () => ({
  ImageGenerationService: vi.fn(function ImageGenerationService() {
    return {
      generateImage: vi.fn(),
      validatePrompts: vi.fn(() => ({ valid: true, errors: [] })),
    };
  }),
}));
vi.mock("@/lib/image-generation/providers/factory", () => ({
  createImageProvider: vi.fn(() => ({ name: "test" })),
}));

// ── Identidade resolvida server-side (mockada) ───────────────────────────────
vi.mock("@/lib/store-identity-service", () => ({
  resolveStoreIdentity: vi.fn(async () => ({
    storeName: "Loja Teste",
    storeSegment: "outros",
    brandColor: "#000000",
    identityState: "text_only",
    signature: { url: null, type: null },
  })),
  validateIdentityReference: vi.fn(async (snapshot: unknown) => snapshot),
  buildCampaignBrief: vi.fn(async () => ({
    store: { name: "Loja Teste", segment: "outros" },
    identity: { state: "text_only", imageUrl: null, directive: null },
  })),
}));
vi.mock("@/lib/store-identity/identity-image", () => ({
  resolveIdentityImageAsDataUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/economic/economic-parameter-service", () => ({
  EconomicParameterService: vi.fn(function EconomicParameterService() {
    return { getParameter: vi.fn(async (key: string) => ({ key, value: 1, source: "table" })) };
  }),
}));
vi.mock("@/lib/product-events/service", () => ({
  ProductEventService: vi.fn(function ProductEventService() {
    return { record: vi.fn(async () => undefined) };
  }),
}));

// ── Telemetria / custo (mockados: o provider é SIMULADO) ─────────────────────
vi.mock("@/lib/ai-cost", () => ({
  AiCostTracker: class AiCostTracker {
    startRun() {
      return {
        operationRunId: globalThis.crypto.randomUUID(),
        traceId: globalThis.crypto.randomUUID(),
      };
    }
    async record() {}
  },
  resolveAiCost: vi.fn(),
  estimateAiCost: vi.fn(),
}));
vi.mock("@/lib/ai/telemetry-sink", () => ({
  createDefaultTelemetryContext: vi.fn(() => ({ sink: { emit: async () => {} } })),
  withOnCallTelemetry: vi.fn((ctx: unknown) => ctx),
}));
vi.mock("@/lib/ai", () => ({
  createDefaultTelemetryContext: vi.fn(() => ({ sink: { emit: async () => {} } })),
  defaultAiGateway: { invoke: vi.fn() },
  CAPABILITY_GENERATION_TYPE: {},
}));
vi.mock("@/lib/ai-cost/image-pair-pricing", () => ({
  resolveImagePairCost: vi.fn(async () => ({
    primary: { costUsd: null, versionId: null, costSource: null },
    fallback: { costUsd: null, versionId: null, costSource: null },
  })),
  ImagePairPricingService: vi.fn(),
}));
vi.mock("@/lib/copy/copy-director-service", () => ({
  CopyDirectorService: vi.fn(function CopyDirectorService() {
    return { generateCopy: vi.fn(), hasFallback: vi.fn(async () => true) };
  }),
}));

// ── Autorização/elegibilidade do novo fluxo (mockadas) ───────────────────────
vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: vi.fn((store: unknown) => store),
}));

// ── Provider SIMULADO (o par REAL é resolvido pelo preflight mockado) ────────
vi.mock("@/lib/ai/upstream-images-runtime", () => ({
  createNewFlowImageGateway: vi.fn(() => ({
    invoke: vi.fn(async () => ({ imageBase64: h.jpegBase64, mimeType: "image/jpeg" })),
    hasFallback: vi.fn(async () => true),
  })),
}));
vi.mock("@/lib/product-1-1/orchestration/preflight", () => ({
  runNewFlowPreflight: vi.fn(async () => ({
    config: {
      primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
      fallback: { model: "gpt-image-2", quality: "medium" },
      origin: "selection",
      configVersionId: "55555555-5555-4555-8555-555555555555",
    },
    pricing: { status: "complete" },
  })),
  NewFlowPreflightError: class NewFlowPreflightError extends Error {},
}));

import {
  closeIsolatedContext,
  createIsolatedContext,
  createTestStore,
  deductionCount,
  pgRows,
  setCredits,
  type IsolatedContext,
} from "./integration-harness";

let ctx: IsolatedContext;

describe("F56.2b1b — submissão CONCORRENTE através da ROTA REAL (Postgres/Storage real)", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    h.admin = ctx.supabase as unknown as Record<string, unknown>;
    const jpeg = await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    h.jpegBase64 = jpeg.toString("base64");
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  it("C4 — DUAS submissões COMPLETAS e SIMULTÂNEAS com a MESMA identidade ⇒ UMA campanha, UM snapshot/evidência e UMA dedução", async () => {
    // Store dedicada à prova: `deductionCount` conta SOMENTE as deduções desta.
    const store = await createTestStore(ctx.supabase);
    await setCredits(ctx.pg, store.storeId, 30);

    const campaignId = randomUUID();
    const operationId = randomUUID();
    const body = {
      storeId: store.storeId,
      productName: "Produto concorrente",
      originalPriceCents: 2990,
      discountedPriceCents: 1990,
      campaignIntent: "offer",
      backgroundDirection: "studio",
      campaignId,
      operationId,
      productImages: [
        {
          role: "primary",
          source: "upload",
          mimeType: "image/jpeg",
          dataUrl: "data:image/jpeg;base64,AAAA",
        },
      ],
    };
    const makeRequest = () =>
      new NextRequest("http://localhost/api/campaign/generate-image", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });

    const { POST } = await import("@/app/api/campaign/generate-image/route");

    // DUAS submissões COMPLETAS em paralelo, mesma identidade.
    const [first, second] = await Promise.all([POST(makeRequest()), POST(makeRequest())]);
    // O reuso idempotente da corrida de criação NÃO devolve conflito FALSO.
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const parseTerminal = (text: string): Record<string, unknown> | null => {
      const events = text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      return (
        events.filter((e) => ["result", "error", "unknown"].includes(String(e.type))).at(-1) ?? null
      );
    };
    const terminals = [await first.text(), await second.text()]
      .map(parseTerminal)
      .filter((terminal): terminal is Record<string, unknown> => terminal !== null);
    // Ao menos uma submissão ENTREGOU; nenhuma duplicou a operação.
    expect(terminals.some((terminal) => terminal.type === "result")).toBe(true);

    // UMA campanha (idempotente por `campaignId`).
    const campaigns = await pgRows<{ n: number }>(
      ctx.pg,
      "SELECT count(*)::int AS n FROM public.campaigns WHERE id = $1",
      [campaignId],
    );
    expect(campaigns[0].n).toBe(1);

    // UM snapshot + UMA evidência congelada.
    const snapshots = await pgRows<{ n: number }>(
      ctx.pg,
      "SELECT count(*)::int AS n FROM public.image_generation_config_snapshots WHERE campaign_id = $1",
      [campaignId],
    );
    expect(snapshots[0].n).toBe(1);
    const evidences = await pgRows<{ n: number }>(
      ctx.pg,
      "SELECT count(*)::int AS n FROM public.product_1_1_snapshot_frozen_evidence WHERE campaign_id = $1",
      [campaignId],
    );
    expect(evidences[0].n).toBe(1);

    // UMA operação de crédito e EXATAMENTE UMA dedução.
    const creditOps = await pgRows<{ n: number }>(
      ctx.pg,
      "SELECT count(*)::int AS n FROM public.product_1_1_campaign_credit_operations WHERE campaign_id = $1 AND operation_id = $2",
      [campaignId, operationId],
    );
    expect(creditOps[0].n).toBe(1);
    expect(await deductionCount(ctx.pg, store.storeId)).toBe(1);
  }, 120_000);
});
