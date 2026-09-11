// @vitest-environment jsdom
// F37.2 (tasks.md §16, 16.6): fila administrativa — listagem com filtros e
// decisão corrente (maior attempt_number), detalhe v1 × v2 com histórico por
// attempt_number, aprovação derivada e marcação ortogonal "revisado".
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
const mockListCorrectionReports = vi.fn();
const mockGetCorrectionReportDetail = vi.fn();
const mockMarkReportReviewedBySupport = vi.fn();
const mockRequireSameOrigin = vi.fn();
const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: vi.fn(async (...args: unknown[]) => mockRequireAdmin(...args)),
}));

vi.mock("@/lib/campaign/correction-reports", () => ({
  listCorrectionReports: vi.fn(async (...args: unknown[]) =>
    mockListCorrectionReports(...args)
  ),
  getCorrectionReportDetail: vi.fn(async (...args: unknown[]) =>
    mockGetCorrectionReportDetail(...args)
  ),
  markReportReviewedBySupport: vi.fn(async (...args: unknown[]) =>
    mockMarkReportReviewedBySupport(...args)
  ),
}));

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn((...args: unknown[]) => mockRequireSameOrigin(...args)),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

const NEXT_CONTROL = new Error("NEXT_CONTROL");
const mockNotFound = vi.fn(() => {
  throw NEXT_CONTROL;
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
  notFound: () => mockNotFound(),
}));

vi.mock("@/lib/formatters", () => ({
  formatDateTimeBR: () => "01/09/2026 10:00",
}));

import AdminCampaignReportsPage from "@/app/(app)/admin/campaign-reports/page";
import AdminCampaignReportDetailPage from "@/app/(app)/admin/campaign-reports/[reportId]/page";
import { POST as markReviewedPost } from "@/app/api/admin/campaign-reports/[reportId]/route";

const REPORT_ID = "770e8400-e29b-41d4-a716-446655440002";
const CAMPAIGN_ID = "550e8400-e29b-41d4-a716-446655440000";

function reportFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    campaign_id: CAMPAIGN_ID,
    store_id: "store-123",
    reported_version_id: "version-1",
    generated_version_id: null,
    status: "open",
    generation_started_at: null,
    operation_run_id: "run-1",
    reviewed_by_support_at: null,
    reviewed_by_support_user: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function submissionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    report_id: REPORT_ID,
    attempt_number: 1,
    text: "o preço saiu cortado",
    analysis_state: "unclear",
    category: null,
    normalized_instruction: null,
    analysis_expires_at: "2026-09-01T10:02:00Z",
    created_at: "2026-09-01T10:00:00Z",
    completed_at: "2026-09-01T10:00:30Z",
    ...overrides,
  };
}

function versionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-1",
    campaign_id: CAMPAIGN_ID,
    version_number: 1,
    status: "pending",
    storage_path: "store-123/camp.jpg",
    asset_status: "active",
    asset_deleted_at: null,
    brief_snapshot: {},
    render_snapshot: null,
    generation_metadata: null,
    rejection_reason: null,
    correction_in_progress: false,
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function detailFixture(overrides: Record<string, unknown> = {}) {
  return {
    report: reportFixture(),
    submissions: [submissionFixture()],
    versions: [versionFixture()],
    signedUrls: { "version-1": "https://signed/v1.jpg" },
    approval: { approvedVersionId: null, approvedAt: null },
    ...overrides,
  };
}

