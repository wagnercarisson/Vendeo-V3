import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) =>
    `<a href="${href}" class="${className}">${children}</a>`,
}));

import { ReadinessBanner } from '../readiness-banner';

// renderToString escapa & e " em atributos — decodifica antes de assertar as URLs canônicas.
const decodeHtml = (html: string) => html.replace(/&amp;/g, '&').replace(/&quot;/g, '"');

describe('ReadinessBanner', () => {
  it('returns null when missing is empty', () => {
    const result = ReadinessBanner({ missing: [] });
    expect(result).toBeNull();
  });

  it('shows CNPJ cadastral when cadastro_fiscal is missing', () => {
    const html = decodeHtml(renderToString(ReadinessBanner({
      missing: [{ item: 'cadastro_fiscal', reason: 'CNPJ obrigatório' }],
    })));
    expect(html).toContain('CNPJ cadastral');
    expect(html).toContain('/loja?tab=dados&fiscal=pending&returnTo=/dashboard');
    expect(html).toContain('returnTo=/dashboard');
  });

  it('shows Direção visual when brand_profile is missing', () => {
    const html = decodeHtml(renderToString(ReadinessBanner({
      missing: [{ item: 'brand_profile', reason: 'Direção visual não configurada' }],
    })));
    expect(html).toContain('Direção visual');
    expect(html).toContain('/loja?tab=direcao-visual&message=needs-visual-direction');
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
    const html = decodeHtml(renderToString(ReadinessBanner({
      missing: [
        { item: 'cadastro_fiscal', reason: 'CNPJ obrigatório' },
        { item: 'brand_profile', reason: 'Direção visual não configurada' },
      ],
    })));
    expect(html).toContain('/loja?tab=dados&fiscal=pending&returnTo=/dashboard');
    expect(html).toContain('Configurar agora');
  });

  it('shows title text', () => {
    const html = renderToString(ReadinessBanner({
      missing: [{ item: 'cadastro_fiscal', reason: 'CNPJ obrigatório' }],
    }));
    expect(html).toContain('Sua loja não está pronta para gerar campanhas');
  });

  it('renders localized es-419 title, items and CTA', () => {
    const html = decodeHtml(renderToString(ReadinessBanner({
      missing: [
        { item: 'cadastro_fiscal', reason: 'CNPJ obrigatório' },
        { item: 'brand_profile', reason: 'Direção visual não configurada' },
      ],
      messages: {
        title: 'Tu tienda aún no está lista para generar campañas',
        cta: 'Configurar ahora',
        cadastroFiscal: 'Registro fiscal (CNPJ)',
        brandProfile: 'Dirección visual',
      },
    })));
    expect(html).toContain('Tu tienda aún no está lista para generar campañas');
    expect(html).toContain('Registro fiscal (CNPJ)');
    expect(html).toContain('Dirección visual');
    expect(html).toContain('Configurar ahora');
    expect(html).not.toContain('CNPJ cadastral');
    expect(html).not.toContain('Configurar agora');
  });

  it('does not render the ❌ glyph', () => {
    const html = renderToString(ReadinessBanner({
      missing: [
        { item: 'cadastro_fiscal', reason: 'CNPJ obrigatório' },
        { item: 'brand_profile', reason: 'Direção visual não configurada' },
      ],
    }));
    expect(html).not.toContain('❌');
  });
});
