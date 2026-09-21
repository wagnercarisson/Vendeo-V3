import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireAdmin } from "@/lib/admin/require-admin";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";

const Types = z.enum(["access", "export", "correction", "deletion", "closure"]);
const Actions = z.enum(["in_progress", "completed", "cancelled"]);
const Body = z.object({
  action: z.enum(["register", "transition"]),
  id: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  type: Types.optional(),
  userId: z.string().uuid().nullable().optional(),
  storeId: z.string().uuid().nullable().optional(),
  contact: z.string().trim().min(1).max(254).optional(),
  details: z.string().trim().min(1).max(2000).optional(),
  deletionInventory: z.record(z.string(), z.unknown()).optional(),
  legalHold: z.boolean().optional(),
  nextStatus: Actions.optional(),
});

function auditPayload(row: Record<string, unknown>, attemptedStatus: string) {
  return {
    operation_id: row.operation_id,
    protocol: row.protocol,
    type: row.type,
    user_id: row.user_id,
    store_id: row.store_id,
    contact: row.contact,
    details: row.details,
    deletion_inventory: row.deletion_inventory,
    legal_hold: row.legal_hold,
    attempted_status: attemptedStatus,
  };
}

export const GET = apiHandler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("data_subject_requests")
    .select("*")
    .order("requested_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ requests: data ?? [] });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);
  const body = request.headers.get("content-type")?.includes("application/json")
    ? await request.json().catch(() => null)
    : Object.fromEntries((await request.formData()).entries());
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const input = parsed.data;

  if (input.action === "register") {
    if (!input.type || !input.contact || !input.details) return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    const operationId = input.operationId ?? crypto.randomUUID();
    const protocol = `DSR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${operationId.slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    const row = {
      operation_id: operationId, protocol, type: input.type, user_id: input.userId ?? null,
      store_id: input.storeId ?? null, contact: input.contact, details: input.details,
      status: "received", requested_at: now, acknowledged_at: now, due_at: null,
      closure_requested_at: input.type === "closure" ? now : null,
      deletion_due_at: input.type === "closure" ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
      deletion_inventory: input.deletionInventory ?? {}, legal_hold: input.legalHold ?? false,
    };
    const { data, error } = await supabaseAdmin.from("data_subject_requests").upsert(row, { onConflict: "operation_id" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from("admin_audit_log").insert({ actor_id: admin.userId, action: "data_subject_request_received", target_type: "data_subject_request", target_id: data.id, operation_id: operationId, reason: "Registro de pedido de titular", metadata: auditPayload(data, "received") });
    return NextResponse.json({ request: data }, { status: 201 });
  }

  if (!input.id || !input.nextStatus) return NextResponse.json({ error: "Transição inválida" }, { status: 400 });
  const { data: current, error: readError } = await supabaseAdmin.from("data_subject_requests").select("*").eq("id", input.id).maybeSingle();
  if (readError || !current) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (input.nextStatus === "cancelled" && current.status !== "received") {
    await supabaseAdmin.from("admin_audit_log").insert({ actor_id: admin.userId, action: "data_subject_request_cancel_rejected", target_type: "data_subject_request", target_id: current.id, operation_id: current.operation_id, reason: "Cancelamento após início da exclusão", metadata: auditPayload(current, "cancelled") });
    return NextResponse.json({ error: "Cancelamento permitido somente em received" }, { status: 409 });
  }
  if (input.nextStatus === "in_progress" && current.status !== "received") return NextResponse.json({ error: "Transição inválida" }, { status: 409 });
  if (input.nextStatus === "completed" && current.status !== "in_progress") return NextResponse.json({ error: "Conclua após iniciar o processamento" }, { status: 409 });
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.nextStatus };
  if (input.nextStatus === "cancelled") patch.cancelled_at = now;
  if (input.nextStatus === "completed") { patch.completed_at = now; patch.deletion_inventory = input.deletionInventory ?? current.deletion_inventory; }
  const { data, error } = await supabaseAdmin.from("data_subject_requests").update(patch).eq("id", current.id).eq("status", current.status).select().single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Conflito de transição" }, { status: 409 });
  await supabaseAdmin.from("admin_audit_log").insert({ actor_id: admin.userId, action: `data_subject_request_${input.nextStatus}`, target_type: "data_subject_request", target_id: data.id, operation_id: data.operation_id, reason: "Transição de ciclo de vida", metadata: auditPayload(data, input.nextStatus) });
  return NextResponse.json({ request: data });
});