function markReviewedRequest(id: string = REPORT_ID): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/admin/campaign-reports/${id}`,
    {
      method: "POST",
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockRequireSameOrigin.mockImplementation(() => {});
  mockListCorrectionReports.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  mockGetCorrectionReportDetail.mockResolvedValue(null);
  mockMarkReportReviewedBySupport.mockResolvedValue(undefined);
  global.fetch = vi.fn();
});

describe("16.6 — listagem admin de relatos de correção", () => {
  it("exibe casos com decisão corrente da tentativa de maior attempt_number", async () => {
    mockListCorrectionReports.mockResolvedValue({
      items: [
        {
          report: reportFixture(),
          currentSubmission: submissionFixture({
            attempt_number: 2,
            analysis_state: "eligible",
            category: "truncated_element",
            normalized_instruction: "Reenquadrar o preço",
          }),
        },
        {
          report: reportFixture({
            id: "report-2",
            campaign_id: "880e8400-e29b-41d4-a716-446655440003",
            reviewed_by_support_at: "2026-09-02T10:00:00Z",
          }),
          currentSubmission: submissionFixture({
            id: "sub-2",
            report_id: "report-2",
            attempt_number: 1,
            analysis_state: "blocked",
          }),
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });

    render(
      await AdminCampaignReportsPage({ searchParams: Promise.resolve({}) })
    );

    expect(
      screen.getByRole("heading", { name: "Relatos de correção" })
    ).toBeInTheDocument();
    expect(screen.getByText("Elegível (#2)")).toBeInTheDocument();
    expect(screen.getByText("Bloqueado (#1)")).toBeInTheDocument();
    // "Revisado" aparece no cabeçalho e na linha revisada do caso 2
    expect(screen.getAllByText("Revisado").length).toBeGreaterThanOrEqual(2);
    expect(mockListCorrectionReports).toHaveBeenCalledWith({
      filters: {},
      page: 1,
      pageSize: 20,
    });
  });

  it("repassa os filtros status/analysisState/reviewed e a página", async () => {
    render(
      await AdminCampaignReportsPage({
        searchParams: Promise.resolve({
          status: "open",
          analysisState: "eligible",
          reviewed: "unreviewed",
          page: "2",
        }),
      })
    );

    expect(mockListCorrectionReports).toHaveBeenCalledWith({
      filters: {
        status: "open",
        analysisState: "eligible",
        reviewed: "unreviewed",
      },
      page: 2,
      pageSize: 20,
    });
  });

  it("não-admin → acesso negado sem consultar casos", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("forbidden"));

    render(
      await AdminCampaignReportsPage({ searchParams: Promise.resolve({}) })
    );

    expect(screen.getByText(/Acesso negado/i)).toBeInTheDocument();
    expect(mockListCorrectionReports).not.toHaveBeenCalled();
  });
});

describe("16.6 — detalhe v1 × v2 com histórico e aprovação derivada", () => {
  it("exibe v1/v2, tentativas por attempt_number e aprovação derivada", async () => {
    mockGetCorrectionReportDetail.mockResolvedValue(
      detailFixture({
        report: reportFixture({
          status: "v2_generated",
          generated_version_id: "version-2",
          generation_started_at: "2026-09-01T10:05:00Z",
        }),
        submissions: [
          submissionFixture({ attempt_number: 1, analysis_state: "unclear" }),
          submissionFixture({
            id: "sub-2",
            attempt_number: 2,
            analysis_state: "eligible",
            category: "truncated_element",
            normalized_instruction: "Reenquadrar o preço",
          }),
        ],
        versions: [
          versionFixture({
            id: "version-1",
            version_number: 1,
            asset_status: "superseded",
          }),
          versionFixture({
            id: "version-2",
            version_number: 2,
            asset_status: "active",
          }),
        ],
        signedUrls: {
          "version-1": "https://signed/v1.jpg",
          "version-2": "https://signed/v2.jpg",
        },
      })
    );

    render(
      await AdminCampaignReportDetailPage({
        params: Promise.resolve({ reportId: REPORT_ID }),
      })
    );

    expect(screen.getByText("Versões (v1 × v2)")).toBeInTheDocument();
    expect(screen.getByAltText("Versão 1")).toHaveAttribute(
      "src",
      "https://signed/v1.jpg"
    );
    expect(screen.getByAltText("Versão 2")).toHaveAttribute(
      "src",
      "https://signed/v2.jpg"
    );
    expect(screen.getByText("Tentativa #1")).toBeInTheDocument();
    expect(screen.getByText("Tentativa #2")).toBeInTheDocument();
    expect(screen.getByText(/Reenquadrar o preço/)).toBeInTheDocument();
    expect(screen.getByText("Não aprovada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "run-1" })).toHaveAttribute(
      "href",
      "/admin/ai-operation-costs?operationRunId=run-1"
    );
  });

  it("mostra aprovação derivada de campaigns quando aprovada", async () => {
    mockGetCorrectionReportDetail.mockResolvedValue(
      detailFixture({
        approval: {
          approvedVersionId: "version-2",
          approvedAt: "2026-09-03T10:00:00Z",
        },
      })
    );

    render(
      await AdminCampaignReportDetailPage({
        params: Promise.resolve({ reportId: REPORT_ID }),
      })
    );

    expect(screen.getByText(/Aprovada — version/)).toBeInTheDocument();
    // a marcação "revisado" é ortogonal à aprovação: continua disponível
    expect(
      screen.getByRole("button", { name: "Marcar como revisado" })
    ).toBeInTheDocument();
  });

  it("detalhe inexistente → notFound()", async () => {
    mockGetCorrectionReportDetail.mockResolvedValue(null);

    await expect(
      AdminCampaignReportDetailPage({
        params: Promise.resolve({ reportId: REPORT_ID }),
      })
    ).rejects.toThrow("NEXT_CONTROL");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("marca como revisado via botão ortogonal (POST + refresh)", async () => {
    mockGetCorrectionReportDetail.mockResolvedValue(detailFixture());
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      await AdminCampaignReportDetailPage({
        params: Promise.resolve({ reportId: REPORT_ID }),
      })
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Marcar como revisado" })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/admin/campaign-reports/${REPORT_ID}`,
        { method: "POST" }
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

describe("16.6 — marcação revisado (rota admin, ortogonal)", () => {
  it("POST marca revisado pelo suporte com o usuário admin", async () => {
    const res = await markReviewedPost(markReviewedRequest(), {
      params: Promise.resolve({ reportId: REPORT_ID }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(mockMarkReportReviewedBySupport).toHaveBeenCalledWith(
      REPORT_ID,
      "admin-1"
    );
  });

  it("POST reportId inválido → 400 (serviço não chamado)", async () => {
    const res = await markReviewedPost(markReviewedRequest("not-a-uuid"), {
      params: Promise.resolve({ reportId: "not-a-uuid" }),
    });

    expect(res.status).toBe(400);
    expect(mockMarkReportReviewedBySupport).not.toHaveBeenCalled();
  });
});
