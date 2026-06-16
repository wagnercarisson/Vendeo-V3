import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { BrandDirectorService, BrandDirectorAnalysisError } from '@/lib/brand-assets/brand-director';
import { BrandTextOnlyInferenceService } from '@/lib/brand-assets/text-only-inference-service';
import { IDENTITY_TO_LOGO_STATUS } from '@/lib/constants';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const realignLocks = new Map<string, boolean>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID da loja inválido' }, { status: 400 });
  }

  if (realignLocks.get(id)) {
    return NextResponse.json(
      { error: 'Realinhamento já em andamento para esta loja. Aguarde.' },
      { status: 429 },
    );
  }

  realignLocks.set(id, true);

  try {
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select()
      .eq('id', id)
      .single();

    if (storeError || !store) {
      realignLocks.delete(id);
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }

    const { data: logoAsset } = await supabase
      .from('store_brand_assets')
      .select()
      .eq('store_id', id)
      .eq('variant_type', 'original')
      .eq('status', 'active')
      .maybeSingle();

    const { data: currentProfile } = await supabase
      .from('store_brand_profiles')
      .select()
      .eq('store_id', id)
      .eq('status', 'synced')
      .maybeSingle();

    // ── LOGO PATH ──
    if (logoAsset) {
      try {
        let logoBuffer: Buffer | null = null;
        let logoMimeType = 'image/png';

        if (logoAsset.storage_path) {
          const { data: fileData } = await supabase
            .storage
            .from('store-brand-assets')
            .download(logoAsset.storage_path);

          if (fileData) {
            logoBuffer = Buffer.from(await fileData.arrayBuffer());
            logoMimeType = logoAsset.mime_type;
          }
        }

        const accentColor = currentProfile?.brand_colors_chosen?.[1]
          ?? currentProfile?.safe_color_tokens?.accent
          ?? null;

        const director = new BrandDirectorService();
        const analysis = await director.analyze({
          logoBuffer: logoBuffer ?? Buffer.from([]),
          logoMimeType,
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
            userPrimaryColor: store.brand_color ?? undefined,
            userAccentColor: accentColor ?? undefined,
          },
        });

        // Only mark outdated after successful analysis
        if (currentProfile) {
          await supabase
            .from('store_brand_profiles')
            .update({ status: 'outdated', updated_at: new Date().toISOString() })
            .eq('id', currentProfile.id);
        }

        const { data: profile, error: insertError } = await supabase
          .from('store_brand_profiles')
          .insert({
            store_id: id,
            source: 'logo_analysis',
            active_logo_asset_id: logoAsset.id,
            logo_colors_detected: analysis.logo_colors_detected,
            brand_colors_chosen: currentProfile?.brand_colors_chosen ?? analysis.logo_colors_detected,
            safe_color_tokens: analysis.safe_color_tokens,
            visual_style: analysis.visual_style,
            visual_tone: analysis.visual_tone,
            typography_direction: analysis.typography_direction,
            brand_personality: analysis.brand_personality,
            campaign_guidelines: analysis.campaign_guidelines,
            campaign_brief: analysis.campaign_brief,
            inferred_primary_color: analysis.inferred_primary_color,
            inferred_accent_color: analysis.inferred_accent_color,
            confidence_score: analysis.confidence_score,
            metadata: {
              input_snapshot: {
                segment: store.segment,
                subsegment: store.subsegment,
                tone_of_voice: store.tone_of_voice,
                name: store.name,
                brand_color: analysis.safe_color_tokens?.primary ?? store.brand_color,
                accent_color: analysis.safe_color_tokens?.accent ?? accentColor,
              },
            },
            status: 'synced',
          })
          .select()
          .single();

        if (insertError) {
          realignLocks.delete(id);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // Correct store state idempotently (handles bugged state where store
        // has active logo but identity_state was incorrectly set to text_only)
        await supabase
          .from('stores')
          .update({
            identity_state: 'logo',
            logo_status: IDENTITY_TO_LOGO_STATUS['logo'],
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        realignLocks.delete(id);
        return NextResponse.json({
          success: true,
          profile: {
            id: profile.id,
            status: profile.status,
            source: 'logo_analysis',
            safe_color_tokens: analysis.safe_color_tokens,
            inferred_primary_color: analysis.inferred_primary_color,
            inferred_accent_color: analysis.inferred_accent_color,
            visual_style: analysis.visual_style,
            visual_tone: analysis.visual_tone,
            brand_personality: analysis.brand_personality,
            brand_colors_chosen: currentProfile?.brand_colors_chosen ?? analysis.logo_colors_detected,
            metadata: profile.metadata,
          },
        });
      } catch (err) {
        if (err instanceof BrandDirectorAnalysisError) {
          const dc = err.deterministicResult;
          await supabase
            .from('store_brand_profiles')
            .insert({
              store_id: id,
              source: 'logo_analysis',
              active_logo_asset_id: logoAsset.id,
              logo_colors_detected: dc?.logo_colors_detected ?? [],
              safe_color_tokens: dc?.safe_color_tokens ?? null,
              inferred_primary_color: dc?.inferred_primary_color ?? null,
              inferred_accent_color: dc?.inferred_accent_color ?? null,
              status: 'failed',
              metadata: { error: err.message, errorType: err.metadata.errorType },
            })
            .select()
            .single();
        } else {
          await supabase
            .from('store_brand_profiles')
            .insert({
              store_id: id,
              source: 'logo_analysis',
              active_logo_asset_id: logoAsset.id,
              status: 'failed',
              metadata: { error: err instanceof Error ? err.message : 'Erro interno' },
            })
            .select()
            .single();
        }

        // Don't update store state on failure — preserve existing state
        realignLocks.delete(id);
        return NextResponse.json({
          success: false,
          message: 'Não foi possível atualizar a direção visual. O perfil anterior foi mantido.',
          error: err instanceof Error ? err.message : 'Erro interno',
        });
      }
    }

    // ── TEXT-ONLY PATH ──
    try {
      const service = new BrandTextOnlyInferenceService();
      const timeoutMs = parseInt(process.env.IMAGE_GENERATION_GLOBAL_TIMEOUT_MS ?? '30000', 10);
      const result = await service.infer({
        storeName: store.name,
        segment: store.segment,
        subsegment: store.subsegment ?? null,
        toneOfVoice: store.tone_of_voice ?? null,
        positioning: store.positioning ?? null,
        shortDescription: store.short_description ?? null,
        slogan: store.slogan ?? null,
        city: store.city ?? null,
        state: store.state ?? null,
      });

      if (currentProfile) {
        await supabase
          .from('store_brand_profiles')
          .update({ status: 'outdated', updated_at: new Date().toISOString() })
          .eq('id', currentProfile.id);
      }

      const inputSnapshot = {
        segment: store.segment,
        subsegment: store.subsegment ?? null,
        tone_of_voice: store.tone_of_voice ?? null,
        name: store.name,
        brand_color: result.safe_color_tokens?.primary ?? store.brand_color,
        accent_color: result.safe_color_tokens?.accent ?? result.inferred_accent_color ?? null,
      };

      const { data: profile, error: insertError } = await supabase
        .from('store_brand_profiles')
        .insert({
          store_id: id,
          source: 'text_only',
          brand_colors_chosen: [],
          safe_color_tokens: result.safe_color_tokens,
          visual_style: result.visual_style,
          visual_tone: result.visual_tone,
          typography_direction: result.typography_direction,
          brand_personality: result.brand_personality,
          campaign_guidelines: result.campaign_guidelines,
          campaign_brief: result.campaign_brief,
          inferred_primary_color: result.inferred_primary_color,
          inferred_accent_color: result.inferred_accent_color,
          confidence_score: result.confidence_score,
          metadata: { input_snapshot: inputSnapshot },
          status: 'synced',
        })
        .select()
        .single();

      if (insertError) {
        realignLocks.delete(id);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      await supabase
        .from('stores')
        .update({
          identity_state: 'text_only',
          logo_status: IDENTITY_TO_LOGO_STATUS['text_only'],
          text_only_origin: 'explicit',
          brand_color: result.safe_color_tokens?.primary ?? store.brand_color,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      realignLocks.delete(id);
      return NextResponse.json({
        success: true,
        profile: {
          id: profile.id,
          status: profile.status,
          source: 'text_only',
          safe_color_tokens: result.safe_color_tokens,
          inferred_primary_color: result.inferred_primary_color,
          inferred_accent_color: result.inferred_accent_color,
          visual_style: result.visual_style,
          visual_tone: result.visual_tone,
          brand_personality: result.brand_personality,
          brand_colors_chosen: [],
          metadata: profile.metadata,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro interno';

      await supabase
        .from('store_brand_profiles')
        .insert({
          store_id: id,
          source: 'text_only',
          status: 'failed',
          metadata: { error: message },
        })
        .select()
        .single();

      await supabase
        .from('stores')
        .update({
          identity_state: 'text_only',
          logo_status: IDENTITY_TO_LOGO_STATUS['text_only'],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      realignLocks.delete(id);
      return NextResponse.json({
        success: false,
        message: 'Não foi possível gerar a direção visual. Tente novamente.',
        error: message,
      });
    }
  } catch (err) {
    realignLocks.delete(id);
    return NextResponse.json({
      success: false,
      message: 'Erro interno no servidor.',
      error: err instanceof Error ? err.message : 'Erro interno',
    });
  }
}
