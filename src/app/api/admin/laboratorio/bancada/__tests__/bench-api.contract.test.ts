import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const {
  mockRequireAdmin,
  mockAssertLabEnvironment,
  MockLabEnvironmentError,
  mockListBenchTestStores,
  mockAssertBenchTestStore,
  MockBenchStoreManifestError,
  mockLoadBenchBranding,
  mockToBenchBrandingSnapshot,
  mockCreateBenchBrandingSignedUrlForStore,
  mockListBenchPresets,
  mockResolveBenchPreset,
  MockBenchPresetError,
  mockListBenchConfigOptions,
  mockResolveBenchConfig,
  mockResolveBenchCost,
  mockBuildBenchCampaignSnapshot,
  mockBuildBenchExperimentalBriefing,
  mockComposePromptBlocks,
  mockResolveBenchPromptPolicies,
  MockBenchPromptPolicyError,
  mockResolveBenchDefaultPromptBase,
  MockBenchPromptBaseError,
  mockBuildBrandingPromptContributions,
  mockBuildIdentityDirectionContributions,
  mockRecomposeBenchPrompt,
  MockBenchPreflightRevalidationError,
  mockAssertPreflightCompositionMatches,
  mockAssertPreflightEvidenceMatches,
  mockResolveServerResolvedEvidence,
  mockResolveBenchIdentityImageDataUrl,
  MockBenchIdentityTransportError,
  mockListBenchRunLineagesByStore,
  mockReserveBenchRun,
  mockGetBenchRunByOperationId,
  mockSetBenchRunInput,
  mockConfirmBenchRun,
  mockFinalizeBenchRun,
  mockGetBenchRun,
  MockBenchRunError,
  mockPersistBenchArtifact,
  mockListBenchArtifacts,
  mockCreateBenchArtifactSignedUrl,
  mockExecuteBenchRun,
  mockValidateArtifactTechnically,
  mockCreateLabTelemetryContext,
  mockSupabaseAdmin,
} = vi.hoisted(() => {
  class MockLabEnvironmentError extends Error {
    readonly reason: string;
    constructor(reason: string) {
      super(`Laboratório bloqueado: ${reason}`);
      this.name = "LabEnvironmentError";
      this.reason = reason;
    }
  }

  class MockBenchStoreManifestError extends Error {
    readonly code: string;
    readonly storeId: string;
    constructor(code: string, storeId: string) {
      super(`${code}:${storeId}`);
      this.name = "BenchStoreManifestError";
      this.code = code;
      this.storeId = storeId;
    }
  }

  class MockBenchPresetError extends Error {
    readonly code = "preset_not_enabled";
    readonly reason?: string;
    constructor(_presetId: string, reason?: string) {
      super(`preset_not_enabled:${reason ?? ""}`);
      this.name = "BenchPresetError";
      this.reason = reason;
    }
  }

  class MockBenchRunError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.name = "BenchRunError";
      this.code = code;
    }
  }

  class MockBenchPromptPolicyError extends Error {
    readonly code = "bench_policy_not_implemented";
    readonly dimension: string;
    readonly value: string;
    constructor(params: { dimension: string; value: string }) {
      super(`bench_policy_not_implemented:${params.dimension}=${params.value}`);
      this.name = "BenchPromptPolicyError";
      this.dimension = params.dimension;
      this.value = params.value;
    }
  }

  class MockBenchPromptBaseError extends Error {
    readonly code = "bench_prompt_base_not_found";
    constructor(signature: string) {
      super(`bench_prompt_base_not_found:${signature}`);
      this.name = "BenchPromptBaseError";
    }
  }

  class MockBenchPreflightRevalidationError extends Error {
    readonly code = "approval_invalidated";
    readonly reason: string;
    constructor(reason: string) {
      super(`approval_invalidated:${reason}`);
      this.name = "BenchPreflightRevalidationError";
      this.code = "approval_invalidated";
      this.reason = reason;
    }
  }

  class MockBenchIdentityTransportError extends Error {
    readonly code: string;
    constructor(code: string, detail: string) {
      super(`${code}:${detail}`);
      this.name = "BenchIdentityTransportError";
      this.code = code;
    }
  }

  return {
    mockRequireAdmin: vi.fn(),
    mockAssertLabEnvironment: vi.fn(),
    MockLabEnvironmentError,
    mockListBenchTestStores: vi.fn(),
    mockAssertBenchTestStore: vi.fn(),
    MockBenchStoreManifestError,
    mockLoadBenchBranding: vi.fn(),
    mockToBenchBrandingSnapshot: vi.fn(),
    mockCreateBenchBrandingSignedUrlForStore: vi.fn(),
    mockListBenchPresets: vi.fn(),
    mockResolveBenchPreset: vi.fn(),
    MockBenchPresetError,
    mockListBenchConfigOptions: vi.fn(),
    mockResolveBenchConfig: vi.fn(),
    mockResolveBenchCost: vi.fn(),
    mockBuildBenchCampaignSnapshot: vi.fn(),
    mockBuildBenchExperimentalBriefing: vi.fn(),
    mockComposePromptBlocks: vi.fn(),
    mockResolveBenchPromptPolicies: vi.fn(),
    MockBenchPromptPolicyError,
    mockResolveBenchDefaultPromptBase: vi.fn(),
    MockBenchPromptBaseError,
    mockBuildBrandingPromptContributions: vi.fn(),
    mockBuildIdentityDirectionContributions: vi.fn(),
    mockRecomposeBenchPrompt: vi.fn(),
    MockBenchPreflightRevalidationError,
    mockAssertPreflightCompositionMatches: vi.fn(),
    mockAssertPreflightEvidenceMatches: vi.fn(),
    mockResolveServerResolvedEvidence: vi.fn(),
    mockResolveBenchIdentityImageDataUrl: vi.fn(),
    MockBenchIdentityTransportError,
    mockListBenchRunLineagesByStore: vi.fn(),
    mockReserveBenchRun: vi.fn(),
    mockGetBenchRunByOperationId: vi.fn(),
    mockSetBenchRunInput: vi.fn(),
    mockConfirmBenchRun: vi.fn(),
    mockFinalizeBenchRun: vi.fn(),
    mockGetBenchRun: vi.fn(),
    MockBenchRunError,
    mockPersistBenchArtifact: vi.fn(),
    mockListBenchArtifacts: vi.fn(),
    mockCreateBenchArtifactSignedUrl: vi.fn(),
    mockExecuteBenchRun: vi.fn(),
    mockValidateArtifactTechnically: vi.fn(),
    mockCreateLabTelemetryContext: vi.fn(),
    mockSupabaseAdmin: {
      from: vi.fn(),
      storage: {
        from: () => ({
          download: async () => ({
            data: {
              arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
            },
            error: null,
          }),
        }),
      },
    },
  };
});

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/lab/environment-guard", () => ({
  LabEnvironmentError: MockLabEnvironmentError,
  assertLabEnvironment: () => mockAssertLabEnvironment(),
  labEnvironmentDeniedBody: (reason: string) => ({ error: "environment_blocked", reason }),
  getLabEnvironment: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

vi.mock("@/lib/lab/persistence/artifact-service", () => ({
  LAB_ARTIFACT_BUCKET: "lab-artifacts",
  LAB_ALLOWED_ARTIFACT_MIME_TYPES: ["image/png", "image/jpeg", "image/webp"],
}));

vi.mock("@/lib/lab/bench/domain/store-manifest", () => ({
  listBenchTestStores: (...args: unknown[]) => mockListBenchTestStores(...args),
  assertBenchTestStore: (...args: unknown[]) => mockAssertBenchTestStore(...args),
  BenchStoreManifestError: MockBenchStoreManifestError,
}));

vi.mock("@/lib/lab/bench/domain/branding-service", () => ({
  loadBenchBranding: (...args: unknown[]) => mockLoadBenchBranding(...args),
  toBenchBrandingSnapshot: (contract: unknown) => mockToBenchBrandingSnapshot(contract),
}));

vi.mock("@/lib/lab/bench/persistence/bench-branding-signer", () => ({
  createBenchBrandingSignedUrlForStore: (...args: unknown[]) =>
    mockCreateBenchBrandingSignedUrlForStore(...args),
}));

vi.mock("@/lib/lab/bench/domain/preset-registry", () => ({
  listBenchPresets: () => mockListBenchPresets(),
  resolveBenchPreset: (...args: unknown[]) => mockResolveBenchPreset(...args),
  BenchPresetError: MockBenchPresetError,
}));

