import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import { resolveStoreIdentity } from "@/lib/actions/store";
import { STORE_SUBSEGMENTS } from "@/lib/constants";

const GENERIC_SUBSEGMENT_VALUES = ["outro", "loja", "comercio", "comércio", "varejo"];

function validateSubsegment(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 3) return "Digite ao menos 3 caracteres";
  if (trimmed.length > 30) return "Máximo de 30 caracteres";
  if (!/^[A-Za-zÀ-ü\s]+$/.test(trimmed)) return "Use apenas letras e espaços";
  if (GENERIC_SUBSEGMENT_VALUES.includes(trimmed.toLowerCase())) return "Valor genérico não permitido";
  return null;
}

function sanitizeSubsegment(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(w => w.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("-"))
    .join(" ");
}

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
    const { STORE_SEGMENTS } = await import("@/lib/constants");
    const validSegmentValues = STORE_SEGMENTS.map(s => s.value) as string[];
    if (typeof body.segment !== "string" || !validSegmentValues.includes(body.segment)) {
      return NextResponse.json(
        { error: `segment must be one of: ${validSegmentValues.join(", ")}` },
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
    if (body.subsegment === null || body.subsegment === "") {
      updates.subsegment = null;
    } else {
      if (typeof body.subsegment !== "string") {
        return NextResponse.json({ error: "subsegment inválido" }, { status: 400 });
      }

      const seg = (body.segment as string) || (updates.segment as string);
      const segmentKey = seg as keyof typeof STORE_SUBSEGMENTS;
      const segmentSubs = seg ? (STORE_SUBSEGMENTS[segmentKey] ?? []) : [];
      const trimmed = body.subsegment.trim();
      const isPredefined = segmentSubs.some(s => s.value === trimmed.toLowerCase());

      if (isPredefined) {
        updates.subsegment = trimmed.toLowerCase();
      } else {
        if (trimmed.toLowerCase() === "outro") {
          return NextResponse.json({ error: "Valor inválido para subsegmento" }, { status: 400 });
        }

        const subError = validateSubsegment(body.subsegment);
        if (subError) {
          return NextResponse.json({ error: subError }, { status: 400 });
        }

        updates.subsegment = sanitizeSubsegment(body.subsegment);
      }
    }
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
