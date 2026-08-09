import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(500).optional(),
});

// POST /api/admin/access-requests/[id]
// Muda o status via RPC atômico admin_review_access_request (status + admin_audit_log
// na mesma transação). A rota NÃO insere em admin_audit_log diretamente.
export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const admin = await requireAdmin();
    requireSameOrigin(request);
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { action, notes } = parsed.data;

    const { data, error } = await supabaseAdmin.rpc(
      "admin_review_access_request",
      {
        p_request_id: id,
        p_action: action,
        p_actor_id: admin.userId,
        p_notes: notes ?? null,
      },
    );

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("request_not_found") || msg.includes("already_reviewed")) {
        return NextResponse.json(
          { error: "Solicitação não encontrada ou já revisada" },
          { status: 404 },
        );
      }
      console.error("admin_review_access_request error:", error);
      return NextResponse.json(
        { error: "Erro ao revisar solicitação" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      status: action === "approve" ? "approved" : "rejected",
    });
  },
);
