import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";
import { VALID_SEGMENTS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, segment, city, state, brand_color, logo_url } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60) {
    return NextResponse.json(
      { error: "name is required and must be between 2 and 60 characters" },
      { status: 400 }
    );
  }

  if (!segment || typeof segment !== "string" || !VALID_SEGMENTS.includes(segment as typeof VALID_SEGMENTS[number])) {
    return NextResponse.json(
      { error: `segment is required and must be one of: ${VALID_SEGMENTS.join(", ")}` },
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
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
