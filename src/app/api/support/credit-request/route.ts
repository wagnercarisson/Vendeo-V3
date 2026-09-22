import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ProductEventService } from "@/lib/product-events/service";

const Schema = z.object({ operationId: z.string().uuid(), message: z.string().trim().max(2000).optional() });

export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);
  const { userId, claims } = await requireApiUser();
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const email = typeof claims.email === "string" ? claims.email : null;
  const { data: store } = await supabaseAdmin.from("stores").select("id,name,segment").eq("user_id", userId).maybeSingle();
  if (!store) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  const { data, error } = await supabaseAdmin.rpc("create_support_credit_request", {
    p_operation_id: parsed.data.operationId, p_store_id: store.id, p_user_id: userId,
    p_requested_email: email, p_snapshot: { store_name: store.name, segment: store.segment, message: parsed.data.message ?? null },
    p_support_email: process.env.SUPPORT_EMAIL ?? "suporte@vendeo.tech",
  });
  if (error) return NextResponse.json({ error: "Não foi possível registrar a solicitação" }, { status: 500 });
  const result = data as { protocol: string; received_at: string };
  void new ProductEventService().record("support_credit_request", { store_id: store.id, user_id: userId, dedup_key: parsed.data.operationId, properties: { protocol: result.protocol, received_at: result.received_at } });
  return NextResponse.json({ protocol: result.protocol, receivedAt: result.received_at });
});
