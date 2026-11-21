/**
 * Fixture sintética da política de diretivas inline.
 *
 * Com inline config desligada na engine (`--no-inline-config` /
 * `allowInlineConfig: false`):
 * 1. a diretiva abaixo referencia um plugin que o diagnóstico NÃO registra
 *    (`@next/next`). Ela precisa ser inerte — nada de
 *    "Definition for rule ... was not found".
 * 2. a diretiva seguinte tenta suprimir uma declaração realmente não usada.
 *    A ocorrência DEVE ser reportada: o diagnóstico analisa o código sem
 *    aplicar supressões. Nenhuma diretiva é removida do repositório.
 */

/* eslint-disable-next-line @next/next/no-img-element */
export const ignoredDirectiveValue = 1;

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const suppressedButUnused = 2;

export const exportedValue = 3;
