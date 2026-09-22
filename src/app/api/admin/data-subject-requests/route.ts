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
    const { data, error } = await supabaseAdmin.rpc("admin_register_data_subject_request", {
      p_actor_id: admin.userId, p_operation_id: operationId, p_type: input.type,
      p_user_id: input.userId ?? null, p_store_id: input.storeId ?? null,
      p_contact: input.contact, p_details: input.details,
      p_deletion_inventory: input.deletionInventory ?? {}, p_legal_hold: input.legalHold ?? false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: data }, { status: 201 });
  }

  if (!input.id || !input.nextStatus) return NextResponse.json({ error: "Transição inválida" }, { status: 400 });
  const transitionOperationId = input.operationId ?? crypto.randomUUID();
  const { data, error } = await supabaseAdmin.rpc("admin_transition_data_subject_request", {
    p_actor_id: admin.userId, p_request_id: input.id, p_operation_id: transitionOperationId,
    p_next_status: input.nextStatus, p_deletion_inventory: input.deletionInventory ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  if (data?.rejected) return NextResponse.json({ error: "Cancelamento permitido somente em received" }, { status: 409 });
  return NextResponse.json({ request: data });
});
