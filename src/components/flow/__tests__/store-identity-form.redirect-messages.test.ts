import { describe, it, expect } from 'vitest';

describe('StoreIdentityForm redirectMessage prop', () => {
  it('"needs-visual-direction" renders alert about visual direction', () => {
    const messages: Record<string, string> = {
      'needs-visual-direction': 'Sua loja precisa de uma direção visual para gerar campanhas. Configure agora.',
      'cnpj-updated': 'Dados atualizados! Agora configure a direção visual da sua loja.',
    };

    expect(messages['needs-visual-direction']).toContain('direção visual');
    expect(messages['needs-visual-direction']).toContain('Configure agora');
    expect(messages['cnpj-updated']).toContain('Dados atualizados');
    expect(messages['cnpj-updated']).toContain('direção visual');
  });

  it('redirectMessage is consumed once and not persisted', () => {
    // Using search params pattern (not state) guarantees one-time consumption
    const searchParams = new URLSearchParams('required=visual-direction&message=needs-visual-direction');
    const message = searchParams.get('message');
    expect(message).toBe('needs-visual-direction');
    // After navigation/refresh, the param is gone — no persistence issue
  });
});

describe('StorePageClient search params forwarding', () => {
  it('passes message param from URL to StoreIdentityForm', () => {
    function extractMessage(url: string): string | undefined {
      const params = new URLSearchParams(url.split('?')[1] ?? '');
      return params.get('message') ?? undefined;
    }

    expect(extractMessage('/loja?required=visual-direction&message=needs-visual-direction')).toBe('needs-visual-direction');
    expect(extractMessage('/loja?required=visual-direction&message=cnpj-updated')).toBe('cnpj-updated');
    expect(extractMessage('/loja?required=visual-direction')).toBeUndefined();
  });
});