vi.mock("@/lib/lab/bench/domain/config-registry", () => ({
  DEFAULT_BENCH_CONFIG: {
    pipeline: "manual-direto",
    formato: "1:1",
    intencao: "oferta",
    tipoConteudo: "produto",
    estrutura: "peca-unica",
    tema: "nenhum",
  },
  BENCH_REGISTRY_DIMENSIONS: [
    "pipeline",
    "formato",
    "intencao",
    "tipoConteudo",
    "estrutura",
    "tema",
  ],
  listBenchConfigOptions: (...args: unknown[]) => mockListBenchConfigOptions(...args),
  resolveBenchConfig: (...args: unknown[]) => mockResolveBenchConfig(...args),
}));

vi.mock("@/lib/lab/bench/execution/bench-cost-resolver", () => ({
  resolveBenchCost: (...args: unknown[]) => mockResolveBenchCost(...args),
}));

vi.mock("@/lib/lab/bench/domain/campaign-snapshot", () => ({
  buildBenchCampaignSnapshot: (...args: unknown[]) => mockBuildBenchCampaignSnapshot(...args),
}));

vi.mock("@/lib/lab/bench/domain/experimental-briefing", () => ({
  buildBenchExperimentalBriefing: (...args: unknown[]) =>
    mockBuildBenchExperimentalBriefing(...args),
}));

vi.mock("@/lib/lab/bench/domain/prompt-composer", () => ({
  COMPOSER_VERSION: "test-composer-v1",
  composePromptBlocks: (...args: unknown[]) => mockComposePromptBlocks(...args),
  composePrompt: (...args: unknown[]) => mockComposePromptBlocks(...args).text,
}));

vi.mock("@/lib/lab/bench/domain/policies/resolve-bench-prompt-policies", () => ({
  resolveBenchPromptPolicies: (...args: unknown[]) => mockResolveBenchPromptPolicies(...args),
  BenchPromptPolicyError: MockBenchPromptPolicyError,
}));

vi.mock("@/lib/lab/bench/domain/prompt-base", () => ({
  resolveBenchDefaultPromptBase: (...args: unknown[]) =>
    mockResolveBenchDefaultPromptBase(...args),
  BenchPromptBaseError: MockBenchPromptBaseError,
  BENCH_DEFAULT_PROMPT_BASE_VERSION: "test-prompt-base-v1",
  BENCH_DEFAULT_PROMPT_BASE: {
    version: "test-prompt-base-v1",
    content: "instruções complementares padrão",
  },
}));

vi.mock("@/lib/lab/bench/domain/branding-prompt-mapping", () => ({
  buildBrandingPromptContributions: (...args: unknown[]) =>
    mockBuildBrandingPromptContributions(...args),
}));

vi.mock("@/lib/lab/bench/domain/identity-direction", () => ({
  buildIdentityDirectionContributions: (...args: unknown[]) =>
    mockBuildIdentityDirectionContributions(...args),
}));

vi.mock("@/lib/lab/bench/domain/preflight-revalidation", () => ({
  recomposeBenchPrompt: (...args: unknown[]) => mockRecomposeBenchPrompt(...args),
  assertPreflightCompositionMatches: (...args: unknown[]) =>
    mockAssertPreflightCompositionMatches(...args),
  assertPreflightEvidenceMatches: (...args: unknown[]) =>
    mockAssertPreflightEvidenceMatches(...args),
  resolveServerResolvedEvidence: (...args: unknown[]) => mockResolveServerResolvedEvidence(...args),
  BenchPreflightRevalidationError: MockBenchPreflightRevalidationError,
}));

vi.mock("@/lib/lab/bench/execution/bench-identity-transport", () => ({
  resolveBenchIdentityImageDataUrl: (...args: unknown[]) =>
    mockResolveBenchIdentityImageDataUrl(...args),
  BenchIdentityTransportError: MockBenchIdentityTransportError,
}));

vi.mock("@/lib/lab/bench/persistence/bench-run-service", () => ({
  reserveBenchRun: (...args: unknown[]) => mockReserveBenchRun(...args),
  getBenchRunByOperationId: (...args: unknown[]) => mockGetBenchRunByOperationId(...args),
  setBenchRunInput: (...args: unknown[]) => mockSetBenchRunInput(...args),
  confirmBenchRun: (...args: unknown[]) => mockConfirmBenchRun(...args),
  finalizeBenchRun: (...args: unknown[]) => mockFinalizeBenchRun(...args),
  getBenchRun: (...args: unknown[]) => mockGetBenchRun(...args),
  listBenchRunLineagesByStore: (...args: unknown[]) => mockListBenchRunLineagesByStore(...args),
  BenchRunError: MockBenchRunError,
}));

vi.mock("@/lib/lab/bench/persistence/bench-artifact-service", () => ({
  persistBenchArtifact: (...args: unknown[]) => mockPersistBenchArtifact(...args),
  listBenchArtifacts: (...args: unknown[]) => mockListBenchArtifacts(...args),
  createBenchArtifactSignedUrl: (...args: unknown[]) => mockCreateBenchArtifactSignedUrl(...args),
}));

vi.mock("@/lib/lab/bench/execution/bench-execution-service", () => ({
  executeBenchRun: (...args: unknown[]) => mockExecuteBenchRun(...args),
}));

vi.mock("@/lib/lab/bench/gateway/runtime", () => ({
  createBenchAdapterRegistry: () => ({}),
  createBenchGateway: () => ({ invoke: vi.fn() }),
}));

vi.mock("@/lib/lab/gateway/runtime", () => ({
  createLabTelemetryContext: (...args: unknown[]) => mockCreateLabTelemetryContext(...args),
}));

vi.mock("@/lib/ai/lab-telemetry-sink", () => ({
  LabTelemetrySink: class {
    constructor(_params?: unknown) {}
  },
}));

vi.mock("@/lib/ai", () => ({
  defaultAiModelResolver: {},
}));

vi.mock("@/lib/lab/technical-validation", () => ({
  validateArtifactTechnically: (...args: unknown[]) => mockValidateArtifactTechnically(...args),
}));

import { ForbiddenError } from "@/lib/auth/errors";
import type { LabEnvironmentReason } from "@/lib/lab/environment-guard";

/**
 * F48.2.2 — contrato HTTP da API administrativa da bancada
 * (`/api/admin/laboratorio/bancada`).
 *
 * Todas as dependências externas (admin, guarda de ambiente, Supabase e serviços
 * da bancada) são mockadas e cada rota é importada dinamicamente dentro do teste.
 * Nenhuma chamada de rede e **nenhuma chamada paga** em nenhum caminho: o
 * `executeBenchRun` é um mock e nenhum provider é instanciado.
 */

const BASE = "http://localhost/api/admin/laboratorio/bancada";
const ADMIN_ID = "admin-1";
const RUN_ID = "11111111-1111-4111-8111-111111111111";
const OP_ID = "22222222-2222-4222-8222-222222222222";
const STORE_ID = "33333333-3333-4333-8333-333333333333";
const OUTSIDE_STORE_ID = "99999999-9999-4999-8999-999999999999";
const PRESET_ID = "gpt-image-2-low";

const PRESET = {
  id: PRESET_ID,
  label: "GPT Image 2 · low",
  capability: "campaign_image",
  provider: "openai",
  model: "gpt-image-2",
  protocol: "images",
  quality: "low",
  size: "1024x1024",
  enabled: true,
};

const BRANDING_CONTRACT = {
  storeId: STORE_ID,
  storeName: "Loja de teste A",
  segment: "mercado",
  subsegment: null,
  toneOfVoice: null,
  positioning: null,
  shortDescription: null,
  slogan: null,
  typographyDirection: "serif",
  safeColorTokens: {},
  brandColorsChosen: [],
  logoColorsDetected: [],
  visualStyle: null,
  visualTone: null,
  brandPersonality: null,
  campaignGuidelines: null,
  campaignBrief: null,
  brandColor: "#16A34A",
  profileSource: "synced",
  profileStatus: "synced",
  logoUrl: "https://signed.test/logo",
  signatureUrl: null,
  identityState: "logo",
  identityReference: {
    kind: "logo",
    variantType: "primary",
    storagePath: "logos/loja-a.png",
    signedUrl: "https://signed.test/logo",
  },
  identityReason: "logo:selected",
  assets: [
    {
      assetType: "logo",
      variantType: "primary",
      storagePath: "logos/loja-a.png",
      mimeType: "image/png",
      width: 256,
      height: 256,
      sizeBytes: 1024,
      checksum: "checksum-logo",
      signedUrl: "https://signed.test/logo",
    },
  ],
};

const DRAFT_RUN = {
  id: RUN_ID,
  operationId: OP_ID,
  status: "draft",
  createdBy: ADMIN_ID,
  createdAt: "2026-09-28T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  campaignSnapshot: null,
  brandingSnapshot: null,
  config: null,
  promptSent: null,
  references: null,
  provider: null,
  protocol: null,
  model: null,
  size: null,
  quality: null,
  intent: null,
  contentType: null,
  structure: null,
  theme: null,
  latencyMs: null,
  usage: null,
  estimatedCostUsd: null,
  costDetail: null,
  costSource: null,
  costRuleVersion: null,
  errorType: null,
  errorMessage: null,
  technicalValidation: null,
};

