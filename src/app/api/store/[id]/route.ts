import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import { resolveStoreIdentity } from "@/lib/actions/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: store, error } = await supabase
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

  // Resolve visual signature and brand profile data for frontend hydration
  const identity = await resolveStoreIdentity(store);

  return NextResponse.json({
    ...store,
    visual_signature_url: identity.visualSignatureUrl,
    logo_url: identity.logoUrl ?? store.logo_url,
  }, { status: 200 });
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

  // Store direction fields (Phase 4.4.1)
  if (body.subsegment !== undefined) {
    updates.subsegment = typeof body.subsegment === 'string' ? body.subsegment.trim() || null : null;
  }

  if (body.tone_of_voice !== undefined) {
    updates.tone_of_voice = typeof body.tone_of_voice === 'string' ? body.tone_of_voice : null;
  }

  if (body.positioning !== undefined) {
    updates.positioning = typeof body.positioning === 'string' ? body.positioning.trim() || null : null;
  }

  if (body.short_description !== undefined) {
    updates.short_description = typeof body.short_description === 'string' ? body.short_description.trim() || null : null;
  }

  if (body.slogan !== undefined) {
    updates.slogan = typeof body.slogan === 'string' ? body.slogan.trim() || null : null;
  }

  if (body.logo_status !== undefined) {
    const VALID_STATUSES = ['uploaded', 'generated', 'explicit_none', 'failed', 'exhausted'];
    if (body.logo_status !== null && !VALID_STATUSES.includes(body.logo_status as string)) {
      return NextResponse.json(
        { error: `logo_status deve ser um de: ${VALID_STATUSES.join(', ')}, ou null` },
        { status: 400 }
      );
    }
    updates.logo_status = body.logo_status;
  }

  if (body.visual_signature_attempts !== undefined) {
    if (typeof body.visual_signature_attempts !== 'number' || !Number.isInteger(body.visual_signature_attempts) || body.visual_signature_attempts < 0) {
      return NextResponse.json(
        { error: 'visual_signature_attempts deve ser um inteiro não negativo' },
        { status: 400 }
      );
    }
    updates.visual_signature_attempts = body.visual_signature_attempts;
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
