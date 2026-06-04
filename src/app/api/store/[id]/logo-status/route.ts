import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_LOGO_STATUSES = [
  'uploaded',
  'generated',
  'explicit_none',
  'failed',
  'exhausted',
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  let body: { logo_status?: string; visual_signature_attempts?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.logo_status && body.visual_signature_attempts === undefined) {
    return NextResponse.json(
      { error: 'Forneça ao menos um campo: logo_status ou visual_signature_attempts' },
      { status: 400 }
    );
  }

  if (body.logo_status !== undefined) {
    if (body.logo_status !== null && !VALID_LOGO_STATUSES.includes(body.logo_status)) {
      return NextResponse.json(
        {
          error: `logo_status deve ser um de: ${VALID_LOGO_STATUSES.join(', ')}, ou null`,
        },
        { status: 400 }
      );
    }
  }

  if (body.visual_signature_attempts !== undefined) {
    if (!Number.isInteger(body.visual_signature_attempts) || body.visual_signature_attempts < 0) {
      return NextResponse.json(
        { error: 'visual_signature_attempts deve ser um inteiro não negativo' },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.logo_status !== undefined) updates.logo_status = body.logo_status;
  if (body.visual_signature_attempts !== undefined) {
    updates.visual_signature_attempts = body.visual_signature_attempts;
  }

  const { data, error } = await supabase
    .from('stores')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error && error.code === 'PGRST116') {
    return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}