const DETAIL_RUN = {
  ...DRAFT_RUN,
  status: "succeeded",
  config: {
    pipeline: "manual-direto",
    formato: "1:1",
    modelo: "gpt-image-2",
    qualidade: "low",
    intencao: "oferta",
    tipoConteudo: "produto",
    estrutura: "peca-unica",
    tema: "nenhum",
  },
  campaignSnapshot: { product: { source: "manual", name: "Produto" } },
  brandingSnapshot: { typographyDirection: "serif" },
  promptSent: "prompt manual",
  references: [`bench/${RUN_ID}/inputs/0.png`],
  provider: "openai",
  protocol: "images",
  model: "gpt-image-2",
  size: "1024x1024",
  quality: "low",
  intent: "oferta",
  contentType: "produto",
  structure: "peca-unica",
  theme: "nenhum",
  latencyMs: 12,
  usage: { promptTokens: 1000 },
  estimatedCostUsd: 0.006,
  costDetail: { is_estimate: true, cost_source: "bench_local_pricing" },
  costSource: "bench_local_pricing",
  costRuleVersion: "2026-09-bench-1",
};

const VALID_RUN_BODY = {
  operationId: OP_ID,
  runId: RUN_ID,
  storeId: STORE_ID,
  presetId: PRESET_ID,
  prompt: "prompt manual",
  references: [`bench/${RUN_ID}/inputs/0.png`],
  confirmed: true,
  product: { name: "Produto", priceCents: 1000, originalPriceCents: 1500 },
  offer: {},
  preflight: {
    promptBase: "prompt base",
    promptCompiled: "prompt compilado",
    promptApproved: "prompt manual",
    promptBlocks: { "INSTRUÇÕES DO PROMPT-BASE": "prompt base" },
    composerVersion: "48.2.3-prompt-composer-v1",
  },
};

// ─── Invocação das rotas (import dinâmico) ───────────────────────────────────

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function multipartRequest(url: string, form: FormData): NextRequest {
  return new NextRequest(url, { method: "POST", body: form });
}

function buildInputForm(operationId: string): FormData {
  const form = new FormData();
  form.append("operationId", operationId);
  form.append(
    "files",
    new File([new Uint8Array([1, 2, 3])], "produto.png", { type: "image/png" }),
  );
  return form;
}

async function getStores(): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/bancada/stores/route");
  return GET(new NextRequest(`${BASE}/stores`));
}

async function getBranding(storeId: string = STORE_ID): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/bancada/branding/route");
  return GET(new NextRequest(`${BASE}/branding?storeId=${storeId}`));
}

async function getPresets(): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/bancada/presets/route");
  return GET(new NextRequest(`${BASE}/presets`));
}

async function getEstimate(
  storeId: string = STORE_ID,
  presetId: string = PRESET_ID,
): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/bancada/estimate/route");
  return GET(new NextRequest(`${BASE}/estimate?storeId=${storeId}&presetId=${presetId}`));
}

async function getBriefing(storeId: string = STORE_ID): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/bancada/briefing/route");
  return GET(new NextRequest(`${BASE}/briefing?storeId=${storeId}`));
}

const VALID_COMPOSE_BODY = {
  storeId: STORE_ID,
  presetId: PRESET_ID,
  product: { name: "Produto", priceCents: 1000, originalPriceCents: 1500 },
  offer: {},
  promptBase: "prompt base",
  references: [`bench/${RUN_ID}/inputs/0.png`],
};

async function postCompose(body: unknown = VALID_COMPOSE_BODY): Promise<Response> {
  const { POST } = await import("@/app/api/admin/laboratorio/bancada/compose/route");
  return POST(jsonRequest(`${BASE}/compose`, body));
}

async function postInputs(form: FormData): Promise<Response> {
  const { POST } = await import("@/app/api/admin/laboratorio/bancada/inputs/route");
  return POST(multipartRequest(`${BASE}/inputs`, form));
}

async function postRun(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/admin/laboratorio/bancada/runs/route");
  return POST(jsonRequest(`${BASE}/runs`, body));
}

async function getRun(id: string = RUN_ID): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/bancada/runs/[id]/route");
  return GET(new NextRequest(`${BASE}/runs/${id}`), { params: Promise.resolve({ id }) });
}

async function getRuns(storeId: string = STORE_ID): Promise<Response> {
  const { GET } = await import("@/app/api/admin/laboratorio/bancada/runs/route");
  return GET(new NextRequest(`${BASE}/runs?storeId=${storeId}`));
}

interface RouteCall {
  name: string;
  call: () => Promise<Response>;
}

function allRouteCalls(): RouteCall[] {
  return [
    { name: "GET /stores", call: getStores },
    { name: "GET /branding", call: () => getBranding() },
    { name: "GET /presets", call: getPresets },
    { name: "GET /estimate", call: () => getEstimate() },
    { name: "GET /briefing", call: () => getBriefing() },
    { name: "POST /compose", call: () => postCompose() },
    { name: "POST /inputs", call: () => postInputs(buildInputForm(OP_ID)) },
    { name: "POST /runs", call: () => postRun(VALID_RUN_BODY) },
    { name: "GET /runs", call: () => getRuns() },
    { name: "GET /runs/[id]", call: () => getRun() },
  ];
}

/** `true` quando algum serviço da bancada foi acionado. */
function anyServiceCalled(): boolean {
  return [
    mockListBenchTestStores,
    mockAssertBenchTestStore,
    mockLoadBenchBranding,
    mockCreateBenchBrandingSignedUrlForStore,
    mockListBenchPresets,
    mockResolveBenchPreset,
    mockResolveBenchCost,
    mockBuildBenchCampaignSnapshot,
    mockBuildBenchExperimentalBriefing,
    mockComposePromptBlocks,
    mockReserveBenchRun,
    mockGetBenchRunByOperationId,
    mockSetBenchRunInput,
    mockConfirmBenchRun,
    mockFinalizeBenchRun,
    mockGetBenchRun,
    mockPersistBenchArtifact,
    mockListBenchArtifacts,
    mockCreateBenchArtifactSignedUrl,
    mockExecuteBenchRun,
  ].some((mock) => mock.mock.calls.length > 0);
}

