import 'server-only';
import { BrandProfilerWithoutLogoError } from '@/lib/visual-signature/brand-profiler';
import { AiInvocationError } from '@/lib/ai/types';

/**
 * Classificação técnica segura de falhas da direção visual (quick 261025-v14).
 *
 * Preserva a classificação já conhecida do gateway/provider — `unexpected_error`
 * só é usado quando a natureza da falha não pode ser determinada.
 */
export function classifyVisualDirectionFailure(err: unknown): string {
  if (err instanceof BrandProfilerWithoutLogoError) {
    return err.metadata.errorType;
  }
  if (err instanceof AiInvocationError) {
    return err.kind;
  }
  return 'unexpected_error';
}
