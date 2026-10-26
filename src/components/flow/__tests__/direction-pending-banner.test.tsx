// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DirectionPendingBanner } from '../direction-pending-banner';

function renderBanner(overrides: Partial<React.ComponentProps<typeof DirectionPendingBanner>> = {}) {
  const props = {
    message:
      'Não foi possível concluir sua direção visual. A geração de campanhas ficará indisponível até a conclusão. Entre em contato com o suporte e informe o código DVAP01. Após a orientação do suporte, clique em Realinhar direção visual.',
    onRealign: vi.fn(),
    isRealinhando: false,
    error: false,
    ...overrides,
  };
  const utils = render(<DirectionPendingBanner {...props} />);
  return { ...utils, props };
}

describe('DirectionPendingBanner', () => {
  it('renderiza role=alert, título e mensagem com o código uma única vez', () => {
    renderBanner();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Direção visual pendente')).toBeInTheDocument();
    expect(screen.getByText(/informe o código DVAP01/)).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent?.match(/DVAP01/g)).toHaveLength(1);
  });

  it('não renderiza referência interna nem linha "Código de suporte"', () => {
    renderBanner({ message: 'Mensagem com DVAP01.' });

    expect(screen.queryByText(/Código de suporte/)).not.toBeInTheDocument();
    expect(screen.queryByText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i)).not.toBeInTheDocument();
  });

  it('botão exato "Realinhar direção visual" dispara onRealign', () => {
    const { props } = renderBanner();
    const button = screen.getByRole('button', { name: 'Realinhar direção visual' });
    fireEvent.click(button);
    expect(props.onRealign).toHaveBeenCalledTimes(1);
  });

  it('estado error mostra o título de erro', () => {
    renderBanner({ error: true, message: 'Não foi possível verificar.' });
    expect(screen.getByText('Não foi possível verificar a direção visual')).toBeInTheDocument();
    expect(screen.queryByText(/Código de suporte/)).not.toBeInTheDocument();
  });

  it('mostra DVRE01 no realinhamento pendente', () => {
    renderBanner({
      message:
        'Não foi possível concluir sua direção visual. A geração de campanhas ficará indisponível até a conclusão. Entre em contato com o suporte e informe o código DVRE01. Após a orientação do suporte, clique em Realinhar direção visual.',
    });
    expect(screen.getByText(/informe o código DVRE01/)).toBeInTheDocument();
  });

  it('botão desabilitado quando isRealinhando', () => {
    renderBanner({ isRealinhando: true });
    const button = screen.getByRole('button', { name: 'Realinhar direção visual' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
