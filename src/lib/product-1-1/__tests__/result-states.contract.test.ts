// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const { mockStorageDownload } = vi.hoisted(() => ({ mockStorageDownload: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { storage: { from: () => ({ download: mockStorageDownload }) } },
  createServerClient: vi.fn(),
}));

const { mockRequireOwnership } = vi.hoisted(() => ({ mockRequireOwnership: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(() =>
    Promise.resolve({ userId: "00000000-0000-4000-8000-000000000001" }),
  ),
}));
vi.mock("@/lib/auth/store-ownership", () => ({ requireOwnership: mockRequireOwnership }));

const { mockGetCampaign, mockListArtVersions } = vi.hoisted(() => ({
  mockGetCampaign: vi.fn(),
  mockListArtVersions: vi.fn(),
}));
vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: mockGetCampaign,
  listArtVersions: mockListArtVersions,
}));

vi.mock("@/lib/campaign/display", () => ({
  computeApprovalState: vi.fn(() => ({ status: "not_enabled" })),
  isDeliveryReleased: vi.fn(() => true),
}));

const { mockApprovalEnabled } = vi.hoisted(() => ({ mockApprovalEnabled: vi.fn() }));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: mockApprovalEnabled,
}));

const { mockGetCampaignOperation } = vi.hoisted(() => ({ mockGetCampaignOperation: vi.fn() }));
vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    getCampaignOperation(campaignId: string) {
      return mockGetCampaignOperation(campaignId);
    }
  },
}));

const { mockProbeArtifact, mockGetSignedArtifactUrl } = vi.hoisted(() => ({
  mockProbeArtifact: vi.fn(),
  mockGetSignedArtifactUrl: vi.fn(),
}));
vi.mock("@/lib/product-1-1/artifact/artifact-store", () => ({
  ProductOneToOneArtifactStore: class {
    probeArtifact(input: unknown) {
      return mockProbeArtifact(input);
    }
    getSignedArtifactUrl(storagePath: string) {
      return mockGetSignedArtifactUrl(storagePath);
    }
  },
}));

import { decideNewFlowDownload } from "../artifact/download-gate";
import type { ArtifactProbe } from "../artifact/types";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 06: estados de resultado do novo fluxo.
// (a) Portão de download PURO (B1B-D6 / C2 / I3): libera SOMENTE `delivered` +
//     objeto `integral`; `art_uploaded` sozinho NÃO libera; erro de Storage NÃO
//     é ausência; a URL assinada só é gerada após o portão liberar.
// (b) Rota `[id]/download`: ramo novo ADDITIVO + fail-closed, ramo legado
//     (F37 + storage) preservado byte a byte.
// Contract test estático + simulado, sem banco, provider, crédito ou Storage.
// ---------------------------------------------------------------------------

const ROUTE_FILE = "src/app/api/campaign/[id]/download/route.ts";
const ROUTE_ABS = path.resolve(process.cwd(), ROUTE_FILE);

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const STORE_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const NEW_FLOW_PATH = `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`;

function integralProbe(): ArtifactProbe {
  return {
    kind: "integral",
    ref: {
      storagePath: NEW_FLOW_PATH,
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
    },
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    storagePath: NEW_FLOW_PATH,
  };
}

