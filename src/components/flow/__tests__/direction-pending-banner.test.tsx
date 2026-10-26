// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DirectionPendingBanner } from '../direction-pending-banner';

function renderBanner(overrides: Partial<React.ComponentProps<typeof DirectionPendingBanner>> = {}) {
  const props = {
    reference: 'run-123',
    message: 'A geração de campanhas ficará indisponível até a conclusão.',
    onRealign: vi.fn(),
    isRealinhando: false,
    error: false,
    ...overrides,
  };
  const utils = render(<DirectionPendingBanner {...props} />);
  return { ...utils, props };
}

describe('DirectionPendingBanner', () => {
  it('renderiza role=alert, título, mensagem e referência', () => {
    renderBanner();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Direção visual pendente')).toBeInTheDocument();
    expect(screen.getByText('A geração de campanhas ficará indisponível até a conclusão.')).toBeInTheDocument();
    expect(screen.getByText('Código de suporte: run-123')).toBeInTheDocument();
  });

  it('botão exato "Realinhar direção visual" dispara onRealign', () => {
    const { props } = renderBanner();
    const button = screen.getByRole('button', { name: 'Realinhar direção visual' });
    fireEvent.click(button);
    expect(props.onRealign).toHaveBeenCalledTimes(1);
  });

  it('estado error mostra o título de erro', () => {
    renderBanner({ error: true, reference: null, message: 'Não foi possível verificar.' });
    expect(screen.getByText('Não foi possível verificar a direção visual')).toBeInTheDocument();
    expect(screen.queryByText(/Código de suporte/)).not.toBeInTheDocument();
  });

  it('botão desabilitado quando isRealinhando', () => {
    renderBanner({ isRealinhando: true });
    const button = screen.getByRole('button', { name: 'Realinhar direção visual' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
