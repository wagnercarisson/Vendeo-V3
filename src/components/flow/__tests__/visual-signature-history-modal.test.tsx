// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VisualSignatureHistoryModal } from '../visual-signature-history-modal';

function createMockSignature(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sig-' + Math.random().toString(36).substring(2, 9),
    assetUrl: 'https://example.com/sig.png',
    type: 'generated',
    status: 'archived',
    attempt: 1,
    created_at: '2026-07-20T10:00:00Z',
    approved_at: null,
    art_direction: { visual_direction: 'Moderno', content_used: { store_name: true, city: false, state: false, slogan: false } },
    restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' },
    ...overrides,
  };
}

function createModalProps(overrides: Record<string, unknown> = {}) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    storeId: 'test-store',
    identityState: 'text_only',
    onApplied: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── Task 3.1: Filter and display (5 tests) ───

describe('HistoryModal filter and display', () => {
  it('API first batch returns 6 VS (4 ok, 2 critical_drift) — exibe 4 visíveis, 2 ocultos', async () => {
    const props = createModalProps();
    const signatures = [
      createMockSignature({ id: 's1', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
      createMockSignature({ id: 's2', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
      createMockSignature({ id: 's3', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
      createMockSignature({ id: 's4', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
      createMockSignature({ id: 's5', restore_eligibility: { can_restore: false, drift_fields: ['name'], requires_regeneration: true, reason: 'critical_drift' } }),
      createMockSignature({ id: 's6', restore_eligibility: { can_restore: false, drift_fields: [], requires_regeneration: true, reason: 'missing_metadata' } }),
    ];

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ signatures, total: 6 }), { status: 200 })
    );

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('4 de 6 assinaturas')).toBeInTheDocument();
    });
  });

  it('API returns total=8, first 6 ok, click "Ver versões anteriores" — second batch 2 ok — exibe 8', async () => {
    const props = createModalProps();
    let callCount = 0;

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : '';
      callCount++;
      if (callCount === 1) {
        const signatures = Array.from({ length: 6 }, (_, i) =>
          createMockSignature({ id: `s${i + 1}`, attempt: i + 1, restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } })
        );
        return new Response(JSON.stringify({ signatures, total: 8 }), { status: 200 });
      }
      const signatures = Array.from({ length: 2 }, (_, i) =>
        createMockSignature({ id: `s${i + 7}`, attempt: i + 7, restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } })
      );
      return new Response(JSON.stringify({ signatures, total: 8 }), { status: 200 });
    });

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('6 de 8 assinaturas')).toBeInTheDocument();
    });

    const loadMore = screen.getByText('Ver versões anteriores');
    fireEvent.click(loadMore);

    await waitFor(() => {
      expect(screen.getByText('8 de 8 assinaturas')).toBeInTheDocument();
    });
  });

  it('API returns 0 VS — empty state "Nenhuma assinatura anterior"', async () => {
    const props = createModalProps();

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ signatures: [], total: 0 }), { status: 200 })
    );

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma assinatura anterior')).toBeInTheDocument();
    });
  });

  it('API returns error — error state', async () => {
    const props = createModalProps();

    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar assinaturas anteriores')).toBeInTheDocument();
    });
  });

  it('Loading — spinner visível', async () => {
    const props = createModalProps();
    let resolvePromise: (value: any) => void;
    const fetchPromise = new Promise((resolve) => { resolvePromise = resolve; });

    vi.spyOn(global, 'fetch').mockReturnValue(fetchPromise);

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeTruthy();
    });

    resolvePromise!(new Response(JSON.stringify({ signatures: [], total: 0 }), { status: 200 }));
  });
});

// ─── Task 3.2: Actions by identity (6 tests) ───