beforeEach(() => {
  vi.clearAllMocks();

  mockRequireAdmin.mockResolvedValue({ userId: ADMIN_ID });
  mockAssertLabEnvironment.mockReturnValue({
    enabled: true,
    supabaseHost: "localhost",
    local: true,
    reason: "ok",
  });

  mockListBenchTestStores.mockResolvedValue([
    { id: STORE_ID, label: "Loja de teste A", name: "Loja A", segment: "mercado" },
  ]);
  mockAssertBenchTestStore.mockResolvedValue({
    id: STORE_ID,
    name: "Loja A",
    segment: "mercado",
    subsegment: null,
    toneOfVoice: null,
    positioning: null,
    shortDescription: null,
    slogan: null,
  });
  mockLoadBenchBranding.mockResolvedValue(BRANDING_CONTRACT);
  mockToBenchBrandingSnapshot.mockImplementation((contract: unknown) => contract);
  mockCreateBenchBrandingSignedUrlForStore.mockResolvedValue("https://signed.test/branding");

  mockListBenchPresets.mockReturnValue([
    PRESET,
    {
      id: "gpt-image-2-responses",
      label: "GPT Image 2 · responses (desabilitado)",
      capability: "campaign_image",
      provider: "openai",
      model: "gpt-image-2",
      protocol: "responses",
      quality: "low",
      size: "1024x1024",
      enabled: false,
      reason: "protocolo_nao_confirmado",
    },
  ]);
  mockResolveBenchPreset.mockReturnValue(PRESET);
  mockListBenchConfigOptions.mockReturnValue([
    { id: "manual-direto", label: "Manual direto", enabled: true },
    { id: "ia-assistido", label: "IA assistido", enabled: false, reason: "fora_do_primeiro_recorte" },
  ]);
  mockResolveBenchConfig.mockImplementation((dims: unknown) => dims);
  mockResolveBenchCost.mockReturnValue({
    costSource: "bench_local_pricing",
    costRuleVersion: "2026-09-bench-1",
    mode: "token_based",
    coverage: "complete",
    estimatedCostUsd: 0.006,
    isEstimate: true,
  });

  mockBuildBenchCampaignSnapshot.mockImplementation(
    (params: { product: { name: string }; offer: unknown; config: unknown }) => ({
      product: { source: "manual", name: params.product.name },
      commercial: { intent: "offer" },
      intent: "offer",
      intentResolvedFrom: "explicit",
      config: params.config,
      format: "1:1",
      locale: "pt-BR",
    }),
  );

  mockBuildBenchExperimentalBriefing.mockImplementation(
    (params: { branding: { storeName: string; brandColor?: string } }) => ({
      storeId: STORE_ID,
      storeName: params.branding.storeName,
      segment: "mercado",
      visualDirection: {
        campaignBrief: null,
        campaignGuidelines: null,
        visualStyle: null,
        visualTone: null,
        brandPersonality: null,
      },
      typographyDirection: "serif",
      brandColor: params.branding.brandColor ?? "#22C55E",
      product: { name: "Produto", description: null },
      commercial: {
        intent: "offer",
        originalPriceText: null,
        discountedPriceText: null,
        badge: null,
        validity: null,
        preserveImageContext: false,
      },
      constraints: { mandatoryArtworkText: null },
      config: {},
    }),
  );
  mockComposePromptBlocks.mockReturnValue({
    text: "prompt compilado",
    blocks: { "INSTRUÇÕES DO PROMPT-BASE": "prompt base" },
  });
  mockResolveBenchPromptPolicies.mockReturnValue({
    contributions: [],
    versions: {
      intencao: "oferta-v1",
      formato: "1-1-v1",
      tipoConteudo: "produto-v1",
      estrutura: "peca-unica-v1",
      tema: "nenhum-v1",
    },
  });
  mockResolveBenchDefaultPromptBase.mockReturnValue({
    version: "test-prompt-base-v1",
    content: "instruções complementares padrão",
  });
  mockBuildBrandingPromptContributions.mockReturnValue([]);
  mockBuildIdentityDirectionContributions.mockReturnValue([]);

  mockRecomposeBenchPrompt.mockReturnValue({
    text: "prompt compilado",
    blocks: { "INSTRUÇÕES DO PROMPT-BASE": "prompt base" },
    composerVersion: "test-composer-v1",
    policyVersions: { intencao: "oferta-v1" },
  });
  mockAssertPreflightCompositionMatches.mockReturnValue(undefined);
  mockAssertPreflightEvidenceMatches.mockReturnValue(undefined);
  mockResolveServerResolvedEvidence.mockReturnValue({
    presetId: PRESET_ID,
    config: {
      pipeline: "manual-direto",
      formato: "1:1",
      modelo: "gpt-image-2",
      qualidade: "low",
      intencao: "oferta",
      tipoConteudo: "produto",
      estrutura: "peca-unica",
      tema: "nenhum",
    },
    policyVersions: { intencao: "oferta-v1" },
    promptBaseVersion: "test-prompt-base-v1",
    composerVersion: "test-composer-v1",
    identityReference: {
      kind: "logo",
      variantType: "primary",
      storagePath: "logos/loja-a.png",
    },
  });
  mockResolveBenchIdentityImageDataUrl.mockResolvedValue("data:image/png;base64,AAAA");
  mockListBenchRunLineagesByStore.mockResolvedValue([
    { root: { ...DETAIL_RUN }, runs: [{ ...DETAIL_RUN }] },
  ]);

  mockReserveBenchRun.mockResolvedValue({ runId: RUN_ID, idempotent: false });
  mockGetBenchRunByOperationId.mockResolvedValue({ ...DRAFT_RUN });
  mockSetBenchRunInput.mockResolvedValue(undefined);
  mockConfirmBenchRun.mockResolvedValue(undefined);
  mockFinalizeBenchRun.mockResolvedValue(undefined);
  mockGetBenchRun.mockResolvedValue({ ...DETAIL_RUN });

  mockPersistBenchArtifact.mockImplementation(
    (params: { runId: string; index?: number }) => ({
      artifactId: "artifact-1",
      storagePath: `bench/${params.runId}/inputs/${params.index ?? 0}.png`,
      checksum: "checksum-input",
      bytes: 3,
    }),
  );
  mockListBenchArtifacts.mockResolvedValue([
    {
      id: "artifact-1",
      kind: "output",
      storagePath: `bench/${RUN_ID}/output.png`,
      mimeType: "image/png",
      width: 1024,
      height: 1024,
      bytes: 1234,
      checksum: "checksum-output",
      createdAt: "2026-09-28T00:01:00.000Z",
    },
  ]);
  mockCreateBenchArtifactSignedUrl.mockResolvedValue("https://signed.test/artifact");

  mockExecuteBenchRun.mockResolvedValue({ status: "succeeded", latencyMs: 10, cost: null });
  mockValidateArtifactTechnically.mockResolvedValue({
    decodable: true,
    mimeType: "image/png",
    width: 4,
    height: 4,
    bytes: 3,
    aspectRatio: 1,
    uniform: false,
    emptyOrCorrupt: false,
    alerts: [],
    structuredOutputValid: null,
    ocrAlert: null,
  });
  mockCreateLabTelemetryContext.mockImplementation((params: unknown) => params);
});

// ─── 1. 403 não-admin ────────────────────────────────────────────────────────

describe("contrato da API da bancada — 403 para não-admin", () => {
  it.each(allRouteCalls().map((route) => [route.name, route.call] as const))(
    "%s nega não-admin com 403 e não executa nenhuma operação",
    async (_name, call) => {
      mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

      const res = await call();

      expect(res.status).toBe(403);
      expect(anyServiceCalled()).toBe(false);
      expect(mockExecuteBenchRun).not.toHaveBeenCalled();
    },
  );
});

// ─── 2. 403 ambiente bloqueado ───────────────────────────────────────────────

describe("contrato da API da bancada — 403 com ambiente bloqueado", () => {
  it.each(allRouteCalls().map((route) => [route.name, route.call] as const))(
    "%s recusa com environment_blocked e nenhum acesso à bancada",
    async (_name, call) => {
      mockAssertLabEnvironment.mockImplementation(() => {
        throw new MockLabEnvironmentError("disabled_flag" as LabEnvironmentReason);
      });

      const res = await call();
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ error: "environment_blocked", reason: "disabled_flag" });
      expect(anyServiceCalled()).toBe(false);
      expect(mockExecuteBenchRun).not.toHaveBeenCalled();
    },
  );
});

// ─── 3. Rotas de leitura ─────────────────────────────────────────────────────

