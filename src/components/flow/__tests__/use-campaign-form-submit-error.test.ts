import { describe, it, expect } from 'vitest';

describe('useCampaignForm submit error handling', () => {
  type Setter<T> = (v: T) => void;

  async function handleApiError(
    status: number,
    body: unknown,
    setSubmitError: Setter<string | null>,
    setIsSubmitting: Setter<boolean>,
    setPendingConflict: Setter<unknown>,
  ): Promise<void> {
    const response = new Response(JSON.stringify(body), { status });
    if (response.status === 409) {
      const errorData = await response.json().catch(() => null);
      if (errorData?.reason === 'product_image_conflict' || errorData?.reason === 'product_image_strong_conflict' || errorData?.reason === 'product_image_low_confidence') {
        setPendingConflict({ type: 'conflict', body: {} });
        setSubmitError(errorData.message || 'Erro ao gerar imagem');
        setIsSubmitting(false);
        return;
      }
      setSubmitError(errorData?.message || 'Erro ao gerar imagem');
      setIsSubmitting(false);
      return;
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      setSubmitError(errorData?.error?.message || 'Erro ao gerar imagem');
      setIsSubmitting(false);
      return;
    }
  }

  it('500 server error sets submitError and stops submitting', async () => {
    const submitErrors: (string | null)[] = [];
    const submittingStates: boolean[] = [];

    await handleApiError(
      500,
      { error: { message: 'Erro interno do servidor' } },
      (v) => { submitErrors.push(v); },
      (v) => { submittingStates.push(v); },
      () => {},
    );

    expect(submitErrors).toContain('Erro interno do servidor');
    expect(submittingStates).toContain(false);
  });

  it('non-ok response without error body falls back to default message', async () => {
    const submitErrors: (string | null)[] = [];

    await handleApiError(
      502,
      {},
      (v) => { submitErrors.push(v); },
      () => {},
      () => {},
    );

    expect(submitErrors).toContain('Erro ao gerar imagem');
  });

  it('409 conflict sets pendingConflict and shows error message', async () => {
    const submitErrors: (string | null)[] = [];
    const conflicts: unknown[] = [];

    await handleApiError(
      409,
      { reason: 'product_image_conflict', message: 'O nome do produto não corresponde à imagem.' },
      (v) => { submitErrors.push(v); },
      () => {},
      (v) => { conflicts.push(v); },
    );

    expect(conflicts.length).toBeGreaterThan(0);
    expect(submitErrors).toContain('O nome do produto não corresponde à imagem.');
  });

  it('unknown 409 without reason falls back to default error', async () => {
    const submitErrors: (string | null)[] = [];
    const conflicts: unknown[] = [];

    await handleApiError(
      409,
      { message: 'Conflict' },
      (v) => { submitErrors.push(v); },
      () => {},
      (v) => { conflicts.push(v); },
    );

    expect(conflicts).toEqual([]);
    expect(submitErrors).toContain('Conflict');
  });

  it('in-stream error event sets submitError', async () => {
    const errors: (string | null)[] = [];
    const submitting: boolean[] = [];

    function handleStreamError(
      event: { code: string; message: string; requiresUserAction?: boolean },
    ): void {
      if (event.code === 'generated_product_mismatch') {
        errors.push(event.message || 'A imagem gerada não corresponde ao produto.');
      } else {
        errors.push(event.message || 'Erro ao gerar imagem.');
      }
      submitting.push(false);
    }

    handleStreamError({ code: 'provider_error', message: 'Falha no provedor de IA.' });

    expect(errors).toContain('Falha no provedor de IA.');
    expect(submitting).toContain(false);
  });
});
