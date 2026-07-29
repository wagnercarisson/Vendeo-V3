import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) =>
    `<a href="${href}" class="${className}">${children}</a>`,
}));

import { ReadinessBanner } from '../readiness-banner';

describe('ReadinessBanner', () => {
  it('returns null when missing is empty', () => {
    const result = ReadinessBanner({ missing: [] });
    expect(result).toBeNull();
  });

  it('shows CNPJ cadastral when cadastro_fiscal is missing', () => {
    const html = renderToString(ReadinessBanner({
      missing: [{ item: 'cadastro_fiscal', reason: 'CNPJ obrigatório' }],
    }));
    expect(html).toContain('CNPJ cadastral');
    expect(html).toContain('/cadastro/cnpj?returnTo=/dashboard');
  });

  it('shows Direção visual when brand_profile is missing', () => {
    const html = renderToString(ReadinessBanner({
      missing: [{ item: 'brand_profile', reason: 'Direção visual não configurada' }],
    }));
    expect(html).toContain('Direção visual');
    expect(html).toContain('/loja?required=visual-direction');
  });

  it('shows both items when multiple missing', () => {
    const html = renderToString(ReadinessBanner({
      missing: [
        { item: 'cadastro_fiscal', reason: 'CNPJ obrigatório' },
        { item: 'brand_profile', reason: 'Direção visual não configurada' },
      ],
    }));
    expect(html).toContain('CNPJ cadastral');
    expect(html).toContain('Direção visual');
  });

  it('Configurar agora button points to first missing item', () => {
    const html = renderToString(ReadinessBanner({
      missing: [
        { item: 'cadastro_fiscal', reason: 'CNPJ obrigatório' },
        { item: 'brand_profile', reason: 'Direção visual não configurada' },
      ],
    }));
    expect(html).toContain('/cadastro/cnpj?returnTo=/dashboard');
    expect(html).toContain('Configurar agora');
  });

  it('shows title text', () => {
    const html = renderToString(ReadinessBanner({
      missing: [{ item: 'cadastro_fiscal', reason: 'CNPJ obrigatório' }],
    }));
    expect(html).toContain('Sua loja não está pronta para gerar campanhas');
  });
});
