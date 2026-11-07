import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const {
  mockRequireAdmin,
  mockAssertLabEnvironment,
  MockLabEnvironmentError,
  mockResolveBenchPreset,
  MockBenchPresetError,
  mockAssertBenchTestStore,
  MockBenchStoreManifestError,
  mockGetBenchRunByOperationId,
  mockSetBenchRunInput,
  mockConfirmBenchRun,
  MockBenchRunError,
  mockExecuteBenchRun,
  mockValidateArtifactTechnically,
  mockSupabaseAdmin,
} = vi.hoisted(() => {
  class MockLabEnvironmentError extends Error {
    readonly reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  }
  class MockBenchPresetError extends Error {
    readonly code = "preset_not_enabled";
    readonly reason?: string;
    constructor(_id: string, reason?: string) {
      super(reason ?? "preset_not_enabled");
      this.reason = reason;
    }
  }
  class MockBenchStoreManifestError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  class MockBenchRunError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    mockRequireAdmin: vi.fn(),
    mockAssertLabEnvironment: vi.fn(),
    MockLabEnvironmentError,
    mockResolveBenchPreset: vi.fn(),
    MockBenchPresetError,
    mockAssertBenchTestStore: vi.fn(),
    MockBenchStoreManifestError,
    mockGetBenchRunByOperationId: vi.fn(),
    mockSetBenchRunInput: vi.fn(),
    mockConfirmBenchRun: vi.fn(),
    MockBenchRunError,
    mockExecuteBenchRun: vi.fn(),
    mockValidateArtifactTechnically: vi.fn(),
    mockSupabaseAdmin: {
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
}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock("@/lib/lab/bench/domain/preset-registry", () => ({
  resolveBenchPreset: (...args: unknown[]) => mockResolveBenchPreset(...args),
  BenchPresetError: MockBenchPresetError,
}));
vi.mock("@/lib/lab/bench/domain/store-manifest", () => ({
  assertBenchTestStore: (...args: unknown[]) => mockAssertBenchTestStore(...args),
  BenchStoreManifestError: MockBenchStoreManifestError,
}));
vi.mock("@/lib/lab/bench/persistence/bench-run-service", () => ({
  getBenchRunByOperationId: (...args: unknown[]) => mockGetBenchRunByOperationId(...args),
  setBenchRunInput: (...args: unknown[]) => mockSetBenchRunInput(...args),
  confirmBenchRun: (...args: unknown[]) => mockConfirmBenchRun(...args),
  BenchRunError: MockBenchRunError,
}));
vi.mock("@/lib/lab/bench/execution/bench-execution-service", () => ({
  executeBenchRun: (...args: unknown[]) => mockExecuteBenchRun(...args),
}));
vi.mock("@/lib/lab/bench/gateway/runtime", () => ({
  createBenchGateway: vi.fn(() => ({})),
  createBenchAdapterRegistry: vi.fn(() => ({})),
}));
vi.mock("@/lib/lab/gateway/runtime", () => ({
  createLabTelemetryContext: vi.fn(() => ({})),
}));
vi.mock("@/lib/ai/lab-telemetry-sink", () => ({
  LabTelemetrySink: class {
    readonly entries: unknown[] = [];
    constructor(_options?: unknown) {}
  },
}));
vi.mock("@/lib/ai", () => ({
  defaultAiModelResolver: { resolve: vi.fn(), listCapabilities: () => [] },
}));
vi.mock("@/lib/lab/technical-validation", () => ({
  validateArtifactTechnically: (...args: unknown[]) => mockValidateArtifactTechnically(...args),
}));

import { POST } from "@/app/api/admin/laboratorio/bancada/expand/runs/route";
import { DEFAULT_EXPAND_9_16_PROMPT } from "@/lib/lab/bench/domain/expand-prompt";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const STORE_ID = "33333333-3333-4333-8333-333333333333";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "44444444-4444-4444-8444-444444444444";

const PRESET = {
  id: "gpt-image-2.5-sunburst-medium",
  label: "GPT Image 2.5 Sunburst · medium",
  capability: "campaign_image",
  provider: "openai",
  protocol: "images",
  model: "gpt-image-2.5-sunburst",
  quality: "medium",
  size: "1024x1024",
  enabled: true,
} as const;

const VALID_BODY = {
  operationId: OPERATION_ID,
  runId: RUN_ID,
  storeId: STORE_ID,
  presetId: PRESET.id,
  promptApproved: DEFAULT_EXPAND_9_16_PROMPT,
  references: [`bench/${RUN_ID}/inputs/0.jpg`],
  confirmed: true,
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/admin/laboratorio/bancada/expand/runs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: USER_ID });
  mockAssertLabEnvironment.mockReturnValue({ enabled: true });
  mockResolveBenchPreset.mockReturnValue(PRESET);
  mockAssertBenchTestStore.mockResolvedValue({
    id: STORE_ID,
    name: "Padaria da Esquina",
    segment: "padaria",
  });
  mockGetBenchRunByOperationId.mockResolvedValue({
    id: RUN_ID,
    operationId: OPERATION_ID,
    status: "draft",
    createdBy: USER_ID,
    config: { operation: "expand" },
  });
  mockSetBenchRunInput.mockResolvedValue(undefined);
  mockConfirmBenchRun.mockResolvedValue(undefined);
  mockExecuteBenchRun.mockResolvedValue({
    status: "succeeded",
    latencyMs: 1,
    cost: null,
  });
  mockValidateArtifactTechnically.mockResolvedValue({
    decodable: true,
    mimeType: "image/jpeg",
    width: 1152,
    height: 1440,
    bytes: 3,
    aspectRatio: 4 / 5,
    uniform: false,
    emptyOrCorrupt: false,
    alerts: [],
    structuredOutputValid: null,
    ocrAlert: null,
  });
});

