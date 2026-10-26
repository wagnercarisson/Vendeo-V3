import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CURRENT_PRIVACY_NOTICE_VERSION } from "@/lib/legal/current-versions";
import {
  isRetryableAdminNoticeStatus,
  notifyAdminOfAccessRequest,
} from "@/lib/access-requests/admin-notice";

const AccessRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(100).optional(),
  store_name: z.string().trim().max(100).optional(),
  segment: z.string().trim().max(50).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  privacy_notice_version: z.literal(CURRENT_PRIVACY_NOTICE_VERSION),
});

// POST público (sem requireUser) — visitantes da landing solicitam acesso free.
// Anti-enumeração: novo e duplicado retornam exatamente o mesmo { ok: true } 200.
export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);

  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await request.json().catch(() => null)
    : contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")
      ? Object.fromEntries((await request.formData()).entries())
      : null;
  const parsed = AccessRequestSchema.safeParse(body);
  if (!parsed.success) {
    // 400 genérico — sem detalhar o campo (anti-enumeração de esquema)
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { email, name, store_name, segment, whatsapp, privacy_notice_version } = parsed.data;

  // Anti-duplicidade: email com solicitação pending/approved não gera segundo registro
  const { data: existing } = await supabaseAdmin
    .from("access_requests")
    .select("id, admin_notice_status")
    .eq("email", email)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existing) {
    // Duplicata NÃO cria novo aviso; apenas tenta retomar o MESMO aviso se ele
    // ainda estiver pendente/falho. `sent` e histórico (null) são ignorados.
    const noticeStatus = (existing as { admin_notice_status?: string | null })
      .admin_notice_status;
    if (isRetryableAdminNoticeStatus(noticeStatus)) {
      try {
        await notifyAdminOfAccessRequest(existing.id as string);
      } catch {
        console.error("[access-requests] admin notice retry failed", {
          code: "notice_exception",
        });
      }
    }
    // Resposta idêntica ao sucesso — não revela a existência do email
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("access_requests")
    .insert({
      email,
      name: name || null,
      store_name: store_name || null,
      segment: segment || null,
      whatsapp: whatsapp || null,
      privacy_notice_version,
      source: "landing",
      // Novo registro = aviso interno pendente. Histórico permanece NULL
      // (nenhum backfill/notificação de solicitações antigas).
      admin_notice_status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("access-request insert error:", error);
    return NextResponse.json(
      { error: "Erro ao registrar solicitação" },
      { status: 500 },
    );
  }

  // A solicitação já está persistida. O aviso é aguardado (não fire-and-forget)
  // e qualquer falha fica registrada no estado durável, sem mudar a resposta
  // pública de sucesso.
  if (inserted?.id) {
    try {
      await notifyAdminOfAccessRequest(inserted.id as string);
    } catch {
      console.error("[access-requests] admin notice failed", {
        code: "notice_exception",
      });
    }
  } else {
    console.error("[access-requests] insert confirmed without id", {
      code: "missing_insert_id",
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
});
