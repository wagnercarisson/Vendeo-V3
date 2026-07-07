import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireSameOrigin } from "@/lib/auth/csrf";

export async function POST(request: NextRequest) {
  requireSameOrigin(request);
  const supabase = await createServerClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");

  return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 },
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 },
  );
}
