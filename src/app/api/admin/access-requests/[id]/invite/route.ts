import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { apiHandler } from "@/lib/auth/api-handler";
import { sendAccessInvite } from "@/lib/access-requests/invite";

// POST /api/admin/access-requests/[id]/invite
// Reenvia o convite de uma solicitação já aprovada, sem reaprová-la.
export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const admin = await requireAdmin();
    requireSameOrigin(request);
    const { id } = await params;

    const result = await sendAccessInvite({
      requestId: id,
      actorId: admin.userId,
      trigger: "resend",
    });

    if (result.reason === "not_found") {
      return NextResponse.json(
        { error: "Solicitação não encontrada" },
        { status: 404 },
      );
    }

    if (result.reason === "not_approved") {
      return NextResponse.json(
        { error: "Somente solicitações aprovadas podem receber convite" },
        { status: 409 },
      );
    }

    if (result.reason === "locked") {
      return NextResponse.json(
        { error: "Já existe um envio de convite em andamento. Aguarde." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: result.ok,
      invite: result.outcome,
    });
  },
);