describe('HistoryModal actions by identity', () => {
  function setupWithSignatures(identityState: string | null) {
    const props = createModalProps({ identityState });
    const signatures = [
      createMockSignature({ id: 's1', status: 'archived', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
      createMockSignature({ id: 's2', status: 'active', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
      createMockSignature({ id: 's3', status: 'draft', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
    ];

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ signatures, total: 3 }), { status: 200 })
    );

    render(<VisualSignatureHistoryModal {...props} />);
    return props;
  }

  it('identity_state = visual_signature — botão desabilitado com tooltip', async () => {
    setupWithSignatures('visual_signature');

    await waitFor(() => {
      const disabledButtons = screen.getAllByText('Indisponível');
      expect(disabledButtons.length).toBe(2);
      const firstDisabled = disabledButtons[0];
      expect(firstDisabled).toHaveAttribute('title', 'Remova a assinatura ativa antes de aplicar outra versão');
    });
  });

  it('identity_state = text_only — botão "Aplicar" habilitado', async () => {
    setupWithSignatures('text_only');

    await waitFor(() => {
      const applyButtons = screen.getAllByText('Aplicar');
      expect(applyButtons.length).toBe(2);
    });
  });

  it('Signature com status === "active" — sem ação, badge "Ativa"', async () => {
    const props = createModalProps();
    const signatures = [
      createMockSignature({ id: 's1', status: 'active', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
    ];

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ signatures, total: 1 }), { status: 200 })
    );

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      const activeElements = screen.getAllByText('Ativa');
      expect(activeElements.length).toBe(2);
    });
  });

  it('Click "Aplicar" em archived — POST /approve chamado com signatureId', async () => {
    const props = createModalProps();
    const signatures = [
      createMockSignature({ id: 's-archived', status: 'archived', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
    ];

    let approveBody: any = null;
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/visual-signature') && (!init || init.method === 'GET')) {
        return new Response(JSON.stringify({ signatures, total: 1 }), { status: 200 });
      }
      if (urlStr.includes('/approve')) {
        approveBody = init ? JSON.parse(init.body as string) : null;
        return new Response(JSON.stringify({ success: true, signature: { id: 's-archived', assetUrl: 'https://example.com', status: 'active' } }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Aplicar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aplicar'));

    await waitFor(() => {
      expect(approveBody).toEqual({ signatureId: 's-archived' });
    });
  });

  it('Click "Aplicar" em draft — POST /approve chamado com signatureId', async () => {
    const props = createModalProps();
    const signatures = [
      createMockSignature({ id: 's-draft', status: 'draft', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
    ];

    let approveBody: any = null;
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/visual-signature') && (!init || init.method === 'GET')) {
        return new Response(JSON.stringify({ signatures, total: 1 }), { status: 200 });
      }
      if (urlStr.includes('/approve')) {
        approveBody = init ? JSON.parse(init.body as string) : null;
        return new Response(JSON.stringify({ success: true, signature: { id: 's-draft', assetUrl: 'https://example.com', status: 'active' } }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Aplicar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aplicar'));

    await waitFor(() => {
      expect(approveBody).toEqual({ signatureId: 's-draft' });
    });
  });

  it('POST /approve com draft sem drift — ativa com sucesso, onApplied chamado', async () => {
    const props = createModalProps();
    const signatures = [
      createMockSignature({ id: 's-draft', status: 'draft', restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } }),
    ];

    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/visual-signature') && (!init || init.method === 'GET')) {
        return new Response(JSON.stringify({ signatures, total: 1 }), { status: 200 });
      }
      if (urlStr.includes('/approve')) {
        return new Response(JSON.stringify({ success: true, signature: { id: 's-draft', assetUrl: 'https://example.com', status: 'active' } }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Aplicar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Aplicar'));

    await waitFor(() => {
      expect(props.onApplied).toHaveBeenCalled();
    });
  });
});

// ─── Task 3.4: Pagination (4 tests) ───

describe('HistoryModal pagination', () => {
  function renderModal(apiTotal: number, firstBatchCount: number) {
    const props = createModalProps();
    const signatures = Array.from({ length: firstBatchCount }, (_, i) =>
      createMockSignature({ id: `s${i + 1}`, attempt: i + 1, restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } })
    );

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ signatures, total: apiTotal }), { status: 200 })
    );

    render(<VisualSignatureHistoryModal {...props} />);
    return props;
  }

  it('total = 6 — sem botão "Ver versões anteriores"', async () => {
    renderModal(6, 6);

    await waitFor(() => {
      expect(screen.queryByText('Ver versões anteriores')).not.toBeInTheDocument();
    });
  });

  it('total = 7 — "Ver versões anteriores" visível', async () => {
    renderModal(7, 6);

    await waitFor(() => {
      expect(screen.getByText('Ver versões anteriores')).toBeInTheDocument();
    });
  });

  it('Click → carrega +6, total = 12, botão some', async () => {
    const props = createModalProps();
    let callCount = 0;

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : '';
      callCount++;
      if (callCount === 1) {
        const signatures = Array.from({ length: 6 }, (_, i) =>
          createMockSignature({ id: `s${i + 1}`, attempt: i + 1, restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } })
        );
        return new Response(JSON.stringify({ signatures, total: 12 }), { status: 200 });
      }
      const signatures = Array.from({ length: 6 }, (_, i) =>
        createMockSignature({ id: `s${i + 7}`, attempt: i + 7, restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } })
      );
      return new Response(JSON.stringify({ signatures, total: 12 }), { status: 200 });
    });

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Ver versões anteriores')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ver versões anteriores'));

    await waitFor(() => {
      expect(screen.queryByText('Ver versões anteriores')).not.toBeInTheDocument();
    });
  });

  it('total = 20 — botão some após 12 itens', async () => {
    const props = createModalProps();
    let callCount = 0;

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = typeof url === 'string' ? url : '';
      callCount++;
      if (callCount <= 2) {
        const count = callCount === 1 ? 6 : 6;
        const signatures = Array.from({ length: count }, (_, i) => {
          const idx = (callCount - 1) * 6 + i + 1;
          return createMockSignature({ id: `s${idx}`, attempt: idx, restore_eligibility: { can_restore: true, drift_fields: [], requires_regeneration: false, reason: 'ok' } });
        });
        return new Response(JSON.stringify({ signatures, total: 20 }), { status: 200 });
      }
      return new Response(JSON.stringify({ signatures: [], total: 20 }), { status: 200 });
    });

    render(<VisualSignatureHistoryModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Ver versões anteriores')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ver versões anteriores'));

    await waitFor(() => {
      expect(screen.queryByText('Ver versões anteriores')).not.toBeInTheDocument();
    });

    expect(screen.getByText('12 de 12 assinaturas')).toBeInTheDocument();
  });
});
