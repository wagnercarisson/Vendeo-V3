import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { apiHandler } from "@/lib/auth/api-handler";
import { markReportReviewedBySupport } from "@/lib/campaign/correction-reports";

export const dynamic = "force-dynamic";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// POST /api/admin/campaign-reports/[reportId]
// Marcação ORTOGONAL "revisado pelo suporte" (F37.2 R6): atualiza apenas
// reviewed_by_support_at/reviewed_by_support_user — não altera status do caso,
// rejection_count, versões nem aprovação.
export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ reportId: string }> }
  ) => {
    const admin = await requireAdmin();
    requireSameOrigin(request);

    const { reportId } = await params;
    if (!UUID_V4_REGEX.test(reportId)) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
    }

    await markReportReviewedBySupport(reportId, admin.userId);

    return NextResponse.json({ success: true });
  }
);