describe("decideNewFlowDownload — portão puro do novo fluxo (B1B-D6 / C2 / I3)", () => {
  it("libera SOMENTE `delivered` + objeto `integral`", () => {
    const decision = decideNewFlowDownload({
      operationStatus: "delivered",
      artifactProbe: integralProbe(),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.storagePath).toBe(NEW_FLOW_PATH);
  });

  it("`reserved`/`art_uploaded` com objeto íntegro ⇒ recusa (arte salva NÃO libera)", () => {
    for (const status of ["reserved", "art_uploaded"] as const) {
      const decision = decideNewFlowDownload({
        operationStatus: status,
        artifactProbe: integralProbe(),
      });
      expect(decision.allowed, status).toBe(false);
      expect(decision.storagePath, status).toBeNull();
    }
  });

  it("`delivered` sem objeto íntegro ⇒ recusa (C2 — erro de Storage bloqueia, nunca ausência)", () => {
    for (const kind of ["absent", "invalid", "indeterminate"] as const) {
      const decision = decideNewFlowDownload({
        operationStatus: "delivered",
        artifactProbe: { kind } as ArtifactProbe,
      });
      expect(decision.allowed, kind).toBe(false);
      expect(decision.storagePath, kind).toBeNull();
    }
  });

  it("resultado desconhecido persistido (não terminal) ⇒ recusa", () => {
    const decision = decideNewFlowDownload({
      operationStatus: "reserved",
      unknown: true,
      artifactProbe: integralProbe(),
    });
    expect(decision.allowed).toBe(false);

    const artUploadedUnknown = decideNewFlowDownload({
      operationStatus: "art_uploaded",
      unknown: true,
      artifactProbe: integralProbe(),
    });
    expect(artUploadedUnknown.allowed).toBe(false);
  });

  it("I2 — precedência terminal: `delivered` prevalece sobre o marcador histórico `unknown`", () => {
    const decision = decideNewFlowDownload({
      operationStatus: "delivered",
      unknown: true,
      artifactProbe: integralProbe(),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.storagePath).toBe(NEW_FLOW_PATH);
  });
});

function makeRequest(): NextRequest {
  return new NextRequest(
    new Request(`http://localhost/api/campaign/${CAMPAIGN_ID}/download`, {
      method: "GET",
    }),
  );
}

async function callRoute() {
  const { GET } = await import("@/app/api/campaign/[id]/download/route");
  return GET(makeRequest(), { params: Promise.resolve({ id: CAMPAIGN_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCampaign.mockResolvedValue({
    id: CAMPAIGN_ID,
    store_id: STORE_ID,
    storage_path: `${STORE_ID}/${CAMPAIGN_ID}.jpg`,
    product_name: "Produto Teste",
    created_at: "2026-01-01T00:00:00.000Z",
  });
  mockListArtVersions.mockResolvedValue([]);
  mockRequireOwnership.mockResolvedValue(undefined);
  mockApprovalEnabled.mockResolvedValue(false);
  mockGetCampaignOperation.mockResolvedValue(null);
  mockStorageDownload.mockResolvedValue({
    data: new Uint8Array([1, 2, 3]),
    error: null,
  });
  mockProbeArtifact.mockResolvedValue(integralProbe());
  mockGetSignedArtifactUrl.mockResolvedValue("https://signed.example/art-1024.jpg");
});

describe("GET /api/campaign/[id]/download — portão do novo fluxo (I3 fail-closed)", () => {
  it("I3: `art_uploaded` com objeto íntegro ⇒ 403 e NENHUMA URL assinada gerada", async () => {
    mockGetCampaignOperation.mockResolvedValue({
      operationId: OPERATION_ID,
      status: "art_uploaded",
      unknown: false,
      terminal: false,
    });

    const res = await callRoute();

    expect(res.status).toBe(403);
    expect(mockProbeArtifact).toHaveBeenCalledWith({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
    expect(mockGetSignedArtifactUrl).not.toHaveBeenCalled();
  });

  it("I3: `reserved` com objeto íntegro ⇒ 403 e NENHUMA URL assinada gerada", async () => {
    mockGetCampaignOperation.mockResolvedValue({
      operationId: OPERATION_ID,
      status: "reserved",
      unknown: false,
      terminal: false,
    });

    const res = await callRoute();

    expect(res.status).toBe(403);
    expect(mockGetSignedArtifactUrl).not.toHaveBeenCalled();
  });

  it("I3: `delivered` + objeto `absent` ⇒ 403 e NENHUMA URL assinada gerada", async () => {
    mockGetCampaignOperation.mockResolvedValue({
      operationId: OPERATION_ID,
      status: "delivered",
      unknown: false,
      terminal: true,
    });
    mockProbeArtifact.mockResolvedValue({ kind: "absent" });

    const res = await callRoute();

    expect(res.status).toBe(403);
    expect(mockGetSignedArtifactUrl).not.toHaveBeenCalled();
  });

  it("I3: `delivered` + `indeterminate` ⇒ 403 (erro de Storage NÃO é ausência) sem assinar", async () => {
    mockGetCampaignOperation.mockResolvedValue({
      operationId: OPERATION_ID,
      status: "delivered",
      unknown: false,
      terminal: true,
    });
    mockProbeArtifact.mockResolvedValue({ kind: "indeterminate" });

    const res = await callRoute();

    expect(res.status).toBe(403);
    expect(mockGetSignedArtifactUrl).not.toHaveBeenCalled();
  });

  it("`delivered` + objeto `integral` ⇒ assina a URL DEPOIS do portão liberar", async () => {
    mockGetCampaignOperation.mockResolvedValue({
      operationId: OPERATION_ID,
      status: "delivered",
      unknown: false,
      terminal: true,
    });

    const res = await callRoute();

    expect(mockGetSignedArtifactUrl).toHaveBeenCalledWith(NEW_FLOW_PATH);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toBe("https://signed.example/art-1024.jpg");
  });

  it("campanha legada (operação `null`) ⇒ caminho anterior byte-compatível (F37 + storage)", async () => {
    const res = await callRoute();

    expect(res.status).toBe(200);
    expect(mockProbeArtifact).not.toHaveBeenCalled();
    expect(mockGetSignedArtifactUrl).not.toHaveBeenCalled();
    expect(mockStorageDownload).toHaveBeenCalledWith(`${STORE_ID}/${CAMPAIGN_ID}.jpg`);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("campanha legada com gate F37 ativo ⇒ 403 sem baixar (comportamento anterior)", async () => {
    mockApprovalEnabled.mockResolvedValue(true);
    const { isDeliveryReleased } = await import("@/lib/campaign/display");
    (isDeliveryReleased as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const res = await callRoute();

    expect(res.status).toBe(403);
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });
});

describe("GET /api/campaign/[id]/download — classificação PERSISTIDA do fluxo (correção)", () => {
  it("(a) marcador PERSISTIDO presente + leitura da operação FALHA ⇒ fail-closed 503 (sem legado, sem assinatura)", async () => {
    mockGetCampaign.mockResolvedValue({
      id: CAMPAIGN_ID,
      store_id: STORE_ID,
      storage_path: `${STORE_ID}/${CAMPAIGN_ID}.jpg`,
      product_name: "Produto Teste",
      created_at: "2026-01-01T00:00:00.000Z",
      // Marcador do NOVO fluxo PERSISTIDO no input_snapshot (chave presente).
      input_snapshot: { frozenContentReferences: [] },
    });
    // RPC ausente/erro: NÃO pode ser tratada como "operação ausente".
    mockGetCampaignOperation.mockRejectedValue(new Error("function does not exist"));

    const res = await callRoute();

    expect(res.status).toBe(503);
    expect(mockProbeArtifact).not.toHaveBeenCalled();
    expect(mockGetSignedArtifactUrl).not.toHaveBeenCalled();
    // NUNCA cai no ramo legado.
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });

  it("(b) LEGADO PROVADO (marcador AUSENTE) + leitura da operação falha ⇒ legado ainda servido", async () => {
    mockGetCampaign.mockResolvedValue({
      id: CAMPAIGN_ID,
      store_id: STORE_ID,
      storage_path: `${STORE_ID}/${CAMPAIGN_ID}.jpg`,
      product_name: "Produto Teste",
      created_at: "2026-01-01T00:00:00.000Z",
      // Snapshot legado SEM o marcador do novo fluxo.
      input_snapshot: { productName: "Produto Teste" },
    });
    mockGetCampaignOperation.mockRejectedValue(new Error("RPC missing"));

    const res = await callRoute();

    expect(res.status).toBe(200);
    expect(mockStorageDownload).toHaveBeenCalledWith(`${STORE_ID}/${CAMPAIGN_ID}.jpg`);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(mockGetSignedArtifactUrl).not.toHaveBeenCalled();
  });

  it("(c) marcador presente + operação LEGÍVEL ⇒ o portão do novo fluxo GOVERNA", async () => {
    mockGetCampaign.mockResolvedValue({
      id: CAMPAIGN_ID,
      store_id: STORE_ID,
      storage_path: `${STORE_ID}/${CAMPAIGN_ID}.jpg`,
      product_name: "Produto Teste",
      created_at: "2026-01-01T00:00:00.000Z",
      input_snapshot: { frozenContentReferences: [] },
    });
    mockGetCampaignOperation.mockResolvedValue({
      operationId: OPERATION_ID,
      status: "art_uploaded",
      unknown: false,
      terminal: false,
    });

    const res = await callRoute();

    expect(res.status).toBe(403);
    expect(mockGetSignedArtifactUrl).not.toHaveBeenCalled();
    expect(mockStorageDownload).not.toHaveBeenCalled();
  });
});

describe("rota download — preservação do ramo legado (source)", () => {
  const source = readFileSync(ROUTE_ABS, "utf8");

  it("mantém o gate F37 (`isCampaignApprovalEnabled` + `isDeliveryReleased`) e o storage legado", () => {
    expect(source).toContain("isCampaignApprovalEnabled");
    expect(source).toContain("isDeliveryReleased");
    expect(source).toContain('from("campaign-images")');
    expect(source).toContain(".download(");
  });

  it("o ramo novo é aditivo e fail-closed: assina SOMENTE após `decideNewFlowDownload`", () => {
    const decisionIdx = source.indexOf("decideNewFlowDownload(");
    const signIdx = source.indexOf("getSignedArtifactUrl(");
    const f37Idx = source.indexOf("await isCampaignApprovalEnabled()");
    const rejectIdx = source.indexOf("decision.allowed");

    expect(decisionIdx).toBeGreaterThan(-1);
    expect(signIdx).toBeGreaterThan(decisionIdx);
    expect(rejectIdx).toBeGreaterThan(decisionIdx);
    expect(rejectIdx).toBeLessThan(signIdx);
    // O ramo novo (detecção de operação) precede o gate legado da F37.
    expect(source.indexOf("getCampaignOperation(")).toBeLessThan(f37Idx);
  });
});

describe("estados de resultado da UI — Surface 2/3 (âmbar ≠ falha)", () => {
  const progressSource = readFileSync(
    path.resolve(process.cwd(), "src/components/flow/generation-progress.tsx"),
    "utf8",
  );
  const panelSource = readFileSync(
    path.resolve(process.cwd(), "src/components/flow/unknown-result-panel.tsx"),
    "utf8",
  );

  it("GenerationProgress: variant `unknown` âmbar com AlertTriangle, distinto da falha vermelha", () => {
    expect(progressSource).toMatch(/variant/);
    expect(progressSource).toMatch(/accent-amber/);
    expect(progressSource).toMatch(/AlertTriangle/);
    expect(progressSource).toMatch(/accent-blue/);
    expect(progressSource).toMatch(/accent-red/);
    expect(progressSource).toContain("Não foi possível confirmar a conclusão desta geração");
    expect(progressSource).not.toContain("Gerar novamente");
  });

  it("GenerationProgress: mensagens de estado exatas (running/done/failure)", () => {
    expect(progressSource).toContain("Gerando a campanha...");
    expect(progressSource).toContain("Campanha gerada.");
    expect(progressSource).toContain("A geração falhou.");
  });

  it("UnknownResultPanel: título/corpo exatos, âmbar, referência em mono e sem 'Gerar novamente'", () => {
    expect(panelSource).toContain(
      "Não foi possível confirmar a conclusão desta geração",
    );
    expect(panelSource).toContain(
      "Você pode verificar novamente ou falar com o suporte. Verificar novamente não inicia outra geração nem cobra outro crédito.",
    );
    expect(panelSource).toContain("Referência de suporte:");
    expect(panelSource).toContain("Verificar novamente");
    expect(panelSource).toContain("Falar com o suporte");
    expect(panelSource).toContain("font-mono");
    expect(panelSource).toMatch(/accent-amber/);
    expect(panelSource).toMatch(/AlertTriangle/);
    expect(panelSource).toMatch(/role="alert"/);
    expect(panelSource).not.toContain("Gerar novamente");
  });

  it("UnknownResultPanel: 'Verificar novamente' consulta a rota de status (query-only), sem gerar", () => {
    expect(panelSource).toContain("/api/campaign/generation-status");
    expect(panelSource).not.toMatch(/generate-image/);
  });
});
