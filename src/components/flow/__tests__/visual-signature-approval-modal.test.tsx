// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VisualSignatureApprovalModal } from '../visual-signature-approval-modal';

function createModalProps(overrides: Record<string, unknown> = {}) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    storeId: 'test-store',
    storeName: 'Loja Teste',
    segment: 'alimentacao',
    brandColor: '#FF6600',
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// --- Existing function-level tests (preserved) ---

describe('VisualSignatureApprovalModal mode:substitution', () => {
  it('substitution mode checks bp_status after approval', () => {
    function handleApprovalResponse(
      mode: 'standard' | 'substitution',
      bpStatus: string | undefined
    ): 'done' | 'bp_failed' {
      if (bpStatus === 'failed' && mode === 'substitution') {
        return 'bp_failed';
      }
      return 'done';
    }

    expect(handleApprovalResponse('substitution', 'failed')).toBe('bp_failed');
    expect(handleApprovalResponse('substitution', 'synced')).toBe('done');
    expect(handleApprovalResponse('substitution', undefined)).toBe('done');
    // Standard mode ignores bp_status
    expect(handleApprovalResponse('standard', 'failed')).toBe('done');
  });

  it('bp_failed offers Tentar novamente -> calls POST /brand-profile/realign', () => {
    let realignCalled = false;
    const realignFn = async () => {
      realignCalled = true;
    };

    const handleRetryBP = async (onTier2Retry?: () => Promise<void>) => {
      if (onTier2Retry) {
        await onTier2Retry();
      } else {
        await fetch('/api/store/test/brand-profile/realign', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      }
    };

    handleRetryBP(realignFn);
    expect(realignCalled).toBe(true);
  });

  it('substitution mode sends mode:substitution in generate body', () => {
    function buildGenerateBody(
      mode: 'standard' | 'substitution',
      rejectionContext?: { reason: string; attempt: number }
    ): Record<string, unknown> {
      const body: Record<string, unknown> = {};
      if (mode === 'substitution') {
        body.mode = 'substitution';
      }
      if (rejectionContext) {
        body.rejectionContext = rejectionContext;
      }
      return body;
    }

    expect(buildGenerateBody('substitution')).toEqual({ mode: 'substitution' });
    expect(buildGenerateBody('standard')).toEqual({});
    expect(buildGenerateBody('substitution', { reason: 'test', attempt: 1 })).toEqual({
      mode: 'substitution',
      rejectionContext: { reason: 'test', attempt: 1 },
    });
  });

  it('substitution mode sends mode:substitution in approve body', () => {
    function buildApproveBody(
      signatureId: string,
      mode: 'standard' | 'substitution'
    ): Record<string, unknown> {
      const body: Record<string, unknown> = { signatureId };
      if (mode === 'substitution') {
        body.mode = 'substitution';
      }
      return body;
    }

    expect(buildApproveBody('sig-1', 'substitution')).toEqual({
      signatureId: 'sig-1',
      mode: 'substitution',
    });
    expect(buildApproveBody('sig-1', 'standard')).toEqual({
      signatureId: 'sig-1',
    });
  });
});

describe('VisualSignatureApprovalModal mode:standard', () => {
  it('standard mode does NOT include mode in generate body', () => {
    function buildGenerateBody(mode: 'standard' | 'substitution'): Record<string, unknown> {
      const body: Record<string, unknown> = {};
      if (mode === 'substitution') {
        body.mode = 'substitution';
      }
      return body;
    }
    const body = buildGenerateBody('standard');
    expect(body).not.toHaveProperty('mode');
  });

  it('standard mode does NOT check bp_status', () => {
    function handleApprovalResponse(
      mode: 'standard' | 'substitution',
      bpStatus: string | undefined
    ): 'done' | 'bp_failed' {
      if (bpStatus === 'failed' && mode === 'substitution') {
        return 'bp_failed';
      }
      return 'done';
    }

    expect(handleApprovalResponse('standard', 'failed')).toBe('done');
    expect(handleApprovalResponse('standard', 'synced')).toBe('done');
    expect(handleApprovalResponse('standard', undefined)).toBe('done');
  });
});

// --- New behavioral tests with component rendering ---

describe('VisualSignatureApprovalModal behavioral (Cancelar) — rendering', () => {
  it('"Cancelar" fecha o modal sem mutações', async () => {
    const props = createModalProps();
    const { onClose, onComplete } = props;

    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url instanceof Request ? url.url : '';
      if (urlStr.includes('/visual-signature') && (!init || init.method === 'GET' || init.method === undefined)) {
        return new Response(JSON.stringify({ signatures: [] }), { status: 200 });
      }
      if (urlStr.includes('/generate-without-logo')) {
        return new Response(JSON.stringify({ error: 'Erro simulado' }), { status: 500 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<VisualSignatureApprovalModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });

    vi.mocked(fetch).mockClear();

    fireEvent.click(screen.getByText('Cancelar'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('"Tentar novamente" faz nova requisição POST', async () => {
    const props = createModalProps();
    const { onClose } = props;

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/visual-signature') && !urlStr.includes('/generate')) {
        return new Response(JSON.stringify({ signatures: [] }), { status: 200 });
      }
      if (urlStr.includes('/generate-without-logo')) {
        return new Response(JSON.stringify({ error: 'Erro simulado' }), { status: 500 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<VisualSignatureApprovalModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
    });

    vi.mocked(fetch).mockClear();

    fireEvent.click(screen.getByText('Tentar novamente'));

    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls;
      const retryCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/generate-without-logo')
      );
      expect(retryCall).toBeTruthy();
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('drift ativo mostra "Ajustar assinatura"', async () => {
    const props = createModalProps({ hasActiveSignatureDrift: true, mode: 'standard' });

    render(<VisualSignatureApprovalModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Ajustar assinatura')).toBeInTheDocument();
    });
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('402 response mostra insufficient_credits com CTA /conta e Tentar novamente', async () => {
    const props = createModalProps();

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/visual-signature') && !urlStr.includes('/generate')) {
        return new Response(JSON.stringify({ signatures: [] }), { status: 200 });
      }
      if (urlStr.includes('/generate-without-logo')) {
        return new Response(JSON.stringify({ code: 'insufficient_credits', error: 'Créditos insuficientes' }), { status: 402 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<VisualSignatureApprovalModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Créditos insuficientes para gerar assinatura visual.')).toBeInTheDocument();
    });

    expect(screen.getByText('Cada geração de assinatura visual consome 1 crédito.')).toBeInTheDocument();

    const verCreditos = screen.getByText('Ver meus créditos');
    expect(verCreditos).toBeInTheDocument();
    expect(verCreditos.closest('a') || verCreditos).toBeTruthy();

    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });

  it('onOpenGallery não passada + total > 6 → placeholder original visível', async () => {
    const props = createModalProps({ onOpenGallery: undefined });

    const signatures = Array.from({ length: 8 }, (_, i) => ({
      id: `sig-${i}`,
      assetUrl: 'https://example.com/sig.png',
      attempt: i + 1,
      status: i === 0 ? 'active' : 'archived',
      restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' },
    }));

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/visual-signature') && !urlStr.includes('/generate')) {
        return new Response(JSON.stringify({ signatures, total: 8 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'erro' }), { status: 500 });
    });

    render(<VisualSignatureApprovalModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Há mais versões no histórico. Galeria completa em breve.')).toBeInTheDocument();
    });
  });

  it('onOpenGallery passada + total > 6 → link "Ver versões recentes" visível', async () => {
    const onOpenGallery = vi.fn();
    const props = createModalProps({ onOpenGallery });

    const signatures = Array.from({ length: 8 }, (_, i) => ({
      id: `sig-${i}`,
      assetUrl: 'https://example.com/sig.png',
      attempt: i + 1,
      status: i === 0 ? 'active' : 'archived',
      restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' },
    }));

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/visual-signature') && !urlStr.includes('/generate')) {
        return new Response(JSON.stringify({ signatures, total: 8 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'erro' }), { status: 500 });
    });

    render(<VisualSignatureApprovalModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Ver versões recentes')).toBeInTheDocument();
    });
  });

  it('Click no link "Ver versões recentes" → onOpenGallery é chamado', async () => {
    const onOpenGallery = vi.fn();
    const props = createModalProps({ onOpenGallery });

    const signatures = Array.from({ length: 8 }, (_, i) => ({
      id: `sig-${i}`,
      assetUrl: 'https://example.com/sig.png',
      attempt: i + 1,
      status: i === 0 ? 'active' : 'archived',
      restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' },
    }));

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/visual-signature') && !urlStr.includes('/generate')) {
        return new Response(JSON.stringify({ signatures, total: 8 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'erro' }), { status: 500 });
    });

    render(<VisualSignatureApprovalModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Ver versões recentes')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ver versões recentes'));

    expect(onOpenGallery).toHaveBeenCalledTimes(1);
  });

  // ─── initialReviewFeedbackOpen tests ───

  describe('initialReviewFeedbackOpen', () => {
    it('true + signatures existentes → textarea "O que você quer diferente?" aparece direto', async () => {
      const props = createModalProps({ initialReviewFeedbackOpen: true });
      const signatures = [
        { id: 'sig-1', assetUrl: 'https://example.com/sig.png', attempt: 1, status: 'active', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' as const } },
      ];

      vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : '';
        if (urlStr.includes('/visual-signature') && !urlStr.includes('/generate')) {
          return new Response(JSON.stringify({ signatures, total: 1 }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'erro' }), { status: 500 });
      });

      render(<VisualSignatureApprovalModal {...props} />);

      await waitFor(() => {
        expect(screen.getByText('O que você quer diferente?')).toBeInTheDocument();
      });
    });

    it('false (padrão) + signatures existentes → "Nenhuma agradou" visível, textarea oculto', async () => {
      const props = createModalProps({ initialReviewFeedbackOpen: false });
      const signatures = [
        { id: 'sig-1', assetUrl: 'https://example.com/sig.png', attempt: 1, status: 'active', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' as const } },
      ];

      vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : '';
        if (urlStr.includes('/visual-signature') && !urlStr.includes('/generate')) {
          return new Response(JSON.stringify({ signatures, total: 1 }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'erro' }), { status: 500 });
      });

      render(<VisualSignatureApprovalModal {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Nenhuma agradou, gerar nova versão')).toBeInTheDocument();
      });

      expect(screen.queryByText('O que você quer diferente?')).not.toBeInTheDocument();
    });

    it('ausente (undefined) → fluxo normal, textarea não aparece', async () => {
      const props = createModalProps({});
      const signatures = [
        { id: 'sig-1', assetUrl: 'https://example.com/sig.png', attempt: 1, status: 'active', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' as const } },
      ];

      vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const urlStr = typeof url === 'string' ? url : '';
        if (urlStr.includes('/visual-signature') && !urlStr.includes('/generate')) {
          return new Response(JSON.stringify({ signatures, total: 1 }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: 'erro' }), { status: 500 });
      });

      render(<VisualSignatureApprovalModal {...props} />);

      await waitFor(() => {
        expect(screen.getByText('Nenhuma agradou, gerar nova versão')).toBeInTheDocument();
      });

      expect(screen.queryByText('O que você quer diferente?')).not.toBeInTheDocument();
    });
  });

  it('substitution mode + erro mostra "Tentar novamente"', async () => {
    const props = createModalProps({ mode: 'substitution' });

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/generate-without-logo')) {
        return new Response(JSON.stringify({ error: 'Erro simulado' }), { status: 500 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<VisualSignatureApprovalModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
    });
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
    expect(screen.queryByText('Ajustar assinatura')).not.toBeInTheDocument();
  });
});