describe("contrato da API da bancada — leitura", () => {
  it("GET /stores ⇒ 200 apenas com as lojas do manifesto", async () => {
    const res = await getStores();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stores).toHaveLength(1);
    expect(body.stores[0].id).toBe(STORE_ID);
    expect(mockListBenchTestStores).toHaveBeenCalledTimes(1);
  });

  it("GET /branding ⇒ 200 com tipografia e URLs do signer restrito (não do signer de artefatos)", async () => {
    const res = await getBranding();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.branding.typographyDirection).toBe("serif");
    expect(body.branding.assets[0].signedUrl).toBe("https://signed.test/branding");
    // O signer restrito de branding é o único usado — nunca o de artefatos.
    expect(mockCreateBenchBrandingSignedUrlForStore).toHaveBeenCalled();
    expect(mockCreateBenchArtifactSignedUrl).not.toHaveBeenCalled();
    expect(mockAssertBenchTestStore).toHaveBeenCalled();
    expect(mockLoadBenchBranding).toHaveBeenCalled();
  });

  it("GET /branding expõe identityState e renova apenas o descritor selecionado (não re-resolve)", async () => {
    const res = await getBranding();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.branding.identityState).toBe("logo");
    expect(body.branding.identityReason).toBe("logo:selected");
    // A rota apenas renova a URL do MESMO descritor selecionado por loadBenchBranding.
    expect(body.branding.identityReference).toEqual({
      kind: "logo",
      variantType: "primary",
      storagePath: "logos/loja-a.png",
      signedUrl: "https://signed.test/branding",
    });
    expect(body.branding.logoUrl).toBe("https://signed.test/branding");
    expect(body.branding.signatureUrl).toBeNull();
    // O signer restrito foi chamado com o storagePath/bucket do descritor selecionado.
    expect(mockCreateBenchBrandingSignedUrlForStore).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "store-brand-assets",
        path: "logos/loja-a.png",
      }),
    );
  });

  it("GET /branding com falha de assinatura mantém o descritor com signedUrl null (sem fallback)", async () => {
    mockCreateBenchBrandingSignedUrlForStore.mockResolvedValue(null);

    const res = await getBranding();
    const body = await res.json();

    expect(res.status).toBe(200);
    // Descritor preservado, apenas sem URL assinada.
    expect(body.branding.identityReference).toEqual({
      kind: "logo",
      variantType: "primary",
      storagePath: "logos/loja-a.png",
      signedUrl: null,
    });
    // O motivo NÃO pode continuar "logo:selected" quando a URL está indisponível.
    expect(body.branding.identityReason).toBe("logo:sign_failed");
    expect(body.branding.logoUrl).toBeNull();
    expect(body.branding.signatureUrl).toBeNull();
  });

  it("GET /presets ⇒ 200 com habilitados e desabilitados com motivo", async () => {
    const res = await getPresets();
    const body = await res.json();

    expect(res.status).toBe(200);
    const disabled = body.presets.find(
      (preset: { id: string }) => preset.id === "gpt-image-2-responses",
    );
    expect(disabled.enabled).toBe(false);
    expect(disabled.reason).toBe("protocolo_nao_confirmado");
  });

  it("GET /estimate ⇒ 200 com cobertura complete pelo resolvedor local", async () => {
    const res = await getEstimate();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coverage).toBe("complete");
    expect(body.estimatedUsd).toBe(0.006);
    expect(body.costSource).toBe("bench_local_pricing");
    expect(mockResolveBenchCost).toHaveBeenCalledTimes(1);
  });

  it("GET /estimate com cobertura partial continua 200 (não bloqueia)", async () => {
    mockResolveBenchCost.mockReturnValue({
      costSource: "bench_local_pricing",
      costRuleVersion: "2026-09-bench-1",
      mode: "token_based",
      coverage: "partial",
      estimatedCostUsd: null,
      isEstimate: true,
    });

    const res = await getEstimate();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coverage).toBe("partial");
    expect(body.estimatedUsd).toBeNull();
  });

  it("GET /estimate com cobertura missing continua 200 (não bloqueia)", async () => {
    mockResolveBenchCost.mockReturnValue({
      costSource: "bench_local_pricing",
      costRuleVersion: "2026-09-bench-1",
      mode: "unknown",
      coverage: "missing",
      estimatedCostUsd: null,
      isEstimate: true,
    });

    const res = await getEstimate();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coverage).toBe("missing");
  });

  it("GET /estimate com preset desabilitado ⇒ 400 preset_not_enabled sem resolver custo", async () => {
    mockResolveBenchPreset.mockImplementation(() => {
      throw new MockBenchPresetError("gpt-image-2-responses", "protocolo_nao_confirmado");
    });

    const res = await getEstimate(STORE_ID, "gpt-image-2-responses");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("preset_not_enabled");
    expect(mockResolveBenchCost).not.toHaveBeenCalled();
  });

  it("GET /branding com storeId fora do manifesto ⇒ recusa sem leitura de branding", async () => {
    mockAssertBenchTestStore.mockRejectedValue(
      new MockBenchStoreManifestError("store_not_in_manifest", OUTSIDE_STORE_ID),
    );

    const res = await getBranding(OUTSIDE_STORE_ID);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("store_not_in_manifest");
    expect(mockLoadBenchBranding).not.toHaveBeenCalled();
  });

  it("GET /estimate com storeId fora do manifesto ⇒ recusa sem resolver custo", async () => {
    mockAssertBenchTestStore.mockRejectedValue(
      new MockBenchStoreManifestError("store_not_in_manifest", OUTSIDE_STORE_ID),
    );

    const res = await getEstimate(OUTSIDE_STORE_ID);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("store_not_in_manifest");
    expect(mockResolveBenchCost).not.toHaveBeenCalled();
  });
});

// ─── 3b. Briefing e composição/preview ───────────────────────────────────────

describe("contrato da API da bancada — briefing experimental", () => {
  it("GET /briefing ⇒ 200 com direção visual, tipografia e brandColor resolvido, sem secrets", async () => {
    const res = await getBriefing();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.briefing.storeId).toBe(STORE_ID);
    expect(body.briefing.storeName).toBe("Loja de teste A");
    expect(body.briefing.typographyDirection).toBe("serif");
    expect(body.briefing.brandColor).toBe("#16A34A");
    expect(body.briefing.visualDirection).toBeDefined();

    // Nenhum secret/URL assinada é exposto pelo briefing.
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(text).not.toContain("signed.test");
    expect(text).not.toContain("campaign-images");

    // Manifesto validado antes de qualquer leitura de branding.
    const assertIdx = mockAssertBenchTestStore.mock.invocationCallOrder[0];
    const brandingIdx = mockLoadBenchBranding.mock.invocationCallOrder[0];
    expect(assertIdx).toBeLessThan(brandingIdx);
  });

  it("GET /briefing sem storeId ⇒ 400 invalid_payload sem leitura", async () => {
    const res = await getBriefing("");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_payload");
    expect(mockLoadBenchBranding).not.toHaveBeenCalled();
  });

  it("GET /briefing com loja fora do manifesto ⇒ 400 sem leitura de branding", async () => {
    mockAssertBenchTestStore.mockRejectedValue(
      new MockBenchStoreManifestError("store_not_in_manifest", OUTSIDE_STORE_ID),
    );

    const res = await getBriefing(OUTSIDE_STORE_ID);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("store_not_in_manifest");
    expect(mockLoadBenchBranding).not.toHaveBeenCalled();
  });
});

describe("contrato da API da bancada — composição/preview do prompt", () => {
  it("POST /compose ⇒ 200 com prompt compilado, blocos e versão do compositor (sem IA)", async () => {
    const res = await postCompose();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.compiledPrompt).toBe("prompt compilado");
    expect(body.blocks).toBeDefined();
    expect(body.composerVersion).toBe("test-composer-v1");
    expect(body.approved).toBe(false);

    // Composição é pura: nenhuma geração paga disparada.
    expect(mockComposePromptBlocks).toHaveBeenCalledTimes(1);
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();

    // Manifesto validado antes de qualquer leitura de branding.
    const assertIdx = mockAssertBenchTestStore.mock.invocationCallOrder[0];
    const brandingIdx = mockLoadBenchBranding.mock.invocationCallOrder[0];
    expect(assertIdx).toBeLessThan(brandingIdx);
  });

  it("POST /compose com approved: true ecoa a aprovação explícita", async () => {
    const res = await postCompose({ ...VALID_COMPOSE_BODY, approved: true });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.approved).toBe(true);
  });

  it("POST /compose sem storeId válido ⇒ 400 sem leitura", async () => {
    const res = await postCompose({ ...VALID_COMPOSE_BODY, storeId: "" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_payload");
    expect(mockLoadBenchBranding).not.toHaveBeenCalled();
  });

  it("POST /compose com loja fora do manifesto ⇒ 400 antes de ler branding", async () => {
    mockAssertBenchTestStore.mockRejectedValue(
      new MockBenchStoreManifestError("store_not_in_manifest", OUTSIDE_STORE_ID),
    );

    const res = await postCompose({ ...VALID_COMPOSE_BODY, storeId: OUTSIDE_STORE_ID });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("store_not_in_manifest");
    expect(mockLoadBenchBranding).not.toHaveBeenCalled();
  });

  it("POST /compose com payload inválido ⇒ 400 sem compor", async () => {
    const res = await postCompose({ ...VALID_COMPOSE_BODY, product: { name: "" } });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_payload");
    expect(mockComposePromptBlocks).not.toHaveBeenCalled();
  });

  it("POST /compose expõe policyVersions, promptBaseVersion e defaultPromptBase (informativos)", async () => {
    const res = await postCompose();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.policyVersions).toMatchObject({ intencao: "oferta-v1", formato: "1-1-v1" });
    expect(body.promptBaseVersion).toBe("test-prompt-base-v1");
    expect(body.defaultPromptBase).toBe("instruções complementares padrão");

    // As políticas resolvidas são repassadas ao compositor com as versões.
    expect(mockResolveBenchPromptPolicies).toHaveBeenCalledTimes(1);
    expect(mockComposePromptBlocks).toHaveBeenCalledWith(
      expect.objectContaining({
        policyVersions: expect.objectContaining({ intencao: "oferta-v1" }),
      }),
    );
    // Composição pura: nenhuma geração paga disparada.
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("POST /compose com política não implementada ⇒ 400 bench_policy_not_implemented sem compor nem gerar", async () => {
    mockResolveBenchPromptPolicies.mockImplementation(() => {
      throw new MockBenchPromptPolicyError({ dimension: "intencao", value: "destaque" });
    });

    const res = await postCompose();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("bench_policy_not_implemented");
    // Falha fail-closed ANTES de qualquer I/O com a loja e de qualquer composição.
    expect(mockLoadBenchBranding).not.toHaveBeenCalled();
    expect(mockComposePromptBlocks).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("POST /compose compõe SEMPRE com o promptBase do operador (nunca substitui pelo padrão)", async () => {
    // O compositor recebe o promptBase do corpo e o preserva no bloco do prompt-base.
    mockComposePromptBlocks.mockImplementation((input: { promptBase: string }) => ({
      text: `[INSTRUÇÕES DO PROMPT-BASE]\n${input.promptBase}`,
      blocks: { "INSTRUÇÕES DO PROMPT-BASE": input.promptBase },
      composerVersion: "test-composer-v1",
    }));

    const customPromptBase = "prompt customizado do operador";
    const res = await postCompose({ ...VALID_COMPOSE_BODY, promptBase: customPromptBase });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.blocks["INSTRUÇÕES DO PROMPT-BASE"]).toBe(customPromptBase);
    expect(body.compiledPrompt).toContain(customPromptBase);

    // O prompt-base padrão é apenas informativo — NÃO substitui a edição do operador.
    expect(body.defaultPromptBase).toBe("instruções complementares padrão");
    expect(body.blocks["INSTRUÇÕES DO PROMPT-BASE"]).not.toBe(body.defaultPromptBase);

    const composeCall = mockComposePromptBlocks.mock.calls[0][0] as { promptBase: string };
    expect(composeCall.promptBase).toBe(customPromptBase);
  });
});

// ─── 4. Upload multipart (/inputs) ───────────────────────────────────────────

describe("contrato da API da bancada — upload multipart", () => {
  it("grava a entrada com metadados + checksum sob bench/{runId}/inputs e devolve runId", async () => {
    const res = await postInputs(buildInputForm(OP_ID));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.runId).toBe(RUN_ID);
    expect(body.inputs).toHaveLength(1);
    expect(body.inputs[0]).toMatchObject({
      path: `bench/${RUN_ID}/inputs/0.png`,
      mimeType: "image/png",
      width: 4,
      height: 4,
      bytes: 3,
      checksum: "checksum-input",
    });

    // Reserva em draft (sem slot) + persistência do artefato de entrada.
    expect(mockReserveBenchRun).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: OP_ID, createdBy: ADMIN_ID }),
    );
    const persistCall = mockPersistBenchArtifact.mock.calls[0][0] as {
      kind: string;
      index: number;
      finalizeRun: (args: unknown) => Promise<void>;
    };
    expect(persistCall.kind).toBe("input");
    expect(persistCall.index).toBe(0);
    expect(typeof persistCall.finalizeRun).toBe("function");

    // O binding injeta o client no finalizeBenchRun.
    await persistCall.finalizeRun({ runId: RUN_ID, status: "failed", errorType: "x" });
    expect(mockFinalizeBenchRun).toHaveBeenCalledWith(
      expect.objectContaining({ runId: RUN_ID, status: "failed", errorType: "x" }),
    );
  });

  it("sem operationId válido ⇒ 400 e nenhuma reserva", async () => {
    const form = new FormData();
    form.append("operationId", "não-é-uuid");
    form.append("files", new File([new Uint8Array([1])], "x.png", { type: "image/png" }));

    const res = await postInputs(form);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_payload");
    expect(mockReserveBenchRun).not.toHaveBeenCalled();
  });

  it("falha na persistência de metadados finaliza o run (draft) como failed sem órfão", async () => {
    mockPersistBenchArtifact.mockRejectedValue(new Error("artifact_persistence_failed"));

    const res = await postInputs(buildInputForm(OP_ID));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("artifact_persistence_failed");
    expect(mockFinalizeBenchRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: RUN_ID,
        status: "failed",
        errorType: "artifact_persistence_failed",
      }),
    );
  });
});

