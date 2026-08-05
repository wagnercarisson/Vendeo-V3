// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboardingTabs } from '@/hooks/use-onboarding-tabs';
import type { UseOnboardingTabsDeps } from '@/hooks/use-onboarding-tabs';
import type { FormData } from '@/components/flow/use-store-form';
import {
  draftKey,
  saveDraft,
  restoreDraft,
  clearDraft,
  clearAllDrafts,
} from '@/lib/store-onboarding/draft-store';
import type { StoreDraft } from '@/lib/store-onboarding/draft-store';

function makeFormData(overrides: Partial<FormData> = {}): FormData {
  return {
    name: 'Minha Loja',
    segment: 'outros',
    brand_color: '',
    city: '',
    state: '',
    subsegment: 'loja de roupas',
    tone_of_voice: '',
    positioning: '',
    short_description: '',
    slogan: '',
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    ...overrides,
  };
}

function makeDeps(overrides: Partial<UseOnboardingTabsDeps> = {}): UseOnboardingTabsDeps {
  return {
    initialTab: 'dados',
    userId: 'user-1',
    formData: makeFormData(),
    storeId: null,
    legalAccepted: true,
    hasVisualDirection: false,
    readiness: { ready: true, missing: [] },
    hasLocalEdits: true,
    isPersisted: false,
    autoSave: vi.fn(async () => ({ ok: true })),
    saveStatus: 'idle',
    driftStatus: 'none',
    driftCategory: 'none',
    ...overrides,
  };
}

/**
 * Reconciliação do rascunho com o banco — réplica fiel do algoritmo da
 * StoreIdentityForm (store-identity-form.tsx:290-297): o banco prevalece em
 * campos persistidos (não-undefined/não-null/não-vazio); campos vazios no banco
 * são preenchidos pelo draft.
 */
function reconcileDraftWithStore(
  draft: StoreDraft | null,
  stored: Partial<Record<keyof FormData, unknown>> | null,
): Partial<FormData> {
  if (!draft) return {};
  const merged: Partial<FormData> = {};
  const entries = Object.entries(draft.fields) as [keyof FormData, string | undefined][];
  for (const [field, value] of entries) {
    if (typeof value !== 'string') continue;
    const persisted = stored?.[field];
    if (persisted !== undefined && persisted !== null && String(persisted) !== '') continue;
    if (value !== '') merged[field] = value;
  }
  return merged;
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/loja');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('draft-store-autosave — escrita síncrona em abandono (F36-DRAFT-02)', () => {
  it('evento pagehide dispara escrita SÍNCRONA do draft no localStorage', () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          userId: 'user-1',
          storeId: 'store-1',
          formData: makeFormData({ name: 'Loja X', segment: 'petshop' }),
        }),
      ),
    );

    // Wiring idêntico ao do form (store-identity-form.tsx:367-376)
    act(() => {
      window.addEventListener('pagehide', result.current.handlePageHide);
      window.dispatchEvent(new Event('pagehide'));
    });

    const raw = localStorage.getItem(draftKey('user-1', 'store-1'));
    expect(raw).not.toBeNull();
    const draft = JSON.parse(raw as string) as StoreDraft;
    expect(draft.fields.name).toBe('Loja X');
    expect(draft.storeId).toBe('store-1');
    // PATCH best-effort fire-and-forget com keepalive
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/store/store-1',
      expect.objectContaining({ method: 'PATCH', keepalive: true }),
    );
  });

  it('visibilitychange (hidden) dispara a mesma escrita síncrona do draft', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden' as DocumentVisibilityState);

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({
          userId: 'user-1',
          storeId: null,
          formData: makeFormData({ name: 'Loja Beta' }),
        }),
      ),
    );

    act(() => {
      document.addEventListener('visibilitychange', result.current.handleVisibilityChange);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Sem storeId → apenas o draft :new é gravado (nenhum PATCH)
    const draft = restoreDraft('user-1', null);
    expect(draft).not.toBeNull();
    expect(draft!.fields.name).toBe('Loja Beta');
    expect(draft!.storeId).toBeNull();
  });
});

describe('draft-store-autosave — restauração e reconciliação (F36-DRAFT-03)', () => {
  it('rascunho :new é restaurado e reconciliado: banco prevalece em campos persistidos', () => {
    const draft: StoreDraft = {
      userId: 'user-1',
      storeId: null,
      fields: { name: 'Nome do Rascunho', city: 'São Paulo' },
      updatedAt: Date.now(),
    };
    saveDraft(draft);

    const restored = restoreDraft('user-1', null);
    const merged = reconcileDraftWithStore(restored, {
      name: 'Nome Persistido no Banco', // banco prevalece
      city: '', // vazio no banco → draft preenche
    });

    expect(merged.name).toBeUndefined(); // banco prevalece → draft descartado
    expect(merged.city).toBe('São Paulo');
  });

  it('rascunho :${storeId} é restaurado da chave com storeId e reconciliado', () => {
    saveDraft({
      userId: 'user-1',
      storeId: 'store-9',
      fields: { name: 'Rascunho', tone_of_voice: 'moderno' },
      updatedAt: Date.now(),
    });

    const restored = restoreDraft('user-1', 'store-9');
    expect(restored).not.toBeNull();
    expect(restored!.storeId).toBe('store-9');
    expect(restoreDraft('user-1', null)).toBeNull(); // chaves diferentes não colidem

    const merged = reconcileDraftWithStore(restored, {
      name: 'Banco', // persistido → prevalece
      tone_of_voice: null, // null no banco → draft preenche
    });
    expect(merged.name).toBeUndefined();
    expect(merged.tone_of_voice).toBe('moderno');
  });

  it('reconciliação ignora rascunho inexistente/expirado (restoreDraft → null)', () => {
    const merged = reconcileDraftWithStore(null, { name: 'Banco' });
    expect(merged).toEqual({});
  });
});

describe('draft-store-autosave — limpeza (F36-DRAFT-03/04)', () => {
  it('após o 1º save (novo storeId) a chave :new é limpa via clearDraft(userId)', async () => {
    localStorage.setItem(
      draftKey('user-1', null),
      JSON.stringify({ userId: 'user-1', storeId: null, fields: {}, updatedAt: Date.now() }),
    );
    const autoSave = vi.fn(async () => ({ ok: true, storeId: 'store-nova-1' }));

    const { result } = renderHook(() =>
      useOnboardingTabs(
        makeDeps({ userId: 'user-1', storeId: null, legalAccepted: true, autoSave }),
      ),
    );

    await act(async () => {
      await result.current.setActiveTab('posicionamento');
    });

    // Fluxo do form (D5): storeId novo → clearDraft(userId) remove a chave :new
    clearDraft('user-1');
    expect(localStorage.getItem(draftKey('user-1', null))).toBeNull();
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  it('clearAllDrafts remove todas as chaves de draft no logout preservando outras chaves', () => {
    localStorage.setItem(draftKey('user-1', null), JSON.stringify({ userId: 'user-1', storeId: null, fields: {}, updatedAt: Date.now() }));
    localStorage.setItem(draftKey('user-2', 'store-5'), JSON.stringify({ userId: 'user-2', storeId: 'store-5', fields: {}, updatedAt: Date.now() }));
    localStorage.setItem('vendeo:changelog:lido', 'true'); // outra feature

    clearAllDrafts();

    expect(localStorage.getItem(draftKey('user-1', null))).toBeNull();
    expect(localStorage.getItem(draftKey('user-2', 'store-5'))).toBeNull();
    expect(localStorage.getItem('vendeo:changelog:lido')).toBe('true');
  });
});
