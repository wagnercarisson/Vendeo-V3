import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  DRAFT_TTL_MS,
  draftKey,
  saveDraft,
  restoreDraft,
  clearDraft,
  clearAllDrafts,
} from '@/lib/store-onboarding/draft-store';
import type { StoreDraft } from '@/lib/store-onboarding/draft-store';
import type { FormData } from '@/components/flow/use-store-form';

/** Mock mínimo de Storage para ambiente node (vitest environment: 'node'). */
function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  } as Storage;
}

const FIXED_NOW = new Date('2026-08-05T12:00:00Z');
const AFTER_TTL = new Date(FIXED_NOW.getTime() + DRAFT_TTL_MS + 1000);

function makeDraft(overrides: Partial<StoreDraft> = {}): StoreDraft {
  return {
    userId: 'u1',
    storeId: null,
    fields: { name: 'Minha Loja', segment: 'moda-calcados-acessorios' },
    updatedAt: FIXED_NOW.getTime(),
    ...overrides,
  };
}

let mockStorage: Storage;

beforeEach(() => {
  mockStorage = createMockStorage();
  vi.stubGlobal('localStorage', mockStorage);
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('draftKey', () => {
  it('storeId null → chave :new (antes do 1º save)', () => {
    expect(draftKey('u1', null)).toBe('vendeo:store_draft:u1:new');
  });

  it('storeId presente → chave :${storeId}', () => {
    expect(draftKey('u1', 's1')).toBe('vendeo:store_draft:u1:s1');
  });
});

describe('saveDraft / restoreDraft', () => {
  it('saveDraft grava updatedAt = Date.now() e restoreDraft retorna o draft', () => {
    saveDraft(makeDraft({ updatedAt: 0 }));
    const restored = restoreDraft('u1', null);
    expect(restored).not.toBeNull();
    expect(restored!.updatedAt).toBe(FIXED_NOW.getTime());
    expect(restored!.fields.name).toBe('Minha Loja');
    expect(restored!.userId).toBe('u1');
    expect(restored!.storeId).toBeNull();
  });

  it('restoreDraft sem chave → null', () => {
    expect(restoreDraft('u2', null)).toBeNull();
  });

  it('restoreDraft com draft expirado → null e removeItem (TTL 24h, D5)', () => {
    saveDraft(makeDraft());
    vi.setSystemTime(AFTER_TTL);
    const restored = restoreDraft('u1', null);
    expect(restored).toBeNull();
    expect(mockStorage.getItem(draftKey('u1', null))).toBeNull();
  });

  it('restoreDraft dentro do TTL → retorna o draft', () => {
    saveDraft(makeDraft());
    vi.setSystemTime(new Date(FIXED_NOW.getTime() + DRAFT_TTL_MS));
    const restored = restoreDraft('u1', null);
    expect(restored).not.toBeNull();
  });

  it('restoreDraft com JSON corrompido → null (não crash, T-36-06)', () => {
    mockStorage.setItem(draftKey('u1', null), '{not-json!!!');
    expect(restoreDraft('u1', null)).toBeNull();
  });

  it('chaves de usuários diferentes não colidem (escopo por usuário)', () => {
    saveDraft(makeDraft({ userId: 'u1', fields: { name: 'Loja A' } }));
    saveDraft(makeDraft({ userId: 'u2', fields: { name: 'Loja B' } }));

    const a = restoreDraft('u1', null);
    const b = restoreDraft('u2', null);

    expect(a!.fields.name).toBe('Loja A');
    expect(b!.fields.name).toBe('Loja B');
    expect(mockStorage.getItem(draftKey('u1', null))).not.toBeNull();
    expect(mockStorage.getItem(draftKey('u2', null))).not.toBeNull();
  });

  it('storeId no draft define a chave correta (draft pós-save da loja)', () => {
    const draft = makeDraft({ userId: 'u1', storeId: 's1', fields: { name: 'Loja' } });
    saveDraft(draft);
    expect(mockStorage.getItem('vendeo:store_draft:u1:s1')).not.toBeNull();
    expect(restoreDraft('u1', 's1')!.fields.name).toBe('Loja');
    expect(restoreDraft('u1', null)).toBeNull();
  });
});

describe('clearDraft / clearAllDrafts', () => {
  it('clearDraft sem storeId remove a chave :new', () => {
    saveDraft(makeDraft());
    clearDraft('u1');
    expect(mockStorage.getItem(draftKey('u1', null))).toBeNull();
  });

  it('clearDraft com storeId remove a chave :${storeId}', () => {
    saveDraft(makeDraft({ storeId: 's1' }));
    clearDraft('u1', 's1');
    expect(mockStorage.getItem(draftKey('u1', 's1'))).toBeNull();
  });

  it('clearAllDrafts remove apenas chaves com prefixo vendeo:store_draft:', () => {
    mockStorage.setItem('vendeo:store_draft:u1:new', '{}');
    mockStorage.setItem('vendeo:store_draft:u2:s9', '{}');
    mockStorage.setItem('vendeo:changelog:lido', 'true'); // outra feature — intacta
    mockStorage.setItem('outra-chave', 'valor'); // sem prefixo — intacta

    clearAllDrafts();

    expect(mockStorage.getItem('vendeo:store_draft:u1:new')).toBeNull();
    expect(mockStorage.getItem('vendeo:store_draft:u2:s9')).toBeNull();
    expect(mockStorage.getItem('vendeo:changelog:lido')).toBe('true');
    expect(mockStorage.getItem('outra-chave')).toBe('valor');
  });

  it('clearAllDrafts é seguro com localStorage vazio', () => {
    expect(() => clearAllDrafts()).not.toThrow();
  });
});
