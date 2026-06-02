import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import {
  validateImage,
  getImageDimensions,
  checkMinimumDimensions,
  computeChecksum,
  generateAllVariants,
} from '@/lib/brand-assets/image-processing';
import { BrandDirectorService } from '@/lib/brand-assets/brand-director';
import type { BrandAssetRecord, BrandAssetVariantGroup } from '@/lib/brand-assets/types';

const ALLOWED_EXTENSION_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

async function handlePostUpload(request: NextRequest, storeId: string) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Dados do formulário inválidos' }, { status: 400 });
  }

  const file = formData.get('logo') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.slice(fileName.lastIndexOf('.'));
  if (!ALLOWED_EXTENSION_MAP[fileExtension]) {
    return NextResponse.json({ error: 'Formatos aceitos: PNG, JPG ou WEBP.' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5MB.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const validation = await validateImage(buffer);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error ?? 'Arquivo de imagem inválido' }, { status: 400 });
  }

  const dimensions = await getImageDimensions(buffer);
  const dimCheck = checkMinimumDimensions(dimensions.width, dimensions.height);
  if (!dimCheck.valid) {
    return NextResponse.json({ error: dimCheck.error ?? `A imagem deve ter no mínimo 200x200 pixels.` }, { status: 400 });
  }

  const checksum = computeChecksum(buffer);
  const mimeType = validation.mimeType ?? 'image/png';
  const ext = MIME_TO_EXTENSION[mimeType] ?? '.png';
  const fileUuid = crypto.randomUUID();
  const storagePath = `${storeId}/original/${fileUuid}${ext}`;

  const { data: maxVersion } = await supabase
    .from('store_brand_assets')
    .select('version')
    .eq('store_id', storeId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxVersion?.version ?? 0) + 1;

  await supabase
    .from('store_brand_assets')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('store_id', storeId)
    .eq('status', 'active');

  await supabase
    .from('store_brand_profiles')
    .update({ status: 'outdated', updated_at: new Date().toISOString() })
    .eq('store_id', storeId)
    .eq('status', 'synced');

  const { error: uploadError } = await supabase
    .storage
    .from('store-brand-assets')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Erro ao fazer upload: ${uploadError.message}` }, { status: 500 });
  }

  const { data: originalAsset, error: insertError } = await supabase
    .from('store_brand_assets')
    .insert({
      store_id: storeId,
      asset_type: 'logo',
      variant_type: 'original',
      source: 'user_upload',
      parent_asset_id: null,
      storage_path: storagePath,
      mime_type: mimeType,
      width: dimensions.width,
      height: dimensions.height,
      size_bytes: buffer.length,
      checksum,
      version: nextVersion,
      status: 'active',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: `Erro ao registrar asset: ${insertError.message}` }, { status: 500 });
  }

  const variantResults = await generateAllVariants(buffer);
  const variantRecords: BrandAssetRecord[] = [];

  for (const result of variantResults) {
    if (result.success) {
      const variantStoragePath = `${storeId}/${result.variant_type}/${fileUuid}.png`;

      const { error: variantUploadError } = await supabase
        .storage
        .from('store-brand-assets')
        .upload(variantStoragePath, result.buffer, { contentType: 'image/png', upsert: false });

      if (variantUploadError) {
        const { data: failedRecord } = await supabase
          .from('store_brand_assets')
          .insert({
            store_id: storeId,
            asset_type: 'logo',
            variant_type: result.variant_type,
            source: 'system_generated',
            parent_asset_id: originalAsset.id,
            storage_path: null,
            mime_type: 'image/png',
            width: 0,
            height: 0,
            size_bytes: 0,
            checksum: '',
            version: nextVersion,
            status: 'failed',
            metadata: { error: `Storage upload failed: ${variantUploadError.message}` },
          })
          .select()
          .single();

        if (failedRecord) variantRecords.push(failedRecord);
      } else {
        const { data: variantRecord, error: variantInsertError } = await supabase
          .from('store_brand_assets')
          .insert({
            store_id: storeId,
            asset_type: 'logo',
            variant_type: result.variant_type,
            source: 'system_generated',
            parent_asset_id: originalAsset.id,
            storage_path: variantStoragePath,
            mime_type: 'image/png',
            width: result.width,
            height: result.height,
            size_bytes: result.size_bytes,
            checksum: computeChecksum(result.buffer),
            version: nextVersion,
            status: 'active',
          })
          .select()
          .single();

        if (variantRecord) variantRecords.push(variantRecord);
      }
    } else {
      const { data: failedRecord } = await supabase
        .from('store_brand_assets')
        .insert({
          store_id: storeId,
          asset_type: 'logo',
          variant_type: result.variant_type,
          source: 'system_generated',
          parent_asset_id: originalAsset.id,
          storage_path: null,
          mime_type: 'image/png',
          width: 0,
          height: 0,
          size_bytes: 0,
          checksum: '',
          version: nextVersion,
          status: 'failed',
          metadata: { error: result.error },
        })
        .select()
        .single();

      if (failedRecord) variantRecords.push(failedRecord);
    }
  }

  const { data: store } = await supabase
    .from('stores')
    .select()
    .eq('id', storeId)
    .single();

  let createdProfile = null;
  if (store) {
    try {
      const director = new BrandDirectorService();
      const analysis = await director.analyze({
        logoBuffer: buffer,
        logoMimeType: mimeType,
        storeData: {
          storeName: store.name,
          segment: store.segment,
          subsegment: store.subsegment,
          city: store.city,
          state: store.state,
          tone_of_voice: store.tone_of_voice,
          positioning: store.positioning,
          short_description: store.short_description,
          slogan: store.slogan,
        },
      });

      const { data: profile } = await supabase
        .from('store_brand_profiles')
        .insert({
          store_id: storeId,
          source: 'logo_analysis',
          active_logo_asset_id: originalAsset.id,
          logo_colors_detected: analysis.logo_colors_detected,
          brand_colors_chosen: analysis.logo_colors_detected,
          safe_color_tokens: analysis.safe_color_tokens,
          visual_style: analysis.visual_style,
          visual_tone: analysis.visual_tone,
          typography_direction: analysis.typography_direction,
          brand_personality: analysis.brand_personality,
          campaign_guidelines: analysis.campaign_guidelines,
          campaign_brief: analysis.campaign_brief,
          confidence_score: analysis.confidence_score,
          status: 'synced',
        })
        .select()
        .single();

      createdProfile = profile;
    } catch {
      const { data: failedProfile } = await supabase
        .from('store_brand_profiles')
        .insert({
          store_id: storeId,
          source: 'logo_analysis',
          active_logo_asset_id: originalAsset.id,
          status: 'failed',
          metadata: { error: 'Brand Director analysis failed during upload' },
        })
        .select()
        .single();

      createdProfile = failedProfile;
    }
  }

  return NextResponse.json({
    originalAsset,
    variants: variantRecords,
    profile: createdProfile,
    version: nextVersion,
  }, { status: 201 });
}

async function handleGetActiveLogo(_request: NextRequest, storeId: string) {
  const { data: assets } = await supabase
    .from('store_brand_assets')
    .select()
    .eq('store_id', storeId)
    .eq('status', 'active');

  const { data: profile } = await supabase
    .from('store_brand_profiles')
    .select()
    .eq('store_id', storeId)
    .eq('status', 'synced')
    .maybeSingle();

  if (!assets || assets.length === 0) {
    return NextResponse.json({ assets: null, profile: profile ?? null }, { status: 200 });
  }

  const grouped: BrandAssetVariantGroup = {
    original: assets.find((a: BrandAssetRecord) => a.variant_type === 'original') ?? null,
    normalized: assets.find((a: BrandAssetRecord) => a.variant_type === 'normalized') ?? null,
    on_light: assets.find((a: BrandAssetRecord) => a.variant_type === 'on_light') ?? null,
    on_dark: assets.find((a: BrandAssetRecord) => a.variant_type === 'on_dark') ?? null,
    square_safe: assets.find((a: BrandAssetRecord) => a.variant_type === 'square_safe') ?? null,
    horizontal_safe: assets.find((a: BrandAssetRecord) => a.variant_type === 'horizontal_safe') ?? null,
  };

  return NextResponse.json({ assets: grouped, profile: profile ?? null }, { status: 200 });
}

async function handleGetVersions(_request: NextRequest, storeId: string) {
  const { data: versions } = await supabase
    .from('store_brand_assets')
    .select('version, created_at, status')
    .eq('store_id', storeId)
    .eq('variant_type', 'original')
    .order('version', { ascending: false })
    .limit(50);

  return NextResponse.json({ versions: versions ?? [] }, { status: 200 });
}

async function handleDeleteLogo(_request: NextRequest, storeId: string) {
  await supabase
    .from('store_brand_assets')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('store_id', storeId)
    .eq('status', 'active');

  await supabase
    .from('store_brand_profiles')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('store_id', storeId)
    .eq('status', 'synced');

  return NextResponse.json({ message: 'Logo removido com sucesso' }, { status: 200 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validateUUID(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }
  return handlePostUpload(request, id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validateUUID(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (path.endsWith('/versions')) {
    return handleGetVersions(request, id);
  }

  return handleGetActiveLogo(request, id);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!validateUUID(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }
  return handleDeleteLogo(request, id);
}
