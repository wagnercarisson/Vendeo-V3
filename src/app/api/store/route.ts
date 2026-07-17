import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import { requireUser, requireApiUser, UnauthorizedError } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { apiHandler } from "@/lib/auth/api-handler";
import { buildStoreResponse } from "@/lib/store-response";
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

export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, segment, city, state, brand_color, logo_url, subsegment, tone_of_voice, positioning, short_description, slogan } = body as Record<string, unknown>;

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

    const { data, error } = await supabase.rpc("create_store_with_initial_grant", {
      p_name: (name as string).trim(),
      p_segment: segment as string,
      p_user_id: user.userId,
      p_city: typeof city === "string" ? city : null,
      p_state: typeof state === "string" ? state : null,
      p_brand_color: typeof brand_color === "string" ? brand_color : null,
      p_logo_url: typeof logo_url === "string" ? logo_url : null,
      p_subsegment: effectiveSubsegment,
      p_tone_of_voice: typeof tone_of_voice === "string" ? tone_of_voice : null,
      p_positioning: typeof positioning === "string" ? positioning.trim() || null : null,
      p_short_description: typeof short_description === "string" ? short_description.trim() || null : null,
      p_slogan: typeof slogan === "string" ? slogan.trim() || null : null,
    });

    if (error?.message?.includes("stores_user_id_key") || error?.code === "23505") {
      return NextResponse.json(
        { error: "Usuário já possui uma loja" },
        { status: 409 }
      );
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
});

export const GET = apiHandler(async (_request: NextRequest) => {
  try {
    const user = await requireApiUser();
    const store = await getCurrentStore(user.userId);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const data = await buildStoreResponse(store);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
});