// ─── 5. Execução (/runs) ─────────────────────────────────────────────────────

describe("contrato da API da bancada — execução com confirmação", () => {
  it("sem confirmed: true ⇒ 422 antes do parse e sem chamada paga", async () => {
    const { confirmed, ...withoutConfirmation } = VALID_RUN_BODY;
    void confirmed;

    const res = await postRun(withoutConfirmation);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body).toEqual({ error: "confirmation_required" });
    expect(mockGetBenchRunByOperationId).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("payload inválido ⇒ 400 com detalhes e nenhuma mutação", async () => {
    const res = await postRun({ ...VALID_RUN_BODY, runId: "não-é-uuid" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_payload");
    expect(Array.isArray(body.details)).toBe(true);
    expect(mockSetBenchRunInput).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("sem preflight aprovado ⇒ 422 confirmation_required sem chamada paga", async () => {
    const { preflight, ...withoutPreflight } = VALID_RUN_BODY;
    void preflight;

    const res = await postRun(withoutPreflight);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe("confirmation_required");
    expect(mockSetBenchRunInput).not.toHaveBeenCalled();
    expect(mockConfirmBenchRun).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("prompt divergente do prompt aprovado ⇒ 400 sem mutação", async () => {
    const res = await postRun({ ...VALID_RUN_BODY, prompt: "outro prompt" });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_payload");
    expect(mockSetBenchRunInput).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("persiste a evidência do preflight e envia exatamente o prompt aprovado", async () => {
    const res = await postRun(VALID_RUN_BODY);
    await res.text();

    const setCall = mockSetBenchRunInput.mock.calls[0][0] as {
      promptSent: string;
      promptApproved: string;
      promptBase: string;
      promptCompiled: string;
      promptBlocks: Record<string, string>;
      composerVersion: string;
    };
    expect(setCall.promptSent).toBe("prompt manual");
    expect(setCall.promptApproved).toBe("prompt manual");
    expect(setCall.promptBase).toBe("prompt base");
    expect(setCall.promptCompiled).toBe("prompt compilado");
    expect(setCall.promptBlocks).toEqual({ "INSTRUÇÕES DO PROMPT-BASE": "prompt base" });
    expect(setCall.composerVersion).toBe("48.2.3-prompt-composer-v1");

    // O provider recebe exatamente o prompt final aprovado.
    const execCall = mockExecuteBenchRun.mock.calls[0][0] as {
      request: { prompt: string };
    };
    expect(execCall.request.prompt).toBe("prompt manual");
  });

  it("operation_id sem draft prévio ⇒ 400 e nenhum run criado", async () => {
    mockGetBenchRunByOperationId.mockResolvedValue(null);

    const res = await postRun(VALID_RUN_BODY);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_payload");
    expect(mockReserveBenchRun).not.toHaveBeenCalled();
    expect(mockConfirmBenchRun).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("runId divergente do draft resolvido ⇒ 400 sem mutação", async () => {
    mockGetBenchRunByOperationId.mockResolvedValue({
      ...DRAFT_RUN,
      id: "44444444-4444-4444-8444-444444444444",
    });

    const res = await postRun(VALID_RUN_BODY);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_payload");
    expect(mockSetBenchRunInput).not.toHaveBeenCalled();
  });

  it("autor incorreto ⇒ 403 sem mutação", async () => {
    mockGetBenchRunByOperationId.mockResolvedValue({ ...DRAFT_RUN, createdBy: "outro-admin" });

    const res = await postRun(VALID_RUN_BODY);

    expect(res.status).toBe(403);
    expect(mockSetBenchRunInput).not.toHaveBeenCalled();
  });

  it("estado terminal ⇒ 200 idempotente sem nova chamada paga", async () => {
    mockGetBenchRunByOperationId.mockResolvedValue({ ...DRAFT_RUN, status: "succeeded" });

    const res = await postRun(VALID_RUN_BODY);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ idempotent: true, runId: RUN_ID });
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("estado pending/running ⇒ 409 bench_run_already_active sem chamada paga", async () => {
    mockGetBenchRunByOperationId.mockResolvedValue({ ...DRAFT_RUN, status: "running" });

    const res = await postRun(VALID_RUN_BODY);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("bench_run_already_active");
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("preset desabilitado ⇒ 400 preset_not_enabled sem chamada paga", async () => {
    mockResolveBenchPreset.mockImplementation(() => {
      throw new MockBenchPresetError(PRESET_ID, "protocolo_nao_confirmado");
    });

    const res = await postRun({ ...VALID_RUN_BODY, presetId: "gpt-image-2-responses" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("preset_not_enabled");
    expect(mockConfirmBenchRun).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("storeId fora do manifesto ⇒ recusa antes de ler branding", async () => {
    mockAssertBenchTestStore.mockRejectedValue(
      new MockBenchStoreManifestError("store_not_in_manifest", OUTSIDE_STORE_ID),
    );

    const res = await postRun({ ...VALID_RUN_BODY, storeId: OUTSIDE_STORE_ID });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("store_not_in_manifest");
    expect(mockLoadBenchBranding).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("confirmação concorrente ⇒ 409 bench_run_already_active sem chamada paga", async () => {
    mockConfirmBenchRun.mockRejectedValue(new MockBenchRunError("bench_run_already_active"));

    const res = await postRun(VALID_RUN_BODY);

    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("bench_run_already_active");
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("deriva a configuração explicitamente (registry travado + preset) e fixa antes de confirmar", async () => {
    const res = await postRun(VALID_RUN_BODY);
    await res.text();

    // A ordem: manifesto → leitura de branding → fixação em draft → CAS.
    const assertIdx = mockAssertBenchTestStore.mock.invocationCallOrder[0];
    const brandingIdx = mockLoadBenchBranding.mock.invocationCallOrder[0];
    const setIdx = mockSetBenchRunInput.mock.invocationCallOrder[0];
    const confirmIdx = mockConfirmBenchRun.mock.invocationCallOrder[0];
    expect(assertIdx).toBeLessThan(brandingIdx);
    expect(brandingIdx).toBeLessThan(setIdx);
    expect(setIdx).toBeLessThan(confirmIdx);

    const setCall = mockSetBenchRunInput.mock.calls[0][0] as {
      config: Record<string, string>;
      provider: string;
      model: string;
      size: string;
      quality: string;
      references: string[];
      promptSent: string;
    };
    expect(setCall.config).toMatchObject({
      pipeline: "manual-direto",
      formato: "1:1",
      intencao: "oferta",
      tipoConteudo: "produto",
      estrutura: "peca-unica",
      tema: "nenhum",
      modelo: "gpt-image-2",
      qualidade: "low",
    });
    expect(setCall.provider).toBe("openai");
    expect(setCall.model).toBe("gpt-image-2");
    expect(setCall.size).toBe("1024x1024");
    expect(setCall.quality).toBe("low");
    expect(setCall.references).toEqual([`bench/${RUN_ID}/inputs/0.png`]);
    expect(setCall.promptSent).toBe("prompt manual");
    expect(mockResolveBenchConfig).toHaveBeenCalled();
    expect(mockBuildBenchCampaignSnapshot).toHaveBeenCalled();
    expect(mockConfirmBenchRun).toHaveBeenCalledWith(
      expect.objectContaining({ runId: RUN_ID }),
    );
  });

  it("execução confirmada ⇒ NDJSON com exatamente 1 evento terminal e o runId", async () => {
    const res = await postRun(VALID_RUN_BODY);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");

    const text = await res.text();
    const events = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { type: string; runId?: string });
    const terminals = events.filter((event) => event.type === "done" || event.type === "error");

    expect(terminals).toHaveLength(1);
    expect(terminals[0].type).toBe("done");
    expect(terminals[0].runId).toBe(RUN_ID);
    expect(mockExecuteBenchRun).toHaveBeenCalledTimes(1);
  });

  it("falha do serviço ⇒ stream com exatamente 1 terminal de erro sanitizado", async () => {
    mockExecuteBenchRun.mockResolvedValue({
      status: "failed",
      latencyMs: 5,
      cost: null,
      errorType: "provider_error",
      errorMessage: "falha [redacted]",
    });

    const res = await postRun(VALID_RUN_BODY);
    const text = await res.text();

    const terminals = text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as { type: string })
      .filter((event) => event.type === "done" || event.type === "error");
    expect(terminals).toHaveLength(1);
    expect(terminals[0].type).toBe("error");
  });

  it("nenhum secret aparece no corpo/stream (erro do serviço é fixo)", async () => {
    mockExecuteBenchRun.mockRejectedValue(new Error("Bearer sk-abc123456789"));

    const res = await postRun(VALID_RUN_BODY);
    const text = await res.text();

    expect(text).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(text).not.toContain("Bearer ");
    expect(text).toContain("Execução falhou");
  });

  // ─── 5b. Revalidação server-side do preflight e transporte de identidade ─────

  it("composição divergente ⇒ 409 approval_invalidated antes do CAS e do provider", async () => {
    mockAssertPreflightCompositionMatches.mockImplementation(() => {
      throw new MockBenchPreflightRevalidationError("composition_diverged");
    });

    const res = await postRun(VALID_RUN_BODY);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("approval_invalidated");
    expect(mockSetBenchRunInput).not.toHaveBeenCalled();
    expect(mockConfirmBenchRun).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("evidência divergente (config/modelo/qualidade) ⇒ 409 approval_invalidated sem chamada paga", async () => {
    mockAssertPreflightEvidenceMatches.mockImplementation(() => {
      throw new MockBenchPreflightRevalidationError("config_diverged");
    });

    const res = await postRun(VALID_RUN_BODY);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("approval_invalidated");
    expect(mockConfirmBenchRun).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("identidade indisponível ⇒ 400 bench_identity_reference_unavailable antes da chamada paga", async () => {
    mockResolveBenchIdentityImageDataUrl.mockRejectedValue(
      new MockBenchIdentityTransportError("bench_identity_reference_unavailable", "logo:download_failed"),
    );

    const res = await postRun(VALID_RUN_BODY);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("bench_identity_reference_unavailable");
    expect(mockSetBenchRunInput).not.toHaveBeenCalled();
    expect(mockConfirmBenchRun).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("revalida antes do CAS e persiste as evidências RESOLVIDAS no servidor", async () => {
    const res = await postRun(VALID_RUN_BODY);
    await res.text();

    // Ordem: recomposição → fixação em draft → CAS.
    const recomposeIdx = mockRecomposeBenchPrompt.mock.invocationCallOrder[0];
    const setIdx = mockSetBenchRunInput.mock.invocationCallOrder[0];
    const confirmIdx = mockConfirmBenchRun.mock.invocationCallOrder[0];
    expect(recomposeIdx).toBeLessThan(setIdx);
    expect(setIdx).toBeLessThan(confirmIdx);

    // As evidências persistidas vêm dos valores resolvidos no servidor.
    const setCall = mockSetBenchRunInput.mock.calls[0][0] as {
      policyVersions: unknown;
      promptBaseVersion: string;
      identityReference: unknown;
      promptSent: string;
    };
    expect(setCall.policyVersions).toEqual({ intencao: "oferta-v1" });
    expect(setCall.promptBaseVersion).toBe("test-prompt-base-v1");
    expect(setCall.identityReference).toEqual({
      kind: "logo",
      variantType: "primary",
      storagePath: "logos/loja-a.png",
    });
    // `prompt_sent` permanece byte a byte o prompt aprovado.
    expect(setCall.promptSent).toBe("prompt manual");

    // A identidade resolvida é transportada ao provider (última referência).
    const execCall = mockExecuteBenchRun.mock.calls[0][0] as {
      request: { prompt: string; identityImageUrl?: string };
    };
    expect(execCall.request.prompt).toBe("prompt manual");
    expect(execCall.request.identityImageUrl).toBe("data:image/png;base64,AAAA");
  });
});

// ─── 5c. Listagem de linhagens por loja (GET /runs?storeId=...) ───────────────

describe("contrato da API da bancada — linhagens por loja", () => {
  it("GET /runs?storeId=... ⇒ 200 com múltiplas linhagens separadas via listBenchRunLineagesByStore", async () => {
    mockListBenchRunLineagesByStore.mockResolvedValue([
      { root: { ...DETAIL_RUN }, runs: [{ ...DETAIL_RUN }] },
      {
        root: { ...DETAIL_RUN, id: "55555555-5555-4555-8555-555555555555" },
        runs: [{ ...DETAIL_RUN, id: "55555555-5555-4555-8555-555555555555" }],
      },
    ]);

    const res = await getRuns();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lineages).toHaveLength(2);
    expect(body.lineages[0].rootId).toBe(RUN_ID);
    expect(body.lineages[0].runs[0].id).toBe(RUN_ID);
    expect(mockListBenchRunLineagesByStore).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: STORE_ID }),
    );

    // Manifesto validado antes de qualquer leitura por linhagem.
    const assertIdx = mockAssertBenchTestStore.mock.invocationCallOrder[0];
    const listIdx = mockListBenchRunLineagesByStore.mock.invocationCallOrder[0];
    expect(assertIdx).toBeLessThan(listIdx);
  });

  it("GET /runs sem storeId válido ⇒ 400 sem listar linhagens", async () => {
    const res = await getRuns("");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_payload");
    expect(mockListBenchRunLineagesByStore).not.toHaveBeenCalled();
  });

  it("GET /runs com loja fora do manifesto ⇒ 400 sem listar linhagens", async () => {
    mockAssertBenchTestStore.mockRejectedValue(
      new MockBenchStoreManifestError("store_not_in_manifest", OUTSIDE_STORE_ID),
    );

    const res = await getRuns(OUTSIDE_STORE_ID);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("store_not_in_manifest");
    expect(mockListBenchRunLineagesByStore).not.toHaveBeenCalled();
  });
});

// ─── 6. Detalhe (/runs/[id]) ─────────────────────────────────────────────────

describe("contrato da API da bancada — detalhe e artefatos", () => {
  it("GET /runs/[id] ⇒ 200 com configuração, prompt, latência, usage, custo com origem e URLs assinadas", async () => {
    const res = await getRun();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.run.config).toMatchObject({ pipeline: "manual-direto" });
    expect(body.run.promptSent).toBe("prompt manual");
    expect(body.run.latencyMs).toBe(12);
    expect(body.run.usage).toMatchObject({ promptTokens: 1000 });
    expect(body.run.costSource).toBe("bench_local_pricing");
    expect(body.run.costRuleVersion).toBe("2026-09-bench-1");
    // Custo estimado não é rotulado como faturado.
    expect(body.run.costDetail.is_estimate).toBe(true);
    expect(body.artifacts[0].signedUrl).toBe("https://signed.test/artifact");
    expect(body.artifacts[0].checksum).toBe("checksum-output");
    expect(mockCreateBenchArtifactSignedUrl).toHaveBeenCalled();
  });

  it("GET /runs/[id] ausente ⇒ 404 run_not_found", async () => {
    mockGetBenchRun.mockResolvedValue(null);

    const res = await getRun();

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("run_not_found");
  });

  it("GET /runs/[id] reflete a evidência do preflight", async () => {
    mockGetBenchRun.mockResolvedValue({
      ...DETAIL_RUN,
      promptBase: "prompt base",
      promptCompiled: "prompt compilado",
      promptApproved: "prompt manual",
      promptBlocks: { "INSTRUÇÕES DO PROMPT-BASE": "prompt base" },
      composerVersion: "48.2.3-prompt-composer-v1",
    });

    const res = await getRun();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.run.promptBase).toBe("prompt base");
    expect(body.run.promptCompiled).toBe("prompt compilado");
    expect(body.run.promptApproved).toBe("prompt manual");
    expect(body.run.promptBlocks).toEqual({ "INSTRUÇÕES DO PROMPT-BASE": "prompt base" });
    expect(body.run.composerVersion).toBe("48.2.3-prompt-composer-v1");
  });

  it("acesso não-admin a artefato é negado (403) sem listar/assinar", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

    const res = await getRun();

    expect(res.status).toBe(403);
    expect(mockListBenchArtifacts).not.toHaveBeenCalled();
    expect(mockCreateBenchArtifactSignedUrl).not.toHaveBeenCalled();
  });

  it("nenhum secret aparece no detalhe", async () => {
    const res = await getRun();
    const text = await res.text();

    expect(text).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(text).not.toContain("Bearer ");
    expect(text).not.toContain("AIza");
    expect(text).not.toContain("campaign-images");
  });
});

// ─── 7. Contrato de fonte (ordem de guards, paths, ausência de produção) ─────

const ROUTES_DIR = "src/app/api/admin/laboratorio/bancada";

function readRoute(relative: string): string {
  return readFileSync(path.resolve(process.cwd(), `${ROUTES_DIR}/${relative}`), "utf8");
}

describe("contrato de fonte — ordem de guards e fronteiras", () => {
  const routeFiles = [
    "stores/route.ts",
    "branding/route.ts",
    "presets/route.ts",
    "estimate/route.ts",
    "briefing/route.ts",
    "compose/route.ts",
    "inputs/route.ts",
    "runs/route.ts",
    "runs/[id]/route.ts",
  ];

  it.each(routeFiles)("%s chama await requireAdmin() antes de assertLabEnvironment()", (file) => {
    const source = readRoute(file);
    const adminIdx = source.indexOf("await requireAdmin()");
    const envIdx = source.indexOf("assertLabEnvironment()");
    expect(adminIdx).toBeGreaterThanOrEqual(0);
    expect(envIdx).toBeGreaterThan(adminIdx);
    expect(source).toContain("labEnvironmentDeniedBody(error.reason)");
  });

  it("branding/estimate validam o manifesto antes de qualquer leitura com storeId", () => {
    const branding = readRoute("branding/route.ts");
    expect(branding.indexOf("await assertBenchTestStore(")).toBeLessThan(
      branding.indexOf("await loadBenchBranding("),
    );
    const estimate = readRoute("estimate/route.ts");
    expect(estimate.indexOf("await assertBenchTestStore(")).toBeLessThan(
      estimate.indexOf("resolveBenchCost("),
    );
  });

  it("briefing/compose validam o manifesto antes de qualquer leitura com storeId", () => {
    const briefing = readRoute("briefing/route.ts");
    expect(briefing.indexOf("await assertBenchTestStore(")).toBeLessThan(
      briefing.indexOf("await loadBenchBranding("),
    );
    const compose = readRoute("compose/route.ts");
    expect(compose.indexOf("await assertBenchTestStore(")).toBeLessThan(
      compose.indexOf("await loadBenchBranding("),
    );
  });

  it("compose compõe pelo compositor puro e não dispara geração paga", () => {
    const source = readRoute("compose/route.ts");
    expect(source).toContain("composePromptBlocks");
    expect(source).toContain("COMPOSER_VERSION");
    expect(source).toContain("buildBenchExperimentalBriefing");
    expect(source).not.toContain("executeBenchRun");
    expect(source).not.toContain("campaign-images");
  });

  it("runs exige preflight aprovado e envia exatamente o prompt aprovado", () => {
    const source = readRoute("runs/route.ts");
    expect(source).toContain("preflight");
    expect(source).toContain("promptApproved");
    expect(source).toContain("promptCompiled");
    expect(source).toContain("composerVersion");
  });

  it("branding usa o signer restrito e nunca o signer de artefatos", () => {
    const source = readRoute("branding/route.ts");
    expect(source).toContain("createBenchBrandingSignedUrl");
    expect(source).not.toContain("createArtifactSignedUrl");
  });

  it("branding apenas renova o descritor selecionado (não re-resolve identidade)", () => {
    const source = readRoute("branding/route.ts");
    expect(source).toContain("identityReference");
    // A decisão de qual asset corresponde ao estado é de loadBenchBranding.
    expect(source).not.toContain("resolveBenchIdentity");
    expect(source).not.toContain("first signedUrl");
  });

  it("estimate usa o resolvedor local da bancada", () => {
    expect(readRoute("estimate/route.ts")).toContain("resolveBenchCost");
  });

  it("inputs reserva em draft, persiste entradas com finalizeRun e nunca toca campaign-images", () => {
    const source = readRoute("inputs/route.ts");
    expect(source).toContain("reserveBenchRun");
    expect(source).toContain("persistBenchArtifact");
    expect(source).toContain("finalizeRun: (args) => finalizeBenchRun({ client, ...args })");
    expect(source).not.toContain("campaign-images");
  });

  it("runs resolve o draft, fixa a configuração, confirma o CAS e emite NDJSON", () => {
    const source = readRoute("runs/route.ts");
    expect(source).toContain("confirmation_required");
    expect(source).toContain("bench_run_already_active");
    expect(source).toContain("preset_not_enabled");
    expect(source).toContain("application/x-ndjson");
    expect(source).toContain("getBenchRunByOperationId");
    expect(source).toContain("setBenchRunInput");
    expect(source).toContain("confirmBenchRun");
    expect(source).toContain("assertBenchTestStore");
    expect(source).toContain("loadBenchBranding");
    expect(source).toContain("buildBenchCampaignSnapshot");
    expect(source).toContain("resolveBenchConfig");
    expect(source).toContain("resolveBenchPreset");
    // Não cria run na confirmação e não lê `preset.config`.
    expect(source).not.toContain("reserveBenchRun");
    expect(source).not.toContain("preset.config");
  });

  it("runs/[id] assina os artefatos pelo signer do laboratório", () => {
    const source = readRoute("runs/[id]/route.ts");
    expect(source).toContain("createBenchArtifactSignedUrl");
    expect(source).toContain("listBenchArtifacts");
  });

  it("runs revalida o preflight, transporta a identidade e lista linhagens", () => {
    const source = readRoute("runs/route.ts");
    expect(source).toContain("approval_invalidated");
    expect(source).toContain("bench_identity_reference_unavailable");
    expect(source).toContain("recomposeBenchPrompt");
    expect(source).toContain("assertPreflightCompositionMatches");
    expect(source).toContain("assertPreflightEvidenceMatches");
    expect(source).toContain("resolveServerResolvedEvidence");
    expect(source).toContain("resolveBenchIdentityImageDataUrl");
    expect(source).toContain("listBenchRunLineagesByStore");
    expect(source).toContain("export const GET");
  });

  it("nenhuma rota da bancada toca a produção (campaign-images/prompts/ai_model_selection)", () => {
    for (const file of routeFiles) {
      const source = readRoute(file);
      expect(source).not.toContain("campaign-images");
      expect(source).not.toContain("generation_events");
      expect(source).not.toContain("ai_model_selection");
    }
  });
});
