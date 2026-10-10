// @vitest-environment node
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { AiInvocationResult } from '@/lib/ai';

/**
 * F-quick: contrato aditivo de `AiInvocationResult`. Prova que os campos novos
 * (`finishReason`, `refusal`) são opcionais e não quebram consumidores
 * existentes que constroem o resultado apenas com os campos legados.
 */
describe('AiInvocationResult — aditividade (F-quick)', () => {
  it('resultado legado (sem os campos novos) continua válido', () => {
    const legacy: AiInvocationResult = { content: '{}', model: 'gpt-4o' };
    expect(legacy.finishReason).toBeUndefined();
    expect(legacy.refusal).toBeUndefined();
  });

  it('os campos novos são opcionais no tipo', () => {
    expectTypeOf<AiInvocationResult['finishReason']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<AiInvocationResult['refusal']>().toEqualTypeOf<string | undefined>();
  });

  it('resultado enriquecido preserva os campos legados', () => {
    const enriched: AiInvocationResult = {
      content: '',
      model: 'gpt-4o',
      finishReason: 'length',
      refusal: 'não posso ajudar',
    };
    const asLegacy: AiInvocationResult = { content: enriched.content, model: enriched.model };
    expect(asLegacy.content).toBe('');
    expect(enriched.finishReason).toBe('length');
    expect(enriched.refusal).toBe('não posso ajudar');
  });
});
