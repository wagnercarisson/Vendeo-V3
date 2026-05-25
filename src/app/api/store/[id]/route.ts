import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("stores")
    .select()
    .eq("id", id)
    .single();

  if (error && error.code === "PGRST116") {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 60) {
      return NextResponse.json(
        { error: "name must be between 2 and 60 characters" },
        { status: 400 }
      );
    }
    updates.name = body.name.trim();
  }

  if (body.segment !== undefined) {
    const { VALID_SEGMENTS } = await import("@/lib/constants");
    if (typeof body.segment !== "string" || !VALID_SEGMENTS.includes(body.segment as typeof VALID_SEGMENTS[number])) {
      return NextResponse.json(
        { error: `segment must be one of: ${VALID_SEGMENTS.join(", ")}` },
        { status: 400 }
      );
    }
    updates.segment = body.segment;
  }

  if (body.city !== undefined) {
    updates.city = typeof body.city === "string" ? body.city : null;
  }

  if (body.state !== undefined) {
    updates.state = typeof body.state === "string" ? body.state : null;
  }

  if (body.brand_color !== undefined) {
    updates.brand_color = typeof body.brand_color === "string" ? body.brand_color : null;
  }

  if (body.logo_url !== undefined) {
    updates.logo_url = typeof body.logo_url === "string" ? body.logo_url : null;
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("stores")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error && error.code === "PGRST116") {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
