import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import { IDENTITY_TO_LOGO_STATUS } from '@/lib/constants';
import type { IdentityState, IdentityTransition } from '@/lib/constants';

export type TransitionResult =
  | { success: true }
  | { success: false; error: string; partialState?: Record<string, unknown> };

export type TransitionCallbacks = {
  onCriticalPersistence: () => Promise<void>;
  onCompensate?: () => Promise<void>;
};

function validateTransition(currentState: IdentityState, target: IdentityTransition): { valid: true } | { valid: false; error: string } {
  const valid: Record<IdentityState, IdentityTransition[]> = {
    'text_only': ['text_only_to_logo', 'text_only_to_visual_signature'],
    'logo': ['logo_to_text_only'],
    'visual_signature': ['visual_signature_to_text_only'],
  };

  const allowed = valid[currentState];
  if (!allowed) {
    return { valid: false, error: `Estado de identidade inválido: ${currentState}` };
  }

  if (!allowed.includes(target)) {
    return { valid: false, error: `Transição ${target} não permitida a partir do estado ${currentState}` };
  }

  return { valid: true };
}

export async function assertCanTransition(
  storeId: string,
  type: IdentityTransition
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: store, error } = await supabase
    .from('stores')
    .select('identity_state')
    .eq('id', storeId)
    .single();

  if (error || !store) {
    return { ok: false, error: 'Loja não encontrada', status: 404 };
  }

  const currentState = (store.identity_state ?? 'text_only') as IdentityState;
  const validation = validateTransition(currentState, type);

  if (!validation.valid) {
    return { ok: false, error: validation.error, status: 409 };
  }

  return { ok: true };
}

export async function transition(
  storeId: string,
  type: IdentityTransition,
  callbacks: TransitionCallbacks
): Promise<TransitionResult> {
  const { data: store, error: fetchError } = await supabase
    .from('stores')
    .select('identity_state')
    .eq('id', storeId)
    .single();

  if (fetchError || !store) {
    return { success: false, error: 'Loja não encontrada' };
  }

  const currentState = (store.identity_state ?? 'text_only') as IdentityState;
  const validation = validateTransition(currentState, type);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    await callbacks.onCriticalPersistence();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha na persistência crítica',
    };
  }

  const targetState = typeToIdentityState(type);
  const logoStatus = IDENTITY_TO_LOGO_STATUS[targetState];

  const { error: updateError } = await supabase
    .from('stores')
    .update({
      identity_state: targetState,
      logo_status: logoStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', storeId);

  if (updateError) {
    if (callbacks.onCompensate) {
      try {
        await callbacks.onCompensate();
      } catch (compensateError) {
        console.error('[identity-transitions] Compensation failed after DB update error:', compensateError);
      }
    }

    return {
      success: false,
      error: `Erro ao atualizar estado da loja: ${updateError.message}`,
      partialState: { identity_state: targetState, logo_status: logoStatus },
    };
  }

  return { success: true };
}

function typeToIdentityState(type: IdentityTransition): IdentityState {
  const map: Record<IdentityTransition, IdentityState> = {
    'text_only_to_logo': 'logo',
    'logo_to_text_only': 'text_only',
    'text_only_to_visual_signature': 'visual_signature',
    'visual_signature_to_text_only': 'text_only',
  };
  return map[type];
}
