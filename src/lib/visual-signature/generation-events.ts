import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import type { GenerationEventInsert, GenerationEventRecord } from '@/lib/visual-signature/types';

export async function insertGenerationEvent(
  event: GenerationEventInsert
): Promise<GenerationEventRecord | null> {
  try {
    const { data, error } = await supabase
      .from('generation_events')
      .insert(event)
      .select()
      .single();

    if (error) {
      console.error('[GenerationEvents] Insert failed (best-effort):', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[GenerationEvents] Insert exception (best-effort):', err);
    return null;
  }
}

export async function updateGenerationEventDecision(
  assetId: string,
  attemptNumber: number,
  decision: { approved?: boolean; rejected?: boolean }
): Promise<void> {
  try {
    await supabase
      .from('generation_events')
      .update(decision)
      .eq('asset_id', assetId)
      .eq('attempt_number', attemptNumber);
  } catch (err) {
    console.error('[GenerationEvents] Update failed (best-effort):', err);
  }
}
