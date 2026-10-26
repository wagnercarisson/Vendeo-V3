// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VisualSignatureApprovalModal } from '../visual-signature-approval-modal';

const mockUseOperationCosts = vi.fn(() => ({
  costs: {
    campaign_generation: { costCredits: 1, enabled: true },
    visual_signature_generation: { costCredits: 1, enabled: true },
  },
  status: "loaded",
  refetch: vi.fn(),
}));
vi.mock("@/hooks/use-operation-costs", () => ({
  useOperationCosts: () => mockUseOperationCosts(),
}));

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
  mockUseOperationCosts.mockReturnValue({
    costs: {
      campaign_generation: { costCredits: 1, enabled: true },
      visual_signature_generation: { costCredits: 1, enabled: true },
    },
    status: "loaded",
    refetch: vi.fn(),
  });
});

// --- Existing function-level tests (preserved) ---

describe('VisualSignatureApprovalModal mode:substitution', () => {
  it('substitution mode checks bp_status after approval', () => {
    function handleApprovalResponse(
      bpStatus: string | undefined
    ): 'done' | 'bp_failed' {
      if (bpStatus === 'failed') {
        return 'bp_failed';
      }
      return 'done';
    }

    expect(handleApprovalResponse('failed')).toBe('bp_failed');
    expect(handleApprovalResponse('synced')).toBe('done');
    expect(handleApprovalResponse(undefined)).toBe('done');
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

  it('standard mode também trata bp_status=failed (fail-closed)', () => {
    function handleApprovalResponse(
      bpStatus: string | undefined
    ): 'done' | 'bp_failed' {
      if (bpStatus === 'failed') {
        return 'bp_failed';
      }
      return 'done';
    }

    expect(handleApprovalResponse('failed')).toBe('bp_failed');
    expect(handleApprovalResponse('synced')).toBe('done');
    expect(handleApprovalResponse(undefined)).toBe('done');
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

describe('VisualSignatureApprovalModal — bp_failed em ambos os modos (261025-svt)', () => {
  function mockFlow(opts: {
    approveBody: Record<string, unknown>;
    realign?: Record<string, unknown>;
  }) {
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : url instanceof Request ? url.url : '';
      if (urlStr.includes('/api/legal/status')) {
        return new Response(JSON.stringify({ acceptanceStatus: 'current' }), { status: 200 });
      }
      if (urlStr.includes('/generate-without-logo')) {
        return new Response(
          JSON.stringify({ assetUrl: 'https://x/sig.png', signatureId: 'sig-1', artDirectorOutput: {}, attempt: 1 }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/visual-signature?limit=6') || (urlStr.includes('/visual-signature') && (!init || !init.method || init.method === 'GET'))) {
        return new Response(JSON.stringify({ signatures: [] }), { status: 200 });
      }
      if (urlStr.includes('/visual-signature/approve')) {
        return new Response(JSON.stringify(opts.approveBody), { status: 200 });
      }
      if (urlStr.includes('/brand-profile/realign')) {
        return new Response(JSON.stringify(opts.realign ?? {}), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
  }

  for (const mode of ['standard', 'substitution'] as const) {
    it(`${mode}: bp_status=failed mostra título, mensagem e CTA sem UUID`, async () => {
      const onDirectionPending = vi.fn();
      mockFlow({
        approveBody: {
          signature: { assetUrl: 'https://x/sig.png' },
          bp_status: 'failed',
          brandProfileData: null,
          support_code: 'DVAP01',
          message: 'Sua assinatura foi aprovada, mas não conseguimos concluir a direção visual. Informe ao suporte o código DVAP01.',
          failure_reference: 'run-ref-7',
        },
      });

      render(<VisualSignatureApprovalModal {...createModalProps({ mode, onDirectionPending })} />);

      await waitFor(() => expect(screen.getByText('Aprovar')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Aprovar'));

      await waitFor(() => {
        expect(screen.getByText('Direção visual pendente')).toBeInTheDocument();
      });
      expect(screen.getByText(/Informe ao suporte o código DVAP01/)).toBeInTheDocument();
      expect(screen.queryByText('Código de suporte: run-ref-7')).not.toBeInTheDocument();
      expect(screen.queryByText(/run-ref-7/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Realinhar direção visual' })).toBeInTheDocument();
      expect(onDirectionPending).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('DVAP01'),
          supportCode: 'DVAP01',
        }),
      );
    });
  }

  it('sucesso do realinhamento chama onComplete com brandProfileData e fecha', async () => {
    const onComplete = vi.fn();
    const onClose = vi.fn();
    mockFlow({
      approveBody: {
        signature: { assetUrl: 'https://x/sig.png' },
        bp_status: 'failed',
        support_code: 'DVAP01',
        message: 'pendente',
        failure_reference: 'run-ref-8',
      },
      realign: {
        success: true,
        profile: {
          id: 'p-1',
          status: 'synced',
          safe_color_tokens: { primary: '#111111' },
          visual_style: 'Moderno',
          visual_tone: 'Elegante',
          brand_personality: 'Sofisticado',
          brand_colors_chosen: ['#111111', '#222222'],
          inferred_primary_color: '#111111',
          inferred_accent_color: '#222222',
          metadata: {},
        },
      },
    });

    render(<VisualSignatureApprovalModal {...createModalProps({ onComplete, onClose })} />);

    await waitFor(() => expect(screen.getByText('Aprovar')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Aprovar'));
    await waitFor(() => expect(screen.getByText('Direção visual pendente')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Realinhar direção visual' }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          logoStatus: 'generated',
          brandProfileData: expect.objectContaining({ safe_color_tokens: { primary: '#111111' } }),
        }),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('nova falha mantém bp_failed e atualiza mensagem/código sem UUID', async () => {
    const onClose = vi.fn();
    mockFlow({
      approveBody: {
        signature: { assetUrl: 'https://x/sig.png' },
        bp_status: 'failed',
        support_code: 'DVAP01',
        message: 'pendente inicial com código DVAP01',
        failure_reference: 'run-ref-9',
      },
      realign: {
        success: false,
        message: 'Não foi possível concluir a direção visual. Informe ao suporte o código DVRE01.',
        support_code: 'DVRE01',
        failure_reference: 'run-ref-10',
      },
    });

    render(<VisualSignatureApprovalModal {...createModalProps({ onClose })} />);

    await waitFor(() => expect(screen.getByText('Aprovar')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Aprovar'));
    await waitFor(() => expect(screen.getByText(/pendente inicial com código DVAP01/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Realinhar direção visual' }));

    await waitFor(() => {
      expect(screen.getByText(/Informe ao suporte o código DVRE01/)).toBeInTheDocument();
    });
    expect(screen.getByText('Direção visual pendente')).toBeInTheDocument();
    expect(screen.queryByText(/run-ref-10/)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('VisualSignatureApprovalModal — bp_failed retry (diagnóstico do realinhamento)', () => {
  it('falha no realinhamento mantém o modal e mostra a mensagem segura específica', async () => {
    const props = createModalProps({ mode: 'substitution' });
    const { onClose } = props;

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/api/legal/status')) {
        return new Response(JSON.stringify({ acceptanceStatus: 'current' }), { status: 200 });
      }
      if (urlStr.includes('/generate-without-logo')) {
        return new Response(
          JSON.stringify({ assetUrl: 'https://x/sig.png', signatureId: 'sig-1', artDirectorOutput: {}, attempt: 1 }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/visual-signature/approve')) {
        return new Response(
          JSON.stringify({ signature: { assetUrl: 'https://x/sig.png' }, bp_status: 'failed', brandProfileData: null }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/brand-profile/realign')) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'O provedor recusou a análise deste logotipo. A direção visual anterior foi mantida.',
            error: 'refused',
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<VisualSignatureApprovalModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Aprovar')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aprovar'));

    await waitFor(() => {
      expect(screen.getByText('Direção visual pendente')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Realinhar direção visual'));

    await waitFor(() => {
      expect(screen.getByText(/A direção visual anterior foi mantida\./)).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
