import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import { STORE_SEGMENTS, STORE_SUBSEGMENTS } from "@/lib/constants";

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

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, segment, city, state, brand_color, logo_url, subsegment, tone_of_voice, positioning, short_description, slogan } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60) {
    return NextResponse.json(
      { error: "name is required and must be between 2 and 60 characters" },
      { status: 400 }
    );
  }

  const validSegmentValues = STORE_SEGMENTS.map(s => s.value) as string[];
  if (!segment || typeof segment !== "string" || !validSegmentValues.includes(segment)) {
    return NextResponse.json(
      { error: `segment is required and must be one of: ${validSegmentValues.join(", ")}` },
      { status: 400 }
    );
  }

  // Subsegment validation
  let effectiveSubsegment: string | null = null;
  if (subsegment !== undefined && subsegment !== null && subsegment !== "") {
    if (typeof subsegment !== "string") {
      return NextResponse.json({ error: "subsegment inválido" }, { status: 400 });
    }

    const segmentKey = segment as keyof typeof STORE_SUBSEGMENTS;
    const segmentSubs = STORE_SUBSEGMENTS[segmentKey] ?? [];
    const trimmed = subsegment.trim();
    const isPredefined = segmentSubs.some(s => s.value === trimmed.toLowerCase());

    if (isPredefined) {
      effectiveSubsegment = trimmed.toLowerCase();
    } else {
      if (trimmed.toLowerCase() === "outro") {
        return NextResponse.json({ error: "Valor inválido para subsegmento" }, { status: 400 });
      }

      const subError = validateSubsegment(subsegment);
      if (subError) {
        return NextResponse.json({ error: subError }, { status: 400 });
      }

      effectiveSubsegment = sanitizeSubsegment(subsegment);
    }
  } else if (segment === "outros") {
    return NextResponse.json({ error: "Subsegmento obrigatório para segmento outros" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("stores")
    .insert({
      name: name.trim(),
      segment,
      city: typeof city === "string" ? city : null,
      state: typeof state === "string" ? state : null,
      brand_color: typeof brand_color === "string" ? brand_color : null,
      logo_url: typeof logo_url === "string" ? logo_url : null,
      subsegment: effectiveSubsegment,
      tone_of_voice: typeof tone_of_voice === "string" ? tone_of_voice : null,
      positioning: typeof positioning === "string" ? positioning.trim() || null : null,
      short_description: typeof short_description === "string" ? short_description.trim() || null : null,
      slogan: typeof slogan === "string" ? slogan.trim() || null : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
