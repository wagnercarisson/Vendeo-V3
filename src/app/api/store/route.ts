import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import { STORE_SEGMENTS } from "@/lib/constants";

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

  const { data, error } = await supabase
    .from("stores")
    .insert({
      name: name.trim(),
      segment,
      city: typeof city === "string" ? city : null,
      state: typeof state === "string" ? state : null,
      brand_color: typeof brand_color === "string" ? brand_color : null,
      logo_url: typeof logo_url === "string" ? logo_url : null,
      subsegment: typeof subsegment === "string" ? subsegment.trim() || null : null,
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