describe("POST /expand/runs — operação isolada", () => {
  it("executa uma única imagem, sem identidade e com prompt aprovado byte a byte", async () => {
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"type":"done"');

    const setCall = mockSetBenchRunInput.mock.calls[0][0] as Record<string, unknown>;
    expect(setCall).toMatchObject({
      runId: RUN_ID,
      promptApproved: DEFAULT_EXPAND_9_16_PROMPT,
      promptSent: DEFAULT_EXPAND_9_16_PROMPT,
      references: [`bench/${RUN_ID}/inputs/0.jpg`],
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      size: "1152x2048",
    });
    expect(setCall.config).toMatchObject({
      operation: "expand",
      formato: "9:16",
      promptVersion: "261107-expand-9-16-v1",
    });
    expect(setCall).not.toHaveProperty("promptCompiled");
    expect(setCall).not.toHaveProperty("promptBase");
    expect(setCall).not.toHaveProperty("composerVersion");
    expect(setCall).not.toHaveProperty("policyVersions");
    expect(setCall).not.toHaveProperty("identityReference");

    expect(mockExecuteBenchRun).toHaveBeenCalledTimes(1);
    const execCall = mockExecuteBenchRun.mock.calls[0][0] as {
      request: Record<string, unknown>;
    };
    expect(execCall.request.productImagesDataUrls).toHaveLength(1);
    expect(execCall.request).not.toHaveProperty("identityImageUrl");
    expect(execCall.request.prompt).toBe(DEFAULT_EXPAND_9_16_PROMPT);
    expect(execCall.request.size).toBe("1152x2048");
    expect(execCall.request.expectedWidth).toBe(1152);
    expect(execCall.request.expectedHeight).toBe(2048);
  });

  it("recusa confirmação ausente antes de qualquer leitura/execução", async () => {
    const { confirmed: _confirmed, ...withoutConfirmation } = VALID_BODY;
    const response = await POST(request(withoutConfirmation));
    expect(response.status).toBe(422);
    expect(mockGetBenchRunByOperationId).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("recusa 1024×1024 com width_mismatch sem executar", async () => {
    mockValidateArtifactTechnically.mockResolvedValue({
      decodable: true,
      mimeType: "image/png",
      width: 1024,
      height: 1024,
      bytes: 3,
      aspectRatio: 1,
      uniform: false,
      emptyOrCorrupt: false,
      alerts: [],
      structuredOutputValid: null,
      ocrAlert: null,
    });
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("bench_expand_geometry_unsupported");
    expect(body.reason).toBe("width_mismatch");
    expect(mockConfirmBenchRun).not.toHaveBeenCalled();
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("recusa 1152×2048 como no_expansion_needed", async () => {
    mockValidateArtifactTechnically.mockResolvedValue({
      decodable: true,
      mimeType: "image/png",
      width: 1152,
      height: 2048,
      bytes: 3,
      aspectRatio: 9 / 16,
      uniform: false,
      emptyOrCorrupt: false,
      alerts: [],
      structuredOutputValid: null,
      ocrAlert: null,
    });
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("bench_expand_not_needed");
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("run terminal é idempotente e não executa de novo", async () => {
    mockGetBenchRunByOperationId.mockResolvedValue({
      id: RUN_ID,
      operationId: OPERATION_ID,
      status: "succeeded",
      createdBy: USER_ID,
    });
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ idempotent: true, runId: RUN_ID });
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("recusa draft marcado como campanha (isolamento de operação)", async () => {
    mockGetBenchRunByOperationId.mockResolvedValue({
      id: RUN_ID,
      operationId: OPERATION_ID,
      status: "draft",
      createdBy: USER_ID,
      config: { operation: "campaign" },
    });
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("bench_operation_mismatch");
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });

  it("promptVersion divergente é recusado", async () => {
    const response = await POST(
      request({ ...VALID_BODY, promptVersion: "outra-versao" }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "bench_expand_prompt_version_mismatch",
    );
    expect(mockExecuteBenchRun).not.toHaveBeenCalled();
  });
});
