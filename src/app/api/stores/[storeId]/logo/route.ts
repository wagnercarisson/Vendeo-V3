import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const { storeId } = await params;

  if (!UUID_REGEX.test(storeId)) {
    return NextResponse.json(
      { error: "ID da loja inválido" },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar formulário" },
      { status: 400 }
    );
  }

  const file = formData.get("logo") as File | null;
  if (!file) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado" },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return NextResponse.json(
      { error: "Formato de arquivo inválido. Use PNG, JPEG ou WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Máximo 2MB." },
      { status: 400 }
    );
  }

  const ext = MIME_EXTENSIONS[file.type] || "png";
  const uuid = crypto.randomUUID();
  const storagePath = `${storeId}/${uuid}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("store-logos")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Erro ao fazer upload: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from("store-logos")
    .getPublicUrl(storagePath);

  const { data: store, error: updateError } = await supabase
    .from("stores")
    .update({
      logo_url: publicUrlData.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", storeId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: `Erro ao atualizar loja: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json(store, { status: 200 });
}
